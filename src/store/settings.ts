import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { TempUnit, WindUnit } from "@/utils/format";

export type ThemeSetting = "light" | "dark" | "system";

type SettingsState = {
  theme: ThemeSetting;
  tempUnit: TempUnit;
  windUnit: WindUnit;
  setTheme: (theme: ThemeSetting) => void;
  setTempUnit: (unit: TempUnit) => void;
  setWindUnit: (unit: WindUnit) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      // Svijetla je zadana (odluka 6.8.2026.) — gradijenti heroja su
      // dizajnirani prvo za svijetlu; tamna ostaje izbor u postavkama.
      theme: "light",
      tempUnit: "C",
      /*
       * m/s je zadano (Markov odabir 6.8.2026.): DHMZ, pomorska prognoza i
       * Beaufortova skala u Hrvatskoj govore u m/s, pa i pragovi bure
       * (10 / 17 m/s) imaju smisla samo u toj jedinici. km/h ostaje izbor
       * u Postavkama.
       */
      windUnit: "ms",
      setTheme: (theme) => set({ theme }),
      setTempUnit: (tempUnit) => set({ tempUnit }),
      setWindUnit: (windUnit) => set({ windUnit }),
    }),
    {
      name: "burin:settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
