import { ScrollView, Text, View } from "react-native";

import type { HourlyPoint } from "@/api/types";
import type { TempUnit } from "@/utils/format";
import { convertTemp, formatHour } from "@/utils/format";

const BAR_MAX_HEIGHT = 28;

/**
 * Traka po satima: temperatura + mint stupić vjerojatnosti oborina
 * ispod svakog sata (stil stupčastog grafa).
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
          const barHeight =
            h.precipProb >= 5
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
                {barHeight > 0 ? (
                  <View
                    className="w-1.5 rounded-full bg-mint"
                    style={{ height: barHeight }}
                  />
                ) : (
                  <View className="h-[3px] w-1.5 rounded-full bg-ink/10 dark:bg-paper/10" />
                )}
              </View>
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
