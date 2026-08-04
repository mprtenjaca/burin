import { Sunrise, Sunset } from "lucide-react-native";
import { Text, View } from "react-native";

import { useThemeColors } from "@/theme/useThemeColors";
import { formatTime, parseLocal } from "@/utils/format";

/**
 * Izlazak -> zalazak sunca: tanka linija s točkom na trenutnoj poziciji
 * sunca, vremena na oba kraja.
 */
export function SunCycle({
  sunrise,
  sunset,
  now = new Date(),
}: {
  sunrise: string;
  sunset: string;
  now?: Date;
}) {
  const { fg } = useThemeColors();
  const rise = parseLocal(sunrise).getTime();
  const set = parseLocal(sunset).getTime();
  const span = set - rise;
  const pct =
    span > 0 ? Math.min(1, Math.max(0, (now.getTime() - rise) / span)) : 0;
  const isDaytime = now.getTime() >= rise && now.getTime() <= set;

  return (
    <View className="gap-2 py-1">
      <View className="h-2 justify-center">
        <View className="h-px bg-ink/20 dark:bg-paper/20" />
        {isDaytime && (
          <View
            className="absolute h-2 w-2 rounded-full bg-mint"
            style={{ left: `${pct * 100}%`, marginLeft: -4 }}
          />
        )}
      </View>
      <View className="flex-row justify-between">
        <View className="flex-row items-center gap-1.5">
          <Sunrise size={14} strokeWidth={1.5} color={fg} opacity={0.55} />
          <Text className="text-xs text-ink/60 dark:text-paper/60">
            {formatTime(sunrise)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-xs text-ink/60 dark:text-paper/60">
            {formatTime(sunset)}
          </Text>
          <Sunset size={14} strokeWidth={1.5} color={fg} opacity={0.55} />
        </View>
      </View>
    </View>
  );
}
