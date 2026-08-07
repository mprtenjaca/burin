import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CurrentWeather, WeatherBundle } from "@/api/types";

/**
 * Zadnji uspješno dohvaćeni podaci po mjestu — za offline prikaz
 * ("Podaci od HH:mm") i kao zajednička pohrana koju će čitati budući
 * Android widget (v1.1, react-native-android-widget).
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

export const useLastWeather = create<LastWeatherState>()(
  persist(
    (set) => ({
      byPlaceId: {},
      save: (bundle) =>
        set((s) => ({
          byPlaceId: { ...s.byPlaceId, [bundle.place.id]: bundle },
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
