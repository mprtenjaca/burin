import { Droplets, Gauge, SunMedium, Wind } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { DailyPoint, HourlyPoint } from "@/api/types";
import { t } from "@/i18n";
import { colors } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import type { DayPart } from "@/utils/dayParts";
import { buildDayParts } from "@/utils/dayParts";
import type { TempUnit, WindUnit } from "@/utils/format";
import {
  convertTemp,
  convertWind,
  formatTime,
  windDirLabel,
  windUnitLabel,
} from "@/utils/format";
import { codeToCondition } from "@/utils/weatherCodes";

import { Hairline } from "./Section";

function Row({
  Icon,
  label,
  value,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
}) {
  const { fg } = useThemeColors();
  return (
    <View className="flex-row items-center gap-2.5 py-1.5">
      <Icon size={15} strokeWidth={1.5} color={fg} opacity={0.5} />
      <Text className="flex-1 text-[13px] text-ink/60 dark:text-paper/60">
        {label}
      </Text>
      <Text className="text-[13px] text-ink dark:text-paper">{value}</Text>
    </View>
  );
}

/**
 * Detalji odabranog dana: razdoblja dana kao odabirni stupci, a ispod
 * pojedinosti odabranog razdoblja (oborine, vjetar, tlak, vlaga, osjet).
 */
export function DayDetails({
  day,
  hourly,
  tempUnit,
  windUnit,
}: {
  day: DailyPoint;
  hourly: HourlyPoint[];
  tempUnit: TempUnit;
  windUnit: WindUnit;
}) {
  const { fg } = useThemeColors();
  const parts = buildDayParts(hourly, day.date);
  const [activeId, setActiveId] = useState<string | null>(parts[0]?.id ?? null);
  const active: DayPart | undefined =
    parts.find((p) => p.id === activeId) ?? parts[0];

  const deg = (v: number) => `${Math.round(convertTemp(v, tempUnit))}°`;
  const wind = (v: number) =>
    `${Math.round(convertWind(v, windUnit))} ${windUnitLabel(windUnit)}`;

  if (parts.length === 0) {
    return (
      <View className="py-4">
        <Text className="text-center text-xs text-ink/40 dark:text-paper/40">
          {t.common.noData}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3 pb-3 pt-1">
      <View className="flex-row gap-2">
        {parts.map((part) => {
          const { Icon } = codeToCondition(part.code, part.isDay);
          const isActive = part.id === active?.id;
          return (
            <Pressable
              key={part.id}
              onPress={() => setActiveId(part.id)}
              className={`flex-1 items-center gap-1.5 rounded-2xl border py-2.5 ${
                isActive
                  ? "border-mint"
                  : "border-ink/[0.08] dark:border-paper/10"
              }`}
            >
              <Text
                className={`text-[11px] ${
                  isActive ? "text-mint" : "text-ink/50 dark:text-paper/50"
                }`}
              >
                {part.label}
              </Text>
              <Text className="text-lg font-light text-ink dark:text-paper">
                {deg(part.temp)}
              </Text>
              <Icon size={16} strokeWidth={1.5} color={fg} opacity={0.7} />
              <Text
                className={`text-[10px] ${
                  part.precipProb >= 1
                    ? "text-mint"
                    : "text-ink/30 dark:text-paper/30"
                }`}
              >
                {part.precipProb >= 1 ? `${Math.round(part.precipProb)}%` : "–"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {active && (
        <View className="gap-1 rounded-2xl border border-ink/[0.08] px-3.5 py-2.5 dark:border-paper/10">
          <Text className="pb-1 text-[11px] uppercase tracking-[1.5px] text-ink/40 dark:text-paper/40">
            {active.label} — {codeToCondition(active.code, active.isDay).label}
          </Text>
          <Row
            Icon={Droplets}
            label={t.metrics.precipitation}
            value={`${Math.round(active.precipProb)} % · ${active.precipSum} mm`}
          />
          <Hairline />
          <Row
            Icon={Wind}
            label={t.metrics.wind}
            value={`${wind(active.windSpeed)} ${windDirLabel(active.windDir)} · ${t.home.gusts} ${wind(active.windGusts)}`}
          />
          <Hairline />
          <Row
            Icon={Gauge}
            label={t.metrics.pressure}
            value={`${active.pressure} hPa · ${t.metrics.humidity} ${active.humidity} %`}
          />
          <Hairline />
          <Row
            Icon={SunMedium}
            label={t.home.feelsLike}
            value={`${deg(active.feelsLike)}${active.uv >= 1 ? ` · ${t.metrics.uv} ${Math.round(active.uv)}` : ""}`}
          />
        </View>
      )}

      <View className="flex-row justify-between px-1">
        <Text className="text-[11px] text-ink/40 dark:text-paper/40">
          {t.home.sunrise} {formatTime(day.sunrise)}
        </Text>
        <Text className="text-[11px] text-ink/40 dark:text-paper/40">
          {t.home.sunset} {formatTime(day.sunset)}
        </Text>
      </View>
    </View>
  );
}
