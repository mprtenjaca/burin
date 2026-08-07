import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { TempUnit, WindUnit } from "@/utils/format";

export type ThemeSetting = "light" | "dark" | "system";

/**
 * Jezik sučelja (6.8.2026.). `system` znači "prati jezik uređaja" i
 * ZADANA je vrijednost — vidi `resolveLanguage` u `src/i18n`.
 *
 * Zašto zaseban `system`, a ne samo razriješena vrijednost pri prvom
 * pokretanju: korisnik koji promijeni jezik telefona očekuje da ga
 * aplikacija slijedi. Kad bismo pri instalaciji zapisali "hr", ostala bi
 * hrvatska zauvijek, a on ne bi znao zašto.
 */
export type LanguageSetting = "system" | "hr" | "en";

type SettingsState = {
  theme: ThemeSetting;
  language: LanguageSetting;
  tempUnit: TempUnit;
  windUnit: WindUnit;
  setTheme: (theme: ThemeSetting) => void;
  setLanguage: (language: LanguageSetting) => void;
  setTempUnit: (unit: TempUnit) => void;
  setWindUnit: (unit: WindUnit) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      // Svijetla je zadana (odluka 6.8.2026.) — gradijenti heroja su
      // dizajnirani prvo za svijetlu; tamna ostaje izbor u postavkama.
      theme: "light",
      /*
       * Jezik prati SUSTAV dok ga korisnik ne dirne (Markov odabir
       * 6.8.2026.): hrvatski telefon → hrvatski, sve ostalo → engleski.
       * Razrješava se u `src/i18n`, jer store ne smije ovisiti o
       * expo-localization — testovi ga uvlače kao nativni modul.
       */
      language: "system",
      tempUnit: "C",
      /*
       * m/s je zadano (Markov odabir 6.8.2026.): DHMZ, pomorska prognoza i
       * Beaufortova skala u Hrvatskoj govore u m/s, pa i pragovi bure
       * (10 / 17 m/s) imaju smisla samo u toj jedinici. km/h ostaje izbor
       * u Postavkama.
       */
      windUnit: "ms",
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setTempUnit: (tempUnit) => set({ tempUnit }),
      setWindUnit: (windUnit) => set({ windUnit }),
    }),
    {
      name: "burin:settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
