import { ShieldCheck } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";

import type { MeteoWarning } from "@/api/meteoalarm";
import { Hairline } from "@/components/Section";
import { warningIcon } from "@/components/WarningBar";
import { useLocation } from "@/hooks/useLocation";
import { useWarnings } from "@/hooks/useWarnings";
import { t } from "@/i18n";
import { useCities } from "@/store/cities";
import { useThemeColors } from "@/theme/useThemeColors";
import { hasMeteoalarmFeed } from "@/api/meteoalarmEurope";
import { emmaRegionName, regionsForPlace } from "@/utils/emmaRegions";
import { clockTime } from "@/utils/format";
import { warningColor } from "@/utils/weatherLook";

/** "6.8." bez sata — za raspone preko više dana. */
function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${t.dayNamesShort[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * "do 23:59" (danas) / "sutra 00:01 – 23:59" / "pet 8.8. – sub 9.8."
 * — kratko, u duhu ostalih natpisa; puni datumi samo kad raspon izlazi
 * iz danas/sutra.
 */
export function warningPeriod(w: MeteoWarning, now: Date = new Date()): string {
  const onset = new Date(w.onset);
  const expires = new Date(w.expires);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (w.onset <= now.getTime() && sameDay(expires, now)) {
    return `${t.warnings.until} ${clockTime(w.expires)}`;
  }
  if (sameDay(onset, tomorrow) && sameDay(expires, tomorrow)) {
    return `${t.warnings.tomorrow} ${clockTime(w.onset)} – ${clockTime(w.expires)}`;
  }
  if (sameDay(onset, expires)) {
    return `${shortDate(w.onset)} ${clockTime(w.onset)} – ${clockTime(w.expires)}`;
  }
  return `${shortDate(w.onset)} – ${shortDate(w.expires)} ${clockTime(w.expires)}`;
}

/**
 * Upozorenja za odabrano mjesto (Meteoalarm/DHMZ), u jeziku podekrana:
 * bijele kartice na mist podlozi. Svako upozorenje nosi naslov u boji
 * razine, trajanje, regiju te DHMZ opis i uputu (hrvatski iz CAP-a).
 */
export default function WarningsScreen() {
  const { fg } = useThemeColors();
  const selected = useCities((s) => s.selected);
  const gps = useLocation(selected === null);
  const place = selected ?? (gps.status === "granted" ? gps.place : null);
  const warnings = useWarnings(place);
  /**
   * Pokrivenost: Hrvatska preko tablice regija, ostala Europa preko
   * Meteoalarm feeda te zemlje (38 zemalja, prošireno 6.8.2026.).
   */
  const covered = place
    ? regionsForPlace(place.lat, place.lon).length > 0 ||
      hasMeteoalarmFeed(place.countryCode)
    : false;

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

      {/*
        Izvan Hrvatske se ne kaže "nema upozorenja" — to bi zvučalo kao da
        su provjerena i da je čisto. DHMZ tuđe zemlje ne pokriva, pa se to
        i kaže (dorada 6.8.2026., nakon bug-a s gradom u Čileu).
      */}
      {warnings.length === 0 && (
        <View className="items-center gap-3 rounded-2xl bg-white px-4 py-10 dark:bg-coal">
          <ShieldCheck size={28} strokeWidth={2} color={fg} opacity={0.4} />
          <Text className="px-4 text-center font-grotesk-medium text-[15px] text-ink/65 dark:text-paper/65">
            {covered ? t.warnings.none : t.warnings.outsideCroatia}
          </Text>
        </View>
      )}

      {warnings.map((w) => {
        const color = warningColor(w.level);
        const Icon = warningIcon(w.type);
        return (
          <View key={w.id} className="overflow-hidden rounded-2xl bg-white dark:bg-coal">
            {/* Traka razine preko vrha kartice — boja govori težinu. */}
            <View
              className="flex-row items-center gap-2.5 px-4 py-3"
              style={{ backgroundColor: color }}
            >
              <Icon size={18} strokeWidth={2.5} color={w.level === 2 ? "#141414" : "#FFFFFF"} />
              <Text
                className="flex-1 font-grotesk-bold text-[15px]"
                style={{ color: w.level === 2 ? "#141414" : "#FFFFFF" }}
              >
                {w.event}
              </Text>
            </View>

            <View className="gap-2 px-4 py-3.5">
              <View className="flex-row items-center justify-between">
                <Text className="font-grotesk-bold text-[13px] text-ink dark:text-paper">
                  {warningPeriod(w)}
                </Text>
                <Text className="font-grotesk text-[12.5px] text-ink/55 dark:text-paper/55">
                  {/* HR ima hrvatska imena; drugdje ime regije iz feeda. */}
                  {emmaRegionName(w.region) ?? w.areaDesc ?? w.region}
                </Text>
              </View>
              {w.description && (
                <Text className="font-grotesk-medium text-[14.5px] leading-5 text-ink dark:text-paper">
                  {w.description}
                </Text>
              )}
              {w.instruction && (
                <>
                  <Hairline />
                  <Text className="font-grotesk text-[13.5px] leading-5 text-ink/70 dark:text-paper/70">
                    {w.instruction}
                  </Text>
                </>
              )}
            </View>
          </View>
        );
      })}

      {covered && (
        <Text className="px-1 pt-1 font-grotesk text-[11px] text-ink/45 dark:text-paper/45">
          {t.warnings.source}
        </Text>
      )}
    </ScrollView>
  );
}
