import { router } from "expo-router";
import { ChevronRight, CloudFog, CloudRain, Flame, Mountain, Snowflake, Sun, ThermometerSnowflake, TriangleAlert, Waves, Wind, Zap, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

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
 * Značka upozorenja u heroju: između imena mjesta i velike brojke, u
 * boji razine, ikona NAJTEŽEG upozorenja + strelica. Dodir vodi na
 * ekran Upozorenja. Bez upozorenja se ne renderira — heroj tada
 * izgleda kao prije.
 *
 * Bila je pilula s imenom događaja i "+N" (do 13.8.2026.) — Marko na
 * uređaju: s tekstom "izgleda ko da nije to to". Naziv iz Meteoalarma
 * zna biti dug i birokratski ("Upozorenje na grmljavinsko nevrijeme"),
 * pa je pilula bila najširi element heroja i tukla se s tipografskom
 * osi. Sad boja kaže razinu, ikona vrstu, a strelica da se klika —
 * detalji su jedan dodir dalje. Puni naziv ostaje u
 * `accessibilityLabel`, čitači ekrana ga i dalje izgovaraju.
 */
export function WarningBar({ warnings }: { warnings: MeteoWarning[] }) {
  const top = warnings[0];
  if (!top) return null;

  const fg = warningFg(top.level);
  const Icon = warningIcon(top.type);

  return (
    <Pressable
      onPress={() => router.navigate("/warnings")}
      accessibilityRole="button"
      accessibilityLabel={top.event}
      className="mt-2.5 flex-row items-center gap-1 rounded-full py-2 pl-3.5 pr-2"
      style={{ backgroundColor: warningColor(top.level) }}
    >
      {/* Ikona bez dodira — SVG na Androidu zna progutat dodir Pressableu. */}
      <View pointerEvents="none" className="flex-row items-center gap-1">
        <Icon size={16} strokeWidth={2.5} color={fg} />
        {/* Strelica malo prigušena: pokazuje smjer, ne nosi informaciju. */}
        <ChevronRight size={14} strokeWidth={2.5} color={fg} opacity={0.7} />
      </View>
    </Pressable>
  );
}
