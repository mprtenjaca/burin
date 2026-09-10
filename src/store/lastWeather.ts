import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CurrentWeather, WeatherBundle } from "@/api/types";
import { useCities } from "@/store/cities";
import { useSearchHistory } from "@/store/searchHistory";

/**
 * Zadnji uspješno dohvaćeni podaci po mjestu — za offline prikaz
 * ("Podaci od HH:mm") i kao zajednička pohrana koju čita Android widget
 * (react-native-android-widget, handler čita AsyncStorage izravno).
 *
 * ULOGA UZ PERSISTER (10.9.2026.): react-query od danas ima vlastiti keš na
 * disku po upitu (`experimental_createQueryPersister` u `_layout.tsx`) —
 * to je TRANSPORTNI keš (sirovi odgovori). Ovo ostaje PRODUKTNI keš:
 * „zadnji dobar paket po gradu", s korekcijama primijenjenima, koji čitaju
 * ladica, tražilica, widget i offline prikaz. Ne dupliraju logiku —
 * persister je proziran omot oko `queryFn`.
 */
type LastWeatherState = {
  byPlaceId: Record<string, WeatherBundle>;
  save: (bundle: WeatherBundle) => void;
  /**
   * Osvježi SAMO trenutno stanje spremljenih mjesta (8.8.2026.).
   *
   * Ladica i tražilica pokazuju temperaturu po gradu iz ovog keša, a
   * dosad ga je punio jedino puni dohvat za OTVORENO mjesto. Ostali
   * gradovi su zato držali temperaturu od zadnjeg puta kad su bili
   * otvoreni — nakon dan-dva posve krivu.
   *
   * Mijenja se samo `current` i `fetchedAt`; prognoza (`hourly`,
   * `daily`) ostaje stara jer je za popis nevažna, a njeno dohvaćanje
   * bi bilo mnogo skuplje. Mjesta kojih nema u `updates` se ne diraju.
   */
  refreshCurrent: (updates: Record<string, CurrentWeather>) => void;
};

/**
 * Za DISK se izostavlja `hourlyAll` (dorada 6.8.2026.).
 *
 * Zašto: taj niz nosi 16 dana × 24 sata = ~384 točke po gradu i daleko
 * je najveći dio paketa (procijenjeno ~55 od ~69 kB). Sa 6 spremljenih
 * gradova to je preko 300 kB koje `persist` serijalizira NA JS THREADU
 * pri svakoj promjeni mjesta — glavni razlog zašto je dodir na grad
 * "visio" prije nego se išta dogodi.
 *
 * Ostalo OSTAJE: `hourly` (traka sati) i cijeli `daily` (14 dana) —
 * offline prikaz nakon greške mora izgledati kao pravi ekran, a njih
 * dvoje zajedno su mali. `hourlyAll` treba samo detalj pojedinog dana,
 * koji se ionako otvara tek uz mrežu; kad ga nema, lista dana radi bez
 * proširenja umjesto da se sve sruši.
 *
 * U MEMORIJI paket ostaje cijel — reže se samo ono što ide na disk.
 */
function slimForDisk(bundle: WeatherBundle): WeatherBundle {
  return { ...bundle, hourlyAll: [] };
}

/** Najsvježiji GPS paket iz pohrane — zaglavlje ladice na „Mojoj lokaciji". */
export function latestGpsBundle(
  byPlaceId: Record<string, WeatherBundle>,
): WeatherBundle | undefined {
  let best: WeatherBundle | undefined;
  for (const b of Object.values(byPlaceId)) {
    if (b.place.isGps && (!best || b.fetchedAt > best.fetchedAt)) best = b;
  }
  return best;
}

/**
 * OBREZIVANJE keša (10.9.2026.). Do tada se `byPlaceId` NIKAD nije
 * praznio: svaki grad ikad otvoren ostajao je zauvijek, a `persist`
 * stringificira SVE gradove pri svakom `save` — na JS threadu, usred
 * prebacivanja grada. Rast je bio neomeđen (mjeseci korištenja = deseci
 * gradova = stotine kB po upisu).
 *
 * Zadržava se samo ono što netko još čita: spremljeni gradovi, povijest
 * pretrage (≤ 12), trenutno odabrani i najnoviji GPS paket (zaglavlje
 * ladice na „Mojoj lokaciji"). Sve ostalo je bilo nedohvatljivo iz
 * sučelja — ni ladica ni tražilica ga ne pokazuju.
 *
 * Čista funkcija, izvezena radi testa; `save` joj daje ključeve iz
 * ostalih storeova. Kad nema što izbaciti, vraća ISTI objekt (bez
 * uzaludnog buđenja pretplatnika).
 */
export function pruneBundles(
  byPlaceId: Record<string, WeatherBundle>,
  keepIds: Iterable<string>,
): Record<string, WeatherBundle> {
  const keep = new Set(keepIds);
  const gps = latestGpsBundle(byPlaceId);
  if (gps) keep.add(gps.place.id);
  const ids = Object.keys(byPlaceId);
  if (ids.every((id) => keep.has(id))) return byPlaceId;
  const next: Record<string, WeatherBundle> = {};
  for (const id of ids) if (keep.has(id)) next[id] = byPlaceId[id]!;
  return next;
}

/** Ključevi koje sučelje još može pokazati — vidi `pruneBundles`. */
function keepIdsNow(): string[] {
  const { saved, selected } = useCities.getState();
  const history = useSearchHistory.getState().entries;
  return [...saved, ...history, ...(selected ? [selected] : [])].map((p) => p.id);
}

export const useLastWeather = create<LastWeatherState>()(
  persist(
    (set) => ({
      byPlaceId: {},
      save: (bundle) =>
        set((s) => ({
          byPlaceId: pruneBundles(
            { ...s.byPlaceId, [bundle.place.id]: bundle },
            // Upravo spremljeni grad ostaje i kad još nije ni u povijesti.
            [...keepIdsNow(), bundle.place.id],
          ),
        })),
      refreshCurrent: (updates) =>
        set((s) => {
          const next: Record<string, WeatherBundle> = { ...s.byPlaceId };
          let changed = false;
          for (const [id, current] of Object.entries(updates)) {
            const old = next[id];
            // Osvježava se samo ono što VEĆ postoji: nepoznato mjesto bi
            // dalo paket bez prognoze, a takav bi srušio ekran ako se
            // otvori offline.
            if (!old) continue;
            next[id] = { ...old, current, fetchedAt: Date.now() };
            changed = true;
          }
          // Bez promjene se stanje NE dira — inače svaki pokušaj gura
          // novi objekt i pretplatnici se osvježe bez razloga.
          return changed ? { byPlaceId: next } : s;
        }),
    }),
    {
      name: "burin:last-weather",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) =>
        ({
          byPlaceId: Object.fromEntries(
            Object.entries(s.byPlaceId).map(([id, b]) => [id, slimForDisk(b)]),
          ),
        }) as LastWeatherState,
    },
  ),
);
