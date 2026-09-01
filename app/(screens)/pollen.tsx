import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ScaleMarker } from "@/components/BentoGrid";
import { Hairline } from "@/components/Section";
import { t } from "@/i18n";
import { POLLEN_COLORS, pollenSpecies, type PollenLevels } from "@/utils/weatherLook";

/**
 * Pelud — puna lista SVIH vrsta (dorada 6.8.2026.): kartica na početnoj
 * pokazuje samo aktivne, a alergičar želi vidjeti i da je "njegova" vrsta
 * na nuli. Svaka vrsta nosi svoju skalu u bojama s markerom, isti jezik
 * kao kartica.
 *
 * PODACI DOLAZE KROZ PARAMETRE NAVIGACIJE (popravak 13.8.2026.), ne
 * kroz hookove. Prije je ekran na montiranju vrtio `useWeatherBundle`
 * (cijelo sastavljanje bundlea s korekcijama) i `useLocation` — a taj na
 * "Mojoj lokaciji" pri SVAKOM otvaranju iznova traži dozvolu, GPS
 * poziciju i reverse geocode PREKO MREŽE. Pola sekunde do prve slike, za
 * šačicu brojki koje peludna kartica na početnoj već drži u ruci.
 *
 * Sad kartica pošalje razine u parametru (`levels`, JSON — sitan zapis,
 * desetak brojki), pa je ekran čisti prikaz: nema upita, nema GPS-a,
 * nema računanja. Isto pravilo kao `widgetData.ts` i `props.ts` u
 * widgetu — što god prima drugi ekran, mora biti GOTOVO.
 *
 * Ekran se otvara JEDINO s peludne kartice, pa parametri uvijek postoje;
 * bez njih (npr. ručni deep link) pada na "Nema podataka" — isto što bi
 * pokazao i zimi.
 */
export default function PollenScreen() {
  const { levels, place } = useLocalSearchParams<{ levels?: string; place?: string }>();

  const pollen = useMemo(() => {
    if (!levels) return undefined;
    try {
      return JSON.parse(levels) as PollenLevels;
    } catch {
      return undefined;
    }
  }, [levels]);

  /*
   * LISTA VRSTA DOLAZI KADAR NAKON EKRANA (popravak 8.8.2026.).
   *
   * I bez skupih hookova crtanje svih vrsta sa skalama i markerima nije
   * besplatno — unutar navigacijskog prijelaza bi štucalo. Isti obrazac
   * koji nose početna (`belowFold`) i tražilica (`listsReady`): naslov
   * odmah, popis u sljedećem kadru.
   */
  const [listReady, setListReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setListReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const gradeLabels = [t.pollen.noneShort, t.pollen.low, t.pollen.moderate, t.pollen.high, t.pollen.veryHigh] as const;

  const species = pollen ? pollenSpecies(pollen) : [];

  return (
    <ScrollView className="flex-1 bg-mist dark:bg-night" contentContainerClassName="gap-3 px-4 py-4">
      {!!place && (
        <Text className="px-1 font-grotesk-bold text-[13.5px] text-ink/55 dark:text-paper/55">
          {place}
        </Text>
      )}

      {listReady && species.length === 0 && (
        <View className="items-center rounded-2xl bg-white px-4 py-10 dark:bg-coal">
          <Text className="font-grotesk-medium text-[15px] text-ink/65 dark:text-paper/65">
            {t.common.noData}
          </Text>
        </View>
      )}

      {listReady && species.length > 0 && (
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
                    style={s.grade > 0 ? { color: POLLEN_COLORS[s.grade - 1] } : undefined}
                  >
                    {s.grade > 0 ? (
                      gradeLabels[s.grade]
                    ) : (
                      <Text className="text-ink/45 dark:text-paper/45">{gradeLabels[0]}</Text>
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
