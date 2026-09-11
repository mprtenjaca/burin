import { useQuery } from "@tanstack/react-query";

import { fetchRadarCoverage, fetchRadarEcho, pointToGlobalPixel, RAINVIEWER_ZOOM, tileOf } from "@/api/radarSample";
import type { RadarFrames } from "@/api/rainviewer";
import type { Place } from "@/api/types";

const MIN = 60 * 1000;

/**
 * Radarski odjek (RainViewer) nad mjestom za ZADNJI prošli okvir + je li
 * mjesto uopće pokriveno radarom (10.9.2026.).
 *
 * Ključ odjeka nosi vrijeme okvira: novi okvir (svakih 10 min) = novi
 * upit, stari se sam odbaci. Lista okvira dolazi iz `useRadarFrames`
 * (RainViewer, provjera svakih 5 min → kašnjenje najviše ~6–7 min iza
 * pravog vremena). Odjek NE IDE NA DISK (`utils/queryPersist.ts`): okvir
 * od jučer ne govori ništa o danas.
 *
 * POKRIVENOST je zaseban upit po PLOČICI (ne po mjestu — susjedna mjesta
 * dijele odgovor), stoji dan u memoriji i smije na disk: mreža radara se
 * ne mijenja. Bez pokrivenosti radar šuti — prazna pločica nad Kijevom ili
 * Ankarom znači „ne znamo", ne „ne pada" (izmjereno 10.9.).
 *
 * `retry: 0` na odjeku — ako pločica ne dođe, sudac radar preskoči i vrati
 * se na postaju/model, bez čekanja.
 *
 * `pending` kaže „još ne znamo što radar kaže": lista okvira, pokrivenost
 * ili uzorak su u tijeku. `useWeatherBundle` za poznati grad čeka da padne
 * na `false` — inače bi heroj na tren pokazao grmljavinu s postaje pa
 * preskočio na oblačno kad radar stigne.
 */
export function useRadarEcho(
  place: Place | null,
  frames: { data?: RadarFrames; isFetched: boolean; isError: boolean; refetch?: () => unknown },
) {
  const last = frames.data?.frames.filter((f) => !f.isNowcast).at(-1);
  const host = frames.data?.host;

  const tile = place ? tileOf(pointToGlobalPixel(place.lat, place.lon, RAINVIEWER_ZOOM).gx, pointToGlobalPixel(place.lat, place.lon, RAINVIEWER_ZOOM).gy) : undefined;
  const coverage = useQuery({
    queryKey: ["radar-coverage", tile?.tx, tile?.ty],
    queryFn: () => fetchRadarCoverage(host!, place!.lat, place!.lon),
    enabled: !!place && !!host && !!tile,
    staleTime: 24 * 60 * MIN,
    gcTime: 7 * 24 * 60 * MIN,
    retry: 1,
  });

  const covered = coverage.data === true;
  const echoEnabled = !!place && !!host && !!last && covered;
  const echo = useQuery({
    queryKey: ["radar-echo", place?.id, last?.time],
    queryFn: () => fetchRadarEcho(host!, last!, place!.lat, place!.lon),
    enabled: echoEnabled,
    staleTime: 10 * MIN,
    gcTime: 30 * MIN,
    retry: 0,
  });

  /*
   * PRETHODNI OKVIR — da sudac vidi je li odjek POSTOJAN (11.9.2026.).
   *
   * Markov nalaz: „Metković — po kamerama uživo kiše tamo nema", a app je
   * pisala jaku kišu. Izmjereno nad Metkovićem kroz okvire:
   *     08:20  30 dBZ (8 % kruga)   08:30  45 (18 %)   08:40  24 (6 %)
   *     08:50  49 dBZ (49 %)        09:00  39 (71 %)   09:10  BEZ ODJEKA
   * Jezgra je treperila i nestala u jednom okviru — to je odjek visoko u
   * oblaku (grad/krupne kapi koje ne stignu do tla), a postaja Ploče je
   * istovremeno javljala „grmljavina BEZ OBORINA".
   *
   * Za usporedbu, prava kiša u isto vrijeme: Korenica 29–37 dBZ na
   * 100 % kruga kroz pola sata (Marko: „Korenica još pada"), Zadar jutros
   * stabilan kroz 35 min uz pomicanje ćelije.
   *
   * Jedan okvir ne razlikuje to dvoje — dva okvira razlikuju.
   */
  const prev = frames.data?.frames.filter((f) => !f.isNowcast).at(-2);
  const prevEcho = useQuery({
    queryKey: ["radar-echo", place?.id, prev?.time],
    queryFn: () => fetchRadarEcho(host!, prev!, place!.lat, place!.lon),
    enabled: !!place && !!host && !!prev && covered,
    staleTime: Infinity, // prošli okvir se ne mijenja
    gcTime: 30 * MIN,
    retry: 0,
  });

  /*
   * PROŠLI SATI (11.9.2026., Markov nalaz „ikonice za danas su netočne").
   *
   * Model je za Zadar u 07:00 tvrdio „pretežno vedro" dok je radar imao
   * 32–39 dBZ. Radar nosi ~2 h povijesti, pa se ti sati ne moraju
   * nagađati — svaki OKVIR se uzorkuje i grupira po satu, a `weather.ts`
   * iz toga složi kod (`withPastCodes`).
   *
   * Zadnji okvir se izostavlja: on pripada tekućem satu, kojim već vlada
   * `judged.code` s heroja. Ključ nosi vrijeme NAJSTARIJEG okvira — kad
   * lista odmakne, upit se sam ponovi; svi ostali su isti.
   *
   * `staleTime: Infinity` jer prošlost se ne mijenja. Ne ide na disk
   * (`utils/queryPersist.ts`) — sutra ne govori ništa o današnjim satima.
   */
  const pastFrames = frames.data?.frames.filter((f) => !f.isNowcast).slice(0, -1) ?? [];
  const pastEcho = useQuery({
    queryKey: ["radar-past", place?.id, pastFrames[0]?.time, pastFrames.length],
    queryFn: async () => {
      const samples = await Promise.all(
        pastFrames.map((f) =>
          fetchRadarEcho(host!, f, place!.lat, place!.lon).catch(() => undefined),
        ),
      );
      // Najjači odjek unutar svakog sata: pljusak od 15 min je ono što se
      // tog sata dogodilo, prosjek bi ga izgladio u ništa.
      const byHour = new Map<string, number>();
      for (const s of samples) {
        if (!s || s.maxDbz === null) continue;
        const d = new Date(s.frameTime * 1000);
        const pad = (n: number) => n.toString().padStart(2, "0");
        const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
        const prev = byHour.get(iso);
        if (prev === undefined || s.maxDbz > prev) byHour.set(iso, s.maxDbz);
      }
      return byHour;
    },
    enabled: !!place && !!host && covered && pastFrames.length > 0,
    staleTime: Infinity,
    gcTime: 30 * MIN,
    retry: 0,
  });

  const framesPending = !frames.isFetched && !frames.isError;
  const coveragePending = !!place && !!host && !coverage.isFetched && !coverage.isError;
  const echoPending = echoEnabled && !echo.isFetched && !echo.isError;

  return {
    echo: echo.data,
    /** Prethodni okvir (~10 min prije) — sudac iz njega čita postojanost. */
    prevEcho: prevEcho.data,
    /** dBZ po prošlom satu (`"2026-09-11T07:00"` → 39). Prazno dok ne stigne. */
    pastDbz: pastEcho.data,
    covered: coverage.isFetched ? covered : undefined,
    dataUpdatedAt: echo.dataUpdatedAt,
    pending: framesPending || coveragePending || echoPending,
    /*
     * Ručno osvježavanje (pull-to-refresh, 10.9.2026.).
     *
     * Traži se NOVA LISTA OKVIRA, ne samo uzorak: `echo` je keširan pod
     * ključem s vremenom okvira, pa bi sam `echo.refetch()` iznova
     * dohvatio ISTU pločicu. Novi okvir (svakih 10 min) mijenja ključ i
     * uzorak se pokrene sam. Pokrivenost se ne dira — mreža radara se ne
     * mijenja, a keš joj je dan.
     */
    refetch: () => {
      void frames.refetch?.();
    },
  };
}
