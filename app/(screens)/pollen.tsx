import { ScrollView, Text, View } from "react-native";

import { ScaleMarker } from "@/components/BentoGrid";
import { Hairline } from "@/components/Section";
import { useLocation } from "@/hooks/useLocation";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import { t } from "@/i18n";
import { useCities } from "@/store/cities";
import { POLLEN_COLORS, pollenSpecies } from "@/utils/weatherLook";

/**
 * Pelud — puna lista SVIH vrsta (dorada 6.8.2026.): kartica na početnoj
 * pokazuje samo aktivne, a alergičar želi vidjeti i da je "njegova" vrsta
 * na nuli. Svaka vrsta nosi svoju skalu u bojama s markerom, isti jezik
 * kao kartica. Podaci dolaze iz istog upita kao AQI (react-query keš) —
 * ekran ne košta nijedan novi poziv.
 */
export default function PollenScreen() {
  const selected = useCities((s) => s.selected);
  const gps = useLocation(selected === null);
  const place = selected ?? (gps.status === "granted" ? gps.place : null);
  const { bundle } = useWeatherBundle(place);

  const gradeLabels = [
    t.pollen.noneShort,
    t.pollen.low,
    t.pollen.moderate,
    t.pollen.high,
    t.pollen.veryHigh,
  ] as const;

  const species = bundle?.pollen ? pollenSpecies(bundle.pollen) : [];

  return (
    <ScrollView
      className="flex-1 bg-mist dark:bg-night"
      contentContainerClassName="gap-3 px-4 py-4"
    >
      {place && (
        <Text className="px-1 font-grotesk-bold text-[13.5px] text-ink/55 dark:text-paper/55">
          {place.name}
        </Text>
      )}

      {species.length === 0 && (
        <View className="items-center rounded-2xl bg-white px-4 py-10 dark:bg-coal">
          <Text className="font-grotesk-medium text-[15px] text-ink/65 dark:text-paper/65">
            {t.common.noData}
          </Text>
        </View>
      )}

      {species.length > 0 && (
        <View className="rounded-2xl bg-white px-4 py-1 dark:bg-coal">
          {species.map((s, i) => (
            <View key={s.key}>
              {i > 0 && <Hairline />}
              <View className="gap-2 py-3.5">
                <View className="flex-row items-baseline justify-between">
                  <Text className="font-grotesk-medium text-[16px] text-ink dark:text-paper">
                    {t.pollen.species[s.key]}
                  </Text>
                  <Text
                    className="font-grotesk-bold text-[14px]"
                    style={
                      s.grade > 0
                        ? { color: POLLEN_COLORS[s.grade - 1] }
                        : undefined
                    }
                  >
                    {s.grade > 0 ? (
                      gradeLabels[s.grade]
                    ) : (
                      <Text className="text-ink/45 dark:text-paper/45">
                        {gradeLabels[0]}
                      </Text>
                    )}
                  </Text>
                </View>
                <View className="h-[5px] flex-row rounded-full">
                  {POLLEN_COLORS.map((c, j) => (
                    <View
                      key={c}
                      className={`flex-1 ${j === 0 ? "rounded-l-full" : ""} ${
                        j === POLLEN_COLORS.length - 1 ? "rounded-r-full" : ""
                      }`}
                      style={{ backgroundColor: c, opacity: s.grade > 0 ? 1 : 0.35 }}
                    />
                  ))}
                  {s.grade > 0 && <ScaleMarker fraction={s.fraction} />}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text className="px-1 pt-1 font-grotesk text-[11.5px] leading-4 text-ink/45 dark:text-paper/45">
        {t.pollen.modelNote}
      </Text>
    </ScrollView>
  );
}
