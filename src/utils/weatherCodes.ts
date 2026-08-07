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

export function codeToCondition(code: number, isDay: boolean): Condition {
  const entry = WMO_MAP[code];
  if (!entry) return { label: t.common.noData, Icon: Cloud };
  return {
    // Čitanje ide kroz `t` SADA, pa prati aktivni jezik.
    label: t.conditions[entry.key],
    Icon: !isDay && entry.night ? entry.night : entry.day,
  };
}
