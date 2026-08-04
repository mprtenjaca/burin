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
      theme: "system",
      tempUnit: "C",
      windUnit: "kmh",
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
