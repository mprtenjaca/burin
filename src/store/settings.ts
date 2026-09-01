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
  quips: boolean;
  setTheme: (theme: ThemeSetting) => void;
  setLanguage: (language: LanguageSetting) => void;
  setTempUnit: (unit: TempUnit) => void;
  setWindUnit: (unit: WindUnit) => void;
  setQuips: (on: boolean) => void;
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
      /*
       * Domaća rečenica na heroju je ISKLJUČENA dok je korisnik sam ne
       * upali (Markov odabir 1.9.2026.).
       *
       * Zašto zadano ne: tekst je namjerno grub i psuje (`quips.ts`), a
       * to je jedino mjesto gdje aplikacija ne izvještava nego govori.
       * Vrijeme je usluga koju netko otvori pred djetetom ili pokaže
       * kolegi — psovka koju nije tražio je promašaj kakav ostatak
       * aplikacije nigdje ne radi. Tko je želi, nađe je u Postavkama;
       * tko ne, nikad ne sazna da postoji.
       *
       * Praktična posljedica: zadana instalacija ima heroj kakav je bio
       * prije 10.8.2026. — rečenica se ne renderira uopće, ne zamjenjuje
       * se pristojnom inačicom.
       */
      quips: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setTempUnit: (tempUnit) => set({ tempUnit }),
      setWindUnit: (windUnit) => set({ windUnit }),
      setQuips: (quips) => set({ quips }),
    }),
    {
      name: "burin:settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
