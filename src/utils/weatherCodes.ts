import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  SunDim,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { t } from "@/i18n";

export type Condition = { label: string; Icon: LucideIcon };

/** Ključ u `t.conditions` — ime se čita PRI POZIVU, ne ovdje. */
type ConditionKey = keyof typeof import("@/i18n/hr").hr.conditions;

type Entry = { key: ConditionKey; day: LucideIcon; night?: LucideIcon };

/**
 * WMO weather code → ključ naziva + lucide ikona (dan/noć).
 *
 * Tablica drži KLJUČ, ne gotov tekst (popravak 6.8.2026.). Prije je na
 * vrhu datoteke stajalo `const c = t.conditions`, pa su se imena
 * pročitala JEDNOM pri učitavanju modula i zamrznula na tadašnjem
 * jeziku — promjena jezika ih više nije doticala, iako je sve ostalo
 * (dani, smjerovi vjetra, sučelje) prelazilo ispravno.
 */
const WMO_MAP: Record<number, Entry> = {
  0: { key: "clear", day: Sun, night: Moon },
  1: { key: "mostlyClear", day: SunDim, night: Moon },
  2: { key: "partlyCloudy", day: CloudSun, night: CloudMoon },
  3: { key: "overcast", day: Cloud },
  45: { key: "fog", day: CloudFog },
  48: { key: "fog", day: CloudFog },
  51: { key: "drizzle", day: CloudDrizzle },
  53: { key: "drizzle", day: CloudDrizzle },
  55: { key: "drizzleHeavy", day: CloudDrizzle },
  56: { key: "freezingDrizzle", day: CloudDrizzle },
  57: { key: "freezingDrizzle", day: CloudDrizzle },
  61: { key: "rainLight", day: CloudRain },
  63: { key: "rain", day: CloudRain },
  65: { key: "rainHeavy", day: CloudRain },
  66: { key: "freezingRain", day: CloudHail },
  67: { key: "freezingRain", day: CloudHail },
  /*
   * WMO razlikuje jačinu snijega (71 slab / 73 umjeren / 75 jak), a
   * 77 su snježna ZRNCA — sve četvero je dosad pisalo samo "Snijeg"
   * (nađeno 6.8.2026. pri provjeri naziva).
   */
  71: { key: "snowLight", day: CloudSnow },
  73: { key: "snow", day: CloudSnow },
  75: { key: "snowHeavy", day: CloudSnow },
  77: { key: "snowGrains", day: CloudSnow },
  80: { key: "showersLight", day: CloudRainWind },
  81: { key: "showers", day: CloudRainWind },
  82: { key: "showersHeavy", day: CloudRainWind },
  85: { key: "snowShowers", day: CloudSnow },
  86: { key: "snowShowers", day: CloudSnow },
  95: { key: "thunderstorm", day: CloudLightning },
  96: { key: "thunderstormHail", day: CloudLightning },
  99: { key: "thunderstormHail", day: CloudLightning },
};

/**
 * DHMZ-ov OPIS VREMENA → WMO kod (9.9.2026.).
 *
 * Povod je Markov nalaz s prozora: aplikacija je za Zadar pisala
 * „djelomično oblačno" (WMO 2, iz modela) dok je DHMZ na istoj postaji
 * MJERIO „pretežno oblačno" — „jedva se ne bi od oblaka vidilo".
 *
 * Isto načelo koje projekt već primjenjuje na temperaturu
 * (`correctWithObservation`) i koje stoji u odlukama: **model nije
 * mjerenje.** ECMWF je za Roč davao „vedro" dok je Pazin javljao
 * grmljavinu. Naoblaka je upravo ono što postaja gleda, pa nema razloga
 * vjerovati modelu kad mjerenje postoji.
 *
 * Preslikava se SAMO naoblaka i oborina. DHMZ u isto polje stavlja i
 * opise VJETRA („lahor", „povjetarac", „slab vjetar") — ti ne govore
 * ništa o nebu i vraćaju `undefined`, pa ostaje model. Isto za „-".
 *
 * Popis je sastavljen iz PRAVOG feeda (`hrvatska_n.xml`, 9.9.2026.: 13
 * različitih opisa na 66 postaja), ne iz dokumentacije — DHMZ ne objavljuje
 * šifrarnik. Nepoznat opis zato NE ruši ništa, samo prepusti modelu.
 */
export function dhmzTextToCode(text?: string): number | undefined {
  if (!text) return undefined;
  const s = text.toLowerCase().trim();
  if (!s || s === "-") return undefined;

  /*
   * Oborina i grmljavina IDU PRVE: „slaba kiša poslije grmlj." nosi oba
   * pojma, a kiša je ono što korisnik trenutno ima nad glavom.
   * „grmljavina bez oborina" se namjerno ne prevodi u kod s kišom.
   */
  if (s.includes("snij") || s.includes("susnj")) return 73;
  // 95 pokriva i „bez oborina": WMO 95 je grmljavina, kiša u njoj nije
  // obećana — a značka i ambijent grmljavine su ono što korisnik treba.
  if (s.includes("grmljavin")) return 95;
  if (s.includes("pljusak") || s.includes("pljuskov")) return 81;
  if (s.includes("rosulj")) return 51;
  if (s.includes("kiša") || s.includes("kise") || s.includes("kiše")) {
    return s.includes("slab") ? 61 : 63;
  }
  if (s.includes("magla") || s.includes("sumagl")) return 45;

  /*
   * Naoblaka — DHMZ-ova ljestvica na WMO:
   *   vedro → 0 · pretežno vedro → 1 · umjereno oblačno → 2 ·
   *   pretežno oblačno → 3 · oblačno → 3
   *
   * „pretežno oblačno" je namjerno 3 („oblačno"), a ne 2: hrvatski
   * „pretežno" znači VEĆI dio neba pod oblacima, što je upravo ono što je
   * Marko vidio kroz prozor. Redoslijed provjera je bitan — „pretežno
   * vedro" sadrži i „vedro", pa mora ispred njega.
   */
  if (s.includes("pretežno oblačno") || s.includes("oblačno bez")) return 3;
  if (s.includes("umjereno oblačno")) return 2;
  if (s.includes("pretežno vedro")) return 1;
  if (s.includes("vedro")) return 0;
  // Goli „oblačno" bez pridjeva (nije viđen u feedu, ali je moguć).
  if (s.includes("oblačno")) return 3;

  return undefined;
}

export function codeToCondition(code: number, isDay: boolean): Condition {
  const entry = WMO_MAP[code];
  if (!entry) return { label: t.common.noData, Icon: Cloud };
  return {
    // Čitanje ide kroz `t` SADA, pa prati aktivni jezik.
    label: t.conditions[entry.key],
    Icon: !isDay && entry.night ? entry.night : entry.day,
  };
}
