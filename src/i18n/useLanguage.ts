import { useSettings } from "@/store/settings";

import { currentLanguage, resolveSystemLanguage, setActiveLanguage } from "./index";
import type { Language } from "./index";

/**
 * Aktivni jezik sučelja iz postavki (6.8.2026.).
 *
 * Radi DVIJE stvari u istom pozivu:
 *  1. razriješi postavku (`system` → jezik uređaja) i
 *  2. postavi modul-razinski `t` PRIJE nego komponenta nastavi crtati.
 *
 * Točka 2. je bitna i mora se dogoditi u tijelu rendera, ne u efektu:
 * `useEffect` se izvrši TEK NAKON što je stablo nacrtano, pa bi prvi
 * kadar nakon promjene jezika još čitao stari rječnik — vidjelo bi se
 * kao bljesak hrvatskog teksta pri prebacivanju na engleski.
 *
 * Vraća jezik da ga pozivatelj može staviti u `key` i time prisiliti
 * ponovno montiranje podstabla — vidi `app/_layout.tsx`.
 */
export function useLanguage(): Language {
  const setting = useSettings((s) => s.language);
  const lang: Language = setting === "system" ? resolveSystemLanguage() : setting;
  if (currentLanguage() !== lang) setActiveLanguage(lang);
  return lang;
}
