import { Text, View } from "react-native";

import { t } from "@/i18n";

/** Europski AQI pragovi (open-meteo, EEA skala). */
function aqiLabel(aqi: number): string {
  if (aqi <= 20) return t.aqi.good;
  if (aqi <= 40) return t.aqi.fair;
  if (aqi <= 60) return t.aqi.moderate;
  if (aqi <= 80) return t.aqi.poor;
  if (aqi <= 100) return t.aqi.veryPoor;
  return t.aqi.extremelyPoor;
}

/** "Kvaliteta zraka" — vrijednost + opisna kategorija, monokromno. */
export function AqiRow({ aqi }: { aqi: number }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-sm text-ink/60 dark:text-paper/60">
        {t.home.airQuality}
      </Text>
      <Text className="text-[15px] text-ink dark:text-paper">
        {Math.round(aqi)} · {aqiLabel(aqi)}
      </Text>
    </View>
  );
}
