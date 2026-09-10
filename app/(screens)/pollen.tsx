import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import type { PollenDay } from "@/api/openMeteo";
import { PollenSegments } from "@/components/BentoGrid";
import { Hairline } from "@/components/Section";
import { useBottomInset } from "@/hooks/useBottomInset";
import { t } from "@/i18n";
import { formatDayShort } from "@/utils/format";
import { POLLEN_COLORS, pollenSpecies, type PollenLevels, type PollenSpecies } from "@/utils/weatherLook";

/**
 * Pelud — puna lista SVIH vrsta (dorada 6.8.2026.): kartica na početnoj
 * pokazuje samo aktivne, a alergičar želi vidjeti i da je "njegova" vrsta
 * na nuli. Svaka vrsta nosi svoju skalu u bojama s markerom, isti jezik
 * kao kartica.
 *
 * TRI DANA od 6.9.2026. (Markov odabir): danas + sljedeća dva, isto koliko
 * objavljuju Pliva i županijski zavodi. Alergičar planira dan unaprijed —
 * "ostaje li visoko i sutra" je pitanje zbog kojeg se ekran i otvara.
 *
 * BEZ BROJKI (Markov odabir 6.9.2026.: "brojka nije bitna"). Naša je
 * vrijednost grains/m³ iz CAMS modela, a Pliva objavljuje indeks 0–12+ iz
 * mjerenja peludomjerom — isti dan je kod nas 12.5, kod njih 6.6. Dvije
 * mjere iste stvari jedna uz drugu izgledaju kao da netko griješi, a
 * korisniku ionako treba RAZRED ("visoka"), ne decimala.
 *
 * PODACI DOLAZE KROZ PARAMETRE NAVIGACIJE (popravak 13.8.2026.), ne
 * kroz hookove. Prije je ekran na montiranju vrtio `useWeatherBundle`
 * (cijelo sastavljanje bundlea s korekcijama) i `useLocation` — a taj na
 * "Mojoj lokaciji" pri SVAKOM otvaranju iznova traži dozvolu, GPS
 * poziciju i reverse geocode PREKO MREŽE. Pola sekunde do prve slike, za
 * šačicu brojki koje peludna kartica na početnoj već drži u ruci.
 *
 * Sad kartica pošalje razine u parametru (`levels` za danas, `days` za sva
 * tri dana — sitan JSON), pa je ekran čisti prikaz: nema upita, nema
 * GPS-a, nema računanja. Isto pravilo kao `widgetData.ts` i `props.ts` u
 * widgetu — što god prima drugi ekran, mora biti GOTOVO.
 *
 * Ekran se otvara JEDINO s peludne kartice, pa parametri uvijek postoje;
 * bez njih (npr. ručni deep link) pada na "Nema podataka" — isto što bi
 * pokazao i zimi.
 */

/**
 * Oznaka dana u retku triju dana: "danas", "sutra", pa datum ("8.9.").
 *
 * Računa se iz DATUMA prema satu uređaja, a ne iz položaja u nizu: prvi
 * dan niza je danas i za CAMS i za Štampar, ali to je slučajnost izvora, a
 * ne ugovor — peludomjer bi jednom mogao objaviti jučerašnje mjerenje kao
 * prvi dan i "danas" bi tada lagalo. Isti postupak kao dugmad na karti.
 */
function relativeDayLabel(date: string, now: Date = new Date()): string {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  const todayMs = at(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const offset = Math.round((at(y, m, d) - todayMs) / 86_400_000);
  if (offset === 0) return t.pollen.today;
  if (offset === 1) return t.pollen.tomorrow;
  return formatDayShort(`${date}T00:00`);
}

/** JSON iz parametara navigacije; neispravan zapis ne smije srušiti ekran. */
function parseParam<T>(raw: string | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export default function PollenScreen() {
  const { levels, days, place } = useLocalSearchParams<{ levels?: string; days?: string; place?: string }>();

  const pollen = useMemo(() => parseParam<PollenLevels>(levels), [levels]);
  const pollenDays = useMemo(() => parseParam<PollenDay[]>(days) ?? [], [days]);

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

  /*
   * Redoslijed vrsta drži DANAŠNJI dan — najjača gore. Da svaki dan slaže
   * po sebi, vrste bi skakale po stupcima i tablica se ne bi mogla čitati.
   */
  const species = pollen ? pollenSpecies(pollen, pollenDays[0]?.graded) : [];

  /** Razred jedne vrste na jedan dan; dan bez podataka daje razred 0. */
  const gradeOn = (day: PollenDay, key: PollenSpecies) =>
    pollenSpecies(day.levels, day.graded).find((s) => s.key === key)?.grade ?? 0;

  // Androidova navigacijska traka leži preko dna (edge-to-edge) — vidi hook.
  const bottomInset = useBottomInset();

  return (
    <ScrollView
      className="flex-1 bg-mist dark:bg-night"
      contentContainerClassName="gap-3 px-4 pt-4"
      contentContainerStyle={{ paddingBottom: 16 + bottomInset }}
    >
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
                <PollenSegments grade={s.grade} />

                {/*
                  Sljedeći dani ispod skale, u retku: "danas VISOKA ·
                  sutra VISOKA · pon 8.9. UMJERENA". Danas i sutra su
                  riječi, od prekosutra datum — vidi `relativeDayLabel`.
                */}
                {pollenDays.length > 1 && (
                  <View className="flex-row flex-wrap gap-x-3 gap-y-1 pt-0.5">
                    {pollenDays.map((day) => {
                      const grade = gradeOn(day, s.key);
                      return (
                        <View key={day.date} className="flex-row items-baseline gap-1.5">
                          <Text className="font-grotesk text-[11.5px] text-ink/45 dark:text-paper/45">
                            {relativeDayLabel(day.date)}
                          </Text>
                          <Text
                            className="font-grotesk-medium text-[11.5px]"
                            style={grade > 0 ? { color: POLLEN_COLORS[grade - 1] } : undefined}
                          >
                            {grade > 0 ? (
                              gradeLabels[grade]
                            ) : (
                              <Text className="text-ink/40 dark:text-paper/40">{gradeLabels[0]}</Text>
                            )}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <Text className="px-1 pt-1 font-grotesk text-[11.5px] leading-4 text-ink/45 dark:text-paper/45">
        {/*
          Napomena prati IZVOR: peludomjer kaže da je izmjereno (i da je
          razvojni izvor), model kaže da je računato. Korisnik uvijek zna
          što gleda — kod peludi to je zdravstvena informacija, ne kozmetika.
        */}
        {pollenDays[0]?.source === "stampar" ? t.pollen.measuredNote : t.pollen.modelNote}
      </Text>
    </ScrollView>
  );
}
