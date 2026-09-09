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
  /*
   * PRETEŽNO VEDRO IMA OBLAK (9.9.2026., Markov nalaz: u traci sati u
   * 17 h ikona sunca uz 45 % naoblake, pa u 18 h odjednom oblak — „čudno
   * mi je to"). Do sada je 1 crtao `SunDim`, prigušeno sunce BEZ oblaka,
   * pa se od vedrog razlikovao samo nijansom koju nitko ne vidi na 21 px.
   *
   * Open-Meteo daje kod 1 i za ~45 % neba pod oblacima — to nije „vedro
   * samo malo manje", to je nebo s oblacima. Zato ista ikona kao 2:
   * razlika 1↔2 ostaje u nazivu („Pretežno vedro" / „Djelomično
   * oblačno") i u ambijentu (`cloudDensity`: sparse / medium), a ikona
   * u oba slučaja pošteno kaže da oblaka IMA. Noću isto: mjesec s
   * oblakom, ne goli mjesec.
   */
  1: { key: "mostlyClear", day: CloudSun, night: CloudMoon },
  2: { key: "partlyCloudy", day: CloudSun, night: CloudMoon },
  /*
   * 3.5 NIJE WMO kod — vlastiti razred „pretežno oblačno", dodan
   * 9.9.2026. (Markov nalaz: „ako DHMZ pokazuje pretežno oblačno, zašto
   * mi pokazujemo samo oblačno?").
   *
   * WMO ima četiri stupnja naoblake, DHMZ pet: između „djelomično
   * oblačno" (2) i „oblačno" (3) stoji „pretežno oblačno". Dosad se
   * mjereno „pretežno" svodilo na 3, što je govorilo više nego mjerenje.
   *
   * Razlomak, a ne slobodan cijeli broj (npr. 4): time razred SAM PO SEBI
   * kaže da je između 3 i 2, i ne može se zamijeniti s WMO kodom koji
   * jednog dana dobije značenje. Svaka usporedba tipa `code >= 3` ga
   * uključuje, `code === 3` ne — što je i ispravno, jer to nije oblačno
   * nebo. Dolazi ISKLJUČIVO iz mjerenja; model daje samo cijele WMO
   * stupnjeve.
   */
  3.5: { key: "mostlyCloudy", day: Cloud },
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
   * Naoblaka — DHMZ-ova ljestvica ima PET stupnjeva, WMO četiri:
   *   vedro → 0 · pretežno vedro → 1 · umjereno oblačno → 2 ·
   *   **pretežno oblačno → 3.5** · oblačno → 3
   *
   * 3.5 je vlastiti razred (vidi `WMO_MAP`), dodan 9.9.2026. jer se
   * mjereno „pretežno oblačno" dotad svodilo na „Oblačno" — što govori
   * više nego mjerenje. Sad aplikacija piše isto što i DHMZ.
   *
   * Redoslijed provjera je bitan: „pretežno vedro" sadrži i „vedro", pa
   * mora ispred njega; isto „pretežno oblačno" ispred golog „oblačno".
   */
  if (s.includes("pretežno oblačno")) return 3.5;
  if (s.includes("umjereno oblačno")) return 2;
  if (s.includes("pretežno vedro")) return 1;
  if (s.includes("vedro")) return 0;
  // Goli „oblačno" bez pridjeva — puna naoblaka.
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
