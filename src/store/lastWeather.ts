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
    },
  ),
);
