import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { WeatherBundle } from "@/api/types";

/**
 * Zadnji uspješno dohvaćeni podaci po mjestu — za offline prikaz
 * ("Podaci od HH:mm") i kao zajednička pohrana koju će čitati budući
 * Android widget (v1.1, react-native-android-widget).
 */
type LastWeatherState = {
  byPlaceId: Record<string, WeatherBundle>;
  save: (bundle: WeatherBundle) => void;
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
