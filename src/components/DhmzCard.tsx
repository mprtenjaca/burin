import { Text, View } from "react-native";

import type { DhmzObservation } from "@/api/types";
import { t } from "@/i18n";
import type { WindUnit } from "@/utils/format";
import { windUnitLabel } from "@/utils/format";

/** DHMZ međunarodne kratice smjera -> hrvatske. */
const DIR_HR: Record<string, string> = {
  N: "S",
  NE: "SI",
  E: "I",
  SE: "JI",
  S: "J",
  SW: "JZ",
  W: "Z",
  NW: "SZ",
};

function Value({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-1">
      <Text className="text-[15px] text-ink dark:text-paper">{value}</Text>
      <Text className="text-xs text-ink/50 dark:text-paper/50">{label}</Text>
    </View>
  );
}

/**
 * Izmjerene vrijednosti najbliže DHMZ postaje ("Mjerenja u blizini").
 * VjetarBrzina iz feeda je u m/s.
 */
export function DhmzCard({
  obs,
  windUnit,
}: {
  obs: DhmzObservation;
  windUnit: WindUnit;
}) {
  const windValue =
    obs.windSpeed !== undefined
      ? `${Math.round(windUnit === "ms" ? obs.windSpeed : obs.windSpeed * 3.6)} ${windUnitLabel(windUnit)}${
          obs.windDir ? ` ${DIR_HR[obs.windDir] ?? obs.windDir}` : ""
        }`
      : "–";

  const trend =
    obs.pressureTrend !== undefined
      ? ` (${obs.pressureTrend > 0 ? "+" : ""}${obs.pressureTrend})`
      : "";

  return (
    <View className="gap-4 rounded-2xl border border-ink/[0.08] px-4 py-4 dark:border-paper/10">
      <View className="flex-row items-baseline gap-3">
        <Text className="text-3xl font-light text-ink dark:text-paper">
          {obs.temp !== undefined ? `${obs.temp.toFixed(1)}°` : "–"}
        </Text>
        {obs.conditionText && (
          <Text className="text-sm text-ink/60 dark:text-paper/60">
            {obs.conditionText}
          </Text>
        )}
      </View>
      <View className="flex-row">
        <Value
          label={t.metrics.humidity}
          value={obs.humidity !== undefined ? `${obs.humidity} %` : "–"}
        />
        <Value
          label={t.metrics.pressure}
          value={obs.pressure !== undefined ? `${obs.pressure} hPa${trend}` : "–"}
        />
        <Value label={t.metrics.wind} value={windValue} />
      </View>
      <Text className="text-[11px] text-ink/40 dark:text-paper/40">
        {t.home.measurements}: {obs.stationName}, {obs.measuredAt}, {t.home.dhmzSource}
      </Text>
    </View>
  );
}
