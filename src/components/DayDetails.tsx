import { Droplets, Gauge, SunMedium, Wind } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { DailyPoint, HourlyPoint } from "@/api/types";
import { t } from "@/i18n";
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
import { ACCENT_CORAL } from "@/utils/weatherLook";

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
    <View className="flex-row items-center gap-3 py-2">
      <Icon size={18} strokeWidth={2} color={fg} opacity={0.55} />
      <Text className="flex-1 font-grotesk-medium text-[14px] text-ink/65 dark:text-paper/65">
        {label}
      </Text>
      <Text className="font-grotesk-medium text-[14px] text-ink dark:text-paper">
        {value}
      </Text>
    </View>
  );
}

/**
 * Detalji odabranog dana (redizajn 6.8.2026.): razdoblja dana kao odabirni
 * stupci, ispod pojedinosti odabranog razdoblja. Isti jezik kao ostatak
 * ekrana — Space Grotesk, koraljni akcent, veći tekstovi za čitljivost.
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
        <Text className="text-center font-grotesk-medium text-[13px] text-ink/50 dark:text-paper/50">
          {t.common.noData}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3 pb-3 pt-1">
      {/* Razdoblja dana: aktivno je ispunjeno koraljnom, ne samo obrubljeno. */}
      <View className="flex-row gap-2">
        {parts.map((part) => {
          const { Icon } = codeToCondition(part.code, part.isDay);
          const isActive = part.id === active?.id;
          return (
            <Pressable
              key={part.id}
              onPress={() => setActiveId(part.id)}
              className={`flex-1 items-center gap-1.5 rounded-2xl px-1 py-3 ${
                isActive ? "" : "bg-ink/[0.04] dark:bg-paper/[0.06]"
              }`}
              style={isActive ? { backgroundColor: ACCENT_CORAL } : undefined}
            >
              {/* Kratica + raspon sati: puni naziv u uski stupac ne stane. */}
              <Text
                numberOfLines={1}
                className={`font-grotesk-bold text-[13px] ${
                  isActive ? "text-white" : "text-ink/70 dark:text-paper/70"
                }`}
              >
                {part.shortLabel}
              </Text>
              <Text
                className={`font-grotesk text-[10.5px] ${
                  isActive ? "text-white/75" : "text-ink/45 dark:text-paper/45"
                }`}
                style={{ marginTop: -4 }}
              >
                {part.rangeLabel}
              </Text>
              <Text
                className={`font-grotesk-bold text-[21px] ${
                  isActive ? "text-white" : "text-ink dark:text-paper"
                }`}
              >
                {deg(part.temp)}
              </Text>
              <Icon
                size={20}
                strokeWidth={2}
                color={isActive ? "#FFFFFF" : fg}
                opacity={isActive ? 0.95 : 0.7}
              />
              <Text
                className={`font-grotesk-medium text-[12px] ${
                  isActive
                    ? "text-white/90"
                    : part.precipProb >= 1
                      ? "text-ink/70 dark:text-paper/70"
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
        <View className="gap-0.5 rounded-2xl bg-ink/[0.04] px-4 py-3 dark:bg-paper/[0.06]">
          <Text className="pb-1 font-grotesk-bold text-[13px] text-ink/55 dark:text-paper/55">
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
        <Text className="font-grotesk-medium text-[12.5px] text-ink/60 dark:text-paper/60">
          {t.home.sunrise} {formatTime(day.sunrise)}
        </Text>
        <Text className="font-grotesk-medium text-[12.5px] text-ink/60 dark:text-paper/60">
          {t.home.sunset} {formatTime(day.sunset)}
        </Text>
      </View>
    </View>
  );
}
