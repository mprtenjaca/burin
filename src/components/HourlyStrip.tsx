import { ScrollView, Text, View } from "react-native";

import type { HourlyPoint } from "@/api/types";
import { useThemeColors } from "@/theme/useThemeColors";
import type { TempUnit } from "@/utils/format";
import { convertTemp, formatHour } from "@/utils/format";
import { codeToCondition } from "@/utils/weatherCodes";

/**
 * Traka po satima (redizajn 6.8.2026.): čiste kolone temperatura / ikona /
 * % oborina / sat, bez kartice i linija, horizontalni scroll. Veličine su
 * namjerno izdašne — aplikaciju koriste i stariji (dorada 6.8.2026.);
 * kolone su zato i šire, s razmakom, da se satnice ne sudaraju.
 *
 * Oborine se ispisuju UVIJEK (0 % prigušeno) — praznina je izgledala kao
 * da podatak fali.
 */
export function HourlyStrip({
  hours,
  tempUnit,
  accent,
}: {
  hours: HourlyPoint[];
  tempUnit: TempUnit;
  /** Boja postotka oborina — na heroju ovisi o pozadini (heroAccent). */
  accent: string;
}) {
  const { fg } = useThemeColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 14 }}
    >
      <View className="flex-row">
        {hours.map((h) => {
          const { Icon } = codeToCondition(h.code, h.isDay);
          const hasRain = h.precipProb >= 1;
          return (
            <View
              key={h.time}
              className="w-[64px] items-center px-1"
              style={{ marginRight: 6 }}
            >
              <Text className="font-grotesk-bold text-[16px] text-ink dark:text-paper">
                {Math.round(convertTemp(h.temp, tempUnit))}°
              </Text>
              <View className="my-1.5">
                <Icon size={21} strokeWidth={2} color={fg} opacity={0.9} />
              </View>
              <Text
                className={`font-grotesk-medium text-[12px] ${
                  hasRain ? "" : "text-ink/35 dark:text-paper/35"
                }`}
                style={hasRain ? { color: accent } : undefined}
              >
                {Math.round(h.precipProb)}%
              </Text>
              <Text className="font-grotesk-medium text-[13px] text-ink/70 dark:text-paper/70">
                {formatHour(h.time)}:00
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
