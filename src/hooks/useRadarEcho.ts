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

  const framesPending = !frames.isFetched && !frames.isError;
  const coveragePending = !!place && !!host && !coverage.isFetched && !coverage.isError;
  const echoPending = echoEnabled && !echo.isFetched && !echo.isError;

  return {
    echo: echo.data,
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
