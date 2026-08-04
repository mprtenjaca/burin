import { Fragment } from "react";
import { Text, View } from "react-native";

import type { DailyPoint } from "@/api/types";
import { t } from "@/i18n";
import { useThemeColors } from "@/theme/useThemeColors";
import type { TempUnit } from "@/utils/format";
import { convertTemp, formatDayShort } from "@/utils/format";
import { codeToCondition } from "@/utils/weatherCodes";

import { Hairline } from "./Section";

/**
 * 14 dana: dan, ikona, % oborina, min–max s malom trakom raspona
 * (raspon dana unutar raspona svih 14 dana).
 */
export function DailyList({
  days,
  tempUnit,
}: {
  days: DailyPoint[];
  tempUnit: TempUnit;
}) {
  const { fg } = useThemeColors();
  const allMin = Math.min(...days.map((d) => d.tMin));
  const allMax = Math.max(...days.map((d) => d.tMax));
  const span = Math.max(1, allMax - allMin);
  const deg = (v: number) => `${Math.round(convertTemp(v, tempUnit))}°`;

  return (
    <View>
      {/* Zaglavlje kolona — bez njega se nije znalo što je postotak. */}
      <View className="flex-row items-center gap-3 pb-1.5">
        <View className="w-[72px]" />
        <View style={{ width: 18 }} />
        <Text className="w-10 text-right text-[10px] uppercase tracking-wider text-ink/40 dark:text-paper/40">
          {t.home.precipShort}
        </Text>
        <View className="flex-1" />
        <Text className="w-8 text-right text-[10px] uppercase tracking-wider text-ink/40 dark:text-paper/40">
          {t.home.minShort}
        </Text>
        <Text className="w-8 text-right text-[10px] uppercase tracking-wider text-ink/40 dark:text-paper/40">
          {t.home.maxShort}
        </Text>
      </View>
      {days.map((d, i) => {
        const { Icon } = codeToCondition(d.code, true);
        const left = ((d.tMin - allMin) / span) * 100;
        const width = Math.max(4, ((d.tMax - d.tMin) / span) * 100);
        const dayLabel =
          i === 0 ? t.common.today : i === 1 ? t.common.tomorrow : formatDayShort(d.date);
        return (
          <Fragment key={d.date}>
            {i > 0 && <Hairline />}
            <View className="flex-row items-center gap-3 py-2.5">
              <Text className="w-[72px] text-[15px] text-ink dark:text-paper">
                {dayLabel}
              </Text>
              <Icon size={18} strokeWidth={1.5} color={fg} opacity={0.7} />
              <Text
                className={`w-10 text-right text-xs ${
                  d.precipProbMax >= 1 ? "text-mint" : "text-ink/25 dark:text-paper/25"
                }`}
              >
                {d.precipProbMax >= 1 ? `${Math.round(d.precipProbMax)} %` : "–"}
              </Text>
              <View className="h-1 flex-1 rounded-full bg-ink/10 dark:bg-paper/10">
                <View
                  className="absolute h-1 rounded-full bg-ink/40 dark:bg-paper/50"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </View>
              <Text className="w-8 text-right text-[15px] text-ink/50 dark:text-paper/50">
                {deg(d.tMin)}
              </Text>
              <Text className="w-8 text-right text-[15px] text-ink dark:text-paper">
                {deg(d.tMax)}
              </Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}
