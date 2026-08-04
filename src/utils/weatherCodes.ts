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

type Entry = { label: string; day: LucideIcon; night?: LucideIcon };

const c = t.conditions;

/** WMO weather code -> hrvatski naziv + lucide ikona (dan/noć). */
const WMO_MAP: Record<number, Entry> = {
  0: { label: c.clear, day: Sun, night: Moon },
  1: { label: c.mostlyClear, day: SunDim, night: Moon },
  2: { label: c.partlyCloudy, day: CloudSun, night: CloudMoon },
  3: { label: c.overcast, day: Cloud },
  45: { label: c.fog, day: CloudFog },
  48: { label: c.fog, day: CloudFog },
  51: { label: c.drizzle, day: CloudDrizzle },
  53: { label: c.drizzle, day: CloudDrizzle },
  55: { label: c.drizzle, day: CloudDrizzle },
  56: { label: c.freezingDrizzle, day: CloudDrizzle },
  57: { label: c.freezingDrizzle, day: CloudDrizzle },
  61: { label: c.rainLight, day: CloudRain },
  63: { label: c.rain, day: CloudRain },
  65: { label: c.rainHeavy, day: CloudRain },
  66: { label: c.freezingRain, day: CloudHail },
  67: { label: c.freezingRain, day: CloudHail },
  71: { label: c.snow, day: CloudSnow },
  73: { label: c.snow, day: CloudSnow },
  75: { label: c.snow, day: CloudSnow },
  77: { label: c.snow, day: CloudSnow },
  80: { label: c.showers, day: CloudRainWind },
  81: { label: c.showers, day: CloudRainWind },
  82: { label: c.showers, day: CloudRainWind },
  85: { label: c.snowShowers, day: CloudSnow },
  86: { label: c.snowShowers, day: CloudSnow },
  95: { label: c.thunderstorm, day: CloudLightning },
  96: { label: c.thunderstormHail, day: CloudLightning },
  99: { label: c.thunderstormHail, day: CloudLightning },
};

export function codeToCondition(code: number, isDay: boolean): Condition {
  const entry = WMO_MAP[code];
  if (!entry) return { label: t.common.noData, Icon: Cloud };
  return {
    label: entry.label,
    Icon: !isDay && entry.night ? entry.night : entry.day,
  };
}
