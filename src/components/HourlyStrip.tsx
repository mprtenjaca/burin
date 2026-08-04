import { ScrollView, Text, View } from "react-native";

import type { HourlyPoint } from "@/api/types";
import type { TempUnit } from "@/utils/format";
import { convertTemp, formatHour } from "@/utils/format";

const BAR_MAX_HEIGHT = 28;

/**
 * Traka po satima: temperatura, mint stupić vjerojatnosti oborina i ispisan
 * postotak ispod stupića (bez postotka se nije znalo što stupić znači).
 */
export function HourlyStrip({
  hours,
  tempUnit,
}: {
  hours: HourlyPoint[];
  tempUnit: TempUnit;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-1 pr-2">
        {hours.map((h) => {
          const hasRain = h.precipProb >= 1;
          const barHeight = hasRain
            ? Math.max(3, Math.round((h.precipProb / 100) * BAR_MAX_HEIGHT))
            : 0;
          return (
            <View key={h.time} className="w-11 items-center gap-1.5">
              <Text className="text-sm text-ink dark:text-paper">
                {Math.round(convertTemp(h.temp, tempUnit))}°
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
              <Text className="text-[10px] text-mint">
                {hasRain ? `${Math.round(h.precipProb)}%` : " "}
              </Text>
              <Text className="text-xs text-ink/50 dark:text-paper/50">
                {formatHour(h.time)}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
