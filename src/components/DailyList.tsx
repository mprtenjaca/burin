import { ChevronDown } from "lucide-react-native";
import { Fragment, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { DailyPoint, HourlyPoint } from "@/api/types";
import { t } from "@/i18n";
import { colors } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import type { TempUnit, WindUnit } from "@/utils/format";
import { convertTemp, formatDayShort } from "@/utils/format";
import { codeToCondition } from "@/utils/weatherCodes";
import { ACCENT_CORAL } from "@/utils/weatherLook";

import { DayDetails } from "./DayDetails";
import { Hairline } from "./Section";

/** Širine kolona — dijele ih zaglavlje i redovi da poravnanje drži. */
const KOL_DAN = 74;
const KOL_IKONA = 21;
const KOL_OBOR = 48;
const KOL_TEMP = 38;

/**
 * 14 dana: dan, ikona, % oborina, min–max s trakom raspona (raspon dana
 * unutar raspona svih 14 dana). Dodir na red otvara razdoblja dana s
 * pojedinostima.
 */
export function DailyList({
  days,
  hourly,
  tempUnit,
  windUnit,
}: {
  days: DailyPoint[];
  hourly: HourlyPoint[];
  tempUnit: TempUnit;
  windUnit: WindUnit;
}) {
  const { fg } = useThemeColors();
  const [openDate, setOpenDate] = useState<string | null>(null);
  const allMin = Math.min(...days.map((d) => d.tMin));
  const allMax = Math.max(...days.map((d) => d.tMax));
  const span = Math.max(1, allMax - allMin);
  /*
   * Ovdje NAMJERNO ostaje samo ° bez slova jedinice (6.8.2026.): kolone
   * MIN/MAX su široke 38 px (KOL_TEMP), a "-15°F" u dvije kolone jedna do
   * druge se ne uklopi — izmjereno da bi se odrezalo. Jedinica se čita s
   * heroja i iz Postavki; u ovoj tablici je nedvosmislena.
   */
  const deg = (v: number) => `${Math.round(convertTemp(v, tempUnit))}°`;

  return (
    <View className="rounded-2xl bg-white px-4 py-2 dark:bg-coal">
      {/* Zaglavlje kolona — bez njega se nije znalo što je postotak. */}
      {/*
        Zaglavlje i redovi dijele ISTE širine kolona (KOL_*), pa MIN i MAX
        stoje točno iznad svojih brojki. Traka raspona uzima ostatak
        (`flex-1`) — bez fiksne granice bi se poravnanje razišlo.
      */}
      <View className="flex-row items-center gap-2.5 pb-1.5 pt-1">
        <View style={{ width: KOL_DAN }} />
        <View style={{ width: KOL_IKONA }} />
        <Text
          className="text-right font-grotesk-medium text-[12.5px] text-ink/55 dark:text-paper/55"
          style={{ width: KOL_OBOR }}
        >
          {t.home.precipShort}
        </Text>
        <View className="flex-1" />
        <Text
          className="text-right font-grotesk-medium text-[12.5px] text-ink/55 dark:text-paper/55"
          style={{ width: KOL_TEMP }}
        >
          {t.home.minShort}
        </Text>
        <Text
          className="text-right font-grotesk-medium text-[12.5px] text-ink/55 dark:text-paper/55"
          style={{ width: KOL_TEMP }}
        >
          {t.home.maxShort}
        </Text>
      </View>
      {days.map((d, i) => {
        const { Icon } = codeToCondition(d.code, true);
        const left = ((d.tMin - allMin) / span) * 100;
        const width = Math.max(4, ((d.tMax - d.tMin) / span) * 100);
        const dayLabel =
          i === 0 ? t.common.today : i === 1 ? t.common.tomorrow : formatDayShort(d.date);
        const isOpen = openDate === d.date;
        return (
          <Fragment key={d.date}>
            {i > 0 && <Hairline />}
            <Pressable
              onPress={() => setOpenDate(isOpen ? null : d.date)}
              className="flex-row items-center gap-2.5 py-3"
            >
              <View
                className="flex-row items-center gap-1"
                style={{ width: KOL_DAN }}
              >
                <Text className="font-grotesk-medium text-[16px] text-ink dark:text-paper">
                  {dayLabel}
                </Text>
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  color={isOpen ? ACCENT_CORAL : fg}
                  opacity={isOpen ? 1 : 0.35}
                  style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
                />
              </View>
              <View style={{ width: KOL_IKONA }}>
                <Icon size={21} strokeWidth={2} color={fg} opacity={0.75} />
              </View>
              <Text
                className={`text-right font-grotesk-medium text-[14px] ${
                  d.precipProbMax >= 1 ? "" : "text-ink/25 dark:text-paper/25"
                }`}
                style={[
                  { width: KOL_OBOR },
                  d.precipProbMax >= 1 ? { color: ACCENT_CORAL } : null,
                ]}
              >
                {d.precipProbMax >= 1 ? `${Math.round(d.precipProbMax)} %` : "–"}
              </Text>
              {/* Traka uzima ostatak reda — brojke ostaju na kraju. */}
              <View className="h-1 flex-1 rounded-full bg-ink/10 dark:bg-paper/10">
                <View
                  className="absolute h-1 rounded-full"
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: "#EE9A3E" }}
                />
              </View>
              <Text
                className="text-right font-grotesk-medium text-[16px] text-ink/60 dark:text-paper/60"
                style={{ width: KOL_TEMP }}
              >
                {deg(d.tMin)}
              </Text>
              <Text
                className="text-right font-grotesk-bold text-[16px] text-ink dark:text-paper"
                style={{ width: KOL_TEMP }}
              >
                {deg(d.tMax)}
              </Text>
            </Pressable>
            {isOpen && (
              <DayDetails
                day={d}
                hourly={hourly}
                tempUnit={tempUnit}
                windUnit={windUnit}
              />
            )}
          </Fragment>
        );
      })}
    </View>
  );
}
