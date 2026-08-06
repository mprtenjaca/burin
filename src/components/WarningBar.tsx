import { router } from "expo-router";
import {
  CloudFog,
  CloudRain,
  Flame,
  Mountain,
  Snowflake,
  Sun,
  ThermometerSnowflake,
  TriangleAlert,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, Text } from "react-native";

import type { MeteoWarning } from "@/api/meteoalarm";
import { warningColor, warningFg } from "@/utils/weatherLook";

/**
 * Meteoalarm awareness_type → ikona. Nepoznata vrsta pada na opći
 * trokut — feed smije uvesti novu vrstu bez da išta pukne.
 */
const TYPE_ICONS: Record<number, LucideIcon> = {
  1: Wind,
  2: Snowflake,
  3: Zap,
  4: CloudFog,
  5: Sun,
  6: ThermometerSnowflake,
  7: Waves,
  8: Flame,
  9: Mountain,
  10: CloudRain,
  12: Waves,
  13: CloudRain,
};

export function warningIcon(type: number): LucideIcon {
  return TYPE_ICONS[type] ?? TriangleAlert;
}

/**
 * Traka upozorenja u heroju (dizajn 6.8.2026.): između imena mjesta i
 * velike brojke, u boji razine, prikazuje NAJTEŽE upozorenje; "+N" kaže
 * da ih ima još. Dodir vodi na ekran Upozorenja. Bez upozorenja se ne
 * renderira — heroj tada izgleda kao prije.
 */
export function WarningBar({ warnings }: { warnings: MeteoWarning[] }) {
  const top = warnings[0];
  if (!top) return null;

  const fg = warningFg(top.level);
  const Icon = warningIcon(top.type);
  const extra = warnings.length - 1;

  return (
    <Pressable
      onPress={() => router.navigate("/warnings")}
      accessibilityRole="button"
      accessibilityLabel={top.event}
      className="mt-2.5 flex-row items-center gap-2 rounded-full px-4 py-2"
      style={{ backgroundColor: warningColor(top.level) }}
    >
      <Icon size={16} strokeWidth={2.5} color={fg} />
      <Text className="font-grotesk-bold text-[13.5px]" style={{ color: fg }}>
        {top.event}
        {extra > 0 ? `  +${extra}` : ""}
      </Text>
    </Pressable>
  );
}
