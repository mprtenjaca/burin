import { Droplets, Gauge, SunMedium, Wind } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import type { CurrentWeather } from "@/api/types";
import { t } from "@/i18n";
import { useThemeColors } from "@/theme/useThemeColors";
import type { WindUnit } from "@/utils/format";
import { convertWind, windDirLabel, windUnitLabel } from "@/utils/format";

function Metric({
  Icon,
  value,
  label,
  fg,
}: {
  Icon: LucideIcon;
  value: string;
  label: string;
  fg: string;
}) {
  return (
    <View className="flex-1 items-center gap-1">
      <Icon size={18} strokeWidth={1.5} color={fg} opacity={0.55} />
      <Text className="text-[15px] text-ink dark:text-paper">{value}</Text>
      <Text className="text-xs text-ink/50 dark:text-paper/50">{label}</Text>
    </View>
  );
}

/** Kompaktni red metrika: Vjetar / Vlaga / Tlak / UV indeks. */
export function MetricsRow({
  current,
  uv,
  windUnit,
}: {
  current: CurrentWeather;
  uv?: number;
  windUnit: WindUnit;
}) {
  const { fg } = useThemeColors();
  const wind = `${Math.round(convertWind(current.windSpeed, windUnit))} ${windUnitLabel(windUnit)} ${windDirLabel(current.windDir)}`;

  return (
    <View className="flex-row py-2">
      <Metric Icon={Wind} value={wind} label={t.metrics.wind} fg={fg} />
      <Metric Icon={Droplets} value={`${Math.round(current.humidity)} %`} label={t.metrics.humidity} fg={fg} />
      <Metric Icon={Gauge} value={`${Math.round(current.pressure)} hPa`} label={t.metrics.pressure} fg={fg} />
      <Metric Icon={SunMedium} value={uv !== undefined ? `${Math.round(uv * 10) / 10}` : "–"} label={t.metrics.uv} fg={fg} />
    </View>
  );
}
