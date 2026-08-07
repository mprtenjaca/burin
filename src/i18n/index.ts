import { en } from "./en";
import { hr } from "./hr";
import type { Dict } from "./hr";

/**
 * Jezici sučelja (6.8.2026.). Hrvatski je KANONSKI — njegov objekt je
 * izvor tipa `Dict`, pa svaki ključ koji nedostaje u drugom jeziku ruši
 * typecheck. Dodavanje jezika = jedan unos ovdje + jedna datoteka.
 */
export const DICTS = { hr, en } as const;

/** Jezik na koji se sučelje stvarno postavi (bez `system`). */
export type Language = keyof typeof DICTS;

/**
 * Jezik kad se sustav ne može pročitati. HRVATSKI, ne engleski: bez
 * `expo-localization` smo na starom buildu, a to je gotovo sigurno
 * Markov telefon tijekom razvoja — ne stranac.
 */
const FALLBACK: Language = "hr";

/**
 * Jezik uređaja → naš jezik. Hrvatski telefon dobiva hrvatski, SVE
 * OSTALO engleski (Markov odabir 6.8.2026.) — Nijemcu je engleski
 * čitljiviji od hrvatskog, pa engleski služi kao međunarodna rezerva.
 *
 * `expo-localization` se uvozi LIJENO i kroz `try` (6.8.2026.), jer je
 * NATIVNI modul: na dev buildu koji ga još nema `import` na vrhu
 * datoteke bi srušio cijelu aplikaciju s "Cannot find native module",
 * a `t` se uvozi u 28 datoteka — dakle svugdje.
 *
 * Ovako stari build i dalje radi (padne na hrvatski, ručni odabir
 * jezika u Postavkama i dalje radi normalno), a novi dobiva jezik
 * sustava čim se instalira. Bez ovog bi rebuild bio uvjet za pokretanje.
 */
export function resolveSystemLanguage(): Language {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require("expo-localization") as {
      getLocales: () => { languageCode?: string | null }[];
    };
    const code = getLocales()[0]?.languageCode;
    if (!code) return FALLBACK;
    return code === "hr" ? "hr" : "en";
  } catch {
    return FALLBACK;
  }
}

/**
 * AKTIVNI RJEČNIK — modul-razina, ne React state.
 *
 * Zašto ovako, a ne kroz context: `t` se koristi i u ČISTIM funkcijama
 * izvan React stabla (`format.ts`, `weatherLook.ts`, `weatherCodes.ts`),
 * koje nemaju pristup hookovima. Da je `t` hook, te bi funkcije morale
 * primati rječnik kao argument — svaka od njih, kroz cijeli lanac
 * pozivatelja.
 *
 * Zamjena je zato mutacija modula, a prerender osigurava `useLanguage`
 * (vidi dolje): store se promijeni → komponente se prerenderaju → čitaju
 * već zamijenjeni `t`. Redoslijed je zajamčen jer `setActiveLanguage`
 * zove `useSettings.subscribe`, koji se izvrši PRIJE nego zustand
 * obavijesti React pretplatnike.
 */
let active: Language = "hr";

/**
 * `t` je PROXY, ne obična referenca (6.8.2026.).
 *
 * Postojećih 28 datoteka radi `import { t } from "@/i18n"` i drži tu
 * referencu zauvijek — ES modul se veže jednom. Da je `t` obični objekt,
 * zamjena jezika ne bi stigla nikamo: sve bi datoteke i dalje pokazivale
 * na stari rječnik.
 *
 * Proxy svako čitanje preusmjeri na TRENUTNI rječnik, pa se ni jedan
 * pozivatelj ne mora mijenjati.
 */
export const t: Dict = new Proxy({} as Dict, {
  get: (_target, key) => DICTS[active][key as keyof Dict],
  // `has`/`ownKeys` da se objekt i dalje ponaša kao običan rječnik
  // (Object.keys, spread) — koristi se u testovima i pregledima.
  has: (_target, key) => key in DICTS[active],
  ownKeys: () => Reflect.ownKeys(DICTS[active]),
  getOwnPropertyDescriptor: (_target, key) =>
    Reflect.getOwnPropertyDescriptor(DICTS[active], key),
});

/** Trenutni jezik — za `key` na stablima koja se moraju prerenderati. */
export function currentLanguage(): Language {
  return active;
}

/** Postavlja aktivni rječnik. Zove ga `useLanguage`, ne pozivati ručno. */
export function setActiveLanguage(lang: Language): void {
  active = lang;
}

export type { Dict };
