import { Text, View } from "react-native";

import type { CurrentWeather } from "@/api/types";
import { t } from "@/i18n";
import type { TempUnit } from "@/utils/format";
import { convertTemp } from "@/utils/format";
import { codeToCondition } from "@/utils/weatherCodes";

/**
 * Potpis dizajna: ogromna tanka brojka temperature, sve ostalo tiho.
 */
export function Hero({
  placeName,
  current,
  nightMin,
  tempUnit,
}: {
  placeName: string;
  current: CurrentWeather;
  nightMin?: number;
  tempUnit: TempUnit;
}) {
  const condition = codeToCondition(current.code, current.isDay);
  const deg = (v: number) => `${Math.round(convertTemp(v, tempUnit))}°`;

  return (
    <View className="items-center gap-1 pt-6">
      <Text className="text-base text-ink/60 dark:text-paper/60">{placeName}</Text>
      <Text
        className="font-extralight text-ink dark:text-paper"
        style={{ fontSize: 96, lineHeight: 104, fontVariant: ["tabular-nums"] }}
      >
        {deg(current.temp)}
      </Text>
      <Text className="text-xl font-light text-ink dark:text-paper">
        {condition.label}
      </Text>
      <Text className="text-sm text-ink/60 dark:text-paper/60">
        {t.home.feelsLike} {deg(current.feelsLike)}
        {nightMin !== undefined ? `   ·   ${t.home.night} ${deg(nightMin)}` : ""}
      </Text>
    </View>
  );
}
