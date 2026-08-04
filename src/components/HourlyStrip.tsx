import { ScrollView, Text, View } from "react-native";

import type { HourlyPoint } from "@/api/types";
import { t } from "@/i18n";
import type { TempUnit } from "@/utils/format";
import { convertTemp, formatHour } from "@/utils/format";
import { codeToCondition } from "@/utils/weatherCodes";
import { useThemeColors } from "@/theme/useThemeColors";

const BAR_MAX_HEIGHT = 32;

/**
 * Traka po satima: ikona stanja, temperatura i stupić vjerojatnosti oborina
 * s ispisanim postotkom. Stupić se crta od 1 % pa nadalje (prije je prag bio
 * 5 % i bez oznake, pa se činilo da "neki sati imaju točkicu bez razloga").
 */
export function HourlyStrip({
  hours,
  tempUnit,
}: {
  hours: HourlyPoint[];
  tempUnit: TempUnit;
}) {
  const { fg } = useThemeColors();
  const anyPrecip = hours.some((h) => h.precipProb >= 1);

  return (
    <View className="gap-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-1 pr-2">
          {hours.map((h) => {
            const { Icon } = codeToCondition(h.code, h.isDay);
            const hasRain = h.precipProb >= 1;
            const barHeight = hasRain
              ? Math.max(4, Math.round((h.precipProb / 100) * BAR_MAX_HEIGHT))
              : 0;
            return (
              <View key={h.time} className="w-12 items-center gap-1.5">
                <Text className="text-[10px] text-mint">
                  {hasRain ? `${Math.round(h.precipProb)}%` : " "}
                </Text>
                <View
                  className="w-1.5 justify-end"
                  style={{ height: BAR_MAX_HEIGHT }}
                >
                  {hasRain && (
                    <View
                      className="w-1.5 rounded-full bg-mint"
                      style={{ height: barHeight }}
                    />
                  )}
                </View>
                <Icon size={16} strokeWidth={1.5} color={fg} opacity={0.7} />
                <Text className="text-sm text-ink dark:text-paper">
                  {Math.round(convertTemp(h.temp, tempUnit))}°
                </Text>
                <Text className="text-xs text-ink/50 dark:text-paper/50">
                  {formatHour(h.time)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Text className="text-[11px] text-ink/40 dark:text-paper/40">
        {anyPrecip ? t.home.precipChanceHint : t.home.noPrecipNext24}
      </Text>
    </View>
  );
}
