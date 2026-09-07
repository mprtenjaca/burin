import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Fragment, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { DailyPoint, HourlyPoint } from "@/api/types";
import { t } from "@/i18n";
import { useDayDetails } from "@/store/dayDetails";
import { useThemeColors } from "@/theme/useThemeColors";
import type { TempUnit } from "@/utils/format";
import { convertTemp, formatDayShort } from "@/utils/format";
import { codeToCondition } from "@/utils/weatherCodes";
import { ACCENT_CORAL } from "@/utils/weatherLook";

import { Hairline } from "./Section";

/*
 * expo-haptics kroz čuvani require, ne statični import: requireNativeModule
 * BACA pri učitavanju modula kad nativna strana ne postoji — a instalirani
 * dev buildovi (iOS 13 / Android 4) su građeni bez njega. Do sljedećeg
 * builda haptika tiho ne radi, aplikacija ne smije pasti.
 */
let haptics: typeof import("expo-haptics") | null = null;
try {
  haptics = require("expo-haptics");
} catch {
  haptics = null;
}

/** Širine kolona — dijele ih zaglavlje i redovi da poravnanje drži. */
const KOL_DAN = 74;
const KOL_IKONA = 21;
const KOL_OBOR = 48;
const KOL_TEMP = 38;

/**
 * 14 dana: dan, ikona, % oborina, min–max s trakom raspona (raspon dana
 * unutar raspona svih 14 dana).
 *
 * Dodir na red otvara SHEET s detaljima dana (`app/(screens)/day.tsx`),
 * ne više harmoniku u listi (redizajn 7.9.2026., nakon pritužbi „otvori
 * se podsekcija i skroz se izgubim"): otvoreni red se nije razlikovao od
 * ostalih, panel se otvarao ispod pregiba, a zatvaranje prethodnog dana
 * iznad je odskakalo cijelu listu. Sad lista stoji, a sheet nosi naslov
 * dana i čipove za prebacivanje — vidi obrazloženje u `day.tsx`.
 *
 * Podaci za sheet idu kroz MEMORIJSKI store, ne kroz parametre: `hourly`
 * je ~69 kB i ne smije se serijalizirati u kadru prijelaza. Lista ih već
 * drži, pa ih prije navigacije samo pokaže storeu (referenca).
 */
export function DailyList({
  days,
  hourly,
  place,
  tempUnit,
}: {
  days: DailyPoint[];
  /** Ide sheetu kroz store, lista ga sama ne crta. */
  hourly: HourlyPoint[];
  /** Ime mjesta za podnaslov sheeta. */
  place: string;
  /** Jedinica vjetra ne treba: sheet čita postavke sam. */
  tempUnit: TempUnit;
}) {
  const { fg } = useThemeColors();
  /* Odziv na dodir kroz onPressIn/Out + stanje — pressed stil na Pressableu ne radi uz NativeWind. */
  const [pressedDate, setPressedDate] = useState<string | null>(null);
  const openDay = (date: string) => {
    // Kratki tik PRIJE otvaranja sheeta; fire-and-forget da ne koči navigaciju.
    haptics?.impactAsync(haptics.ImpactFeedbackStyle.Light).catch(() => {});
    useDayDetails.getState().setSource({ days, hourly, place });
    router.navigate({ pathname: "/day", params: { date } });
  };
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
        return (
          <Fragment key={d.date}>
            {i > 0 && <Hairline />}
            <Pressable
              onPress={() => openDay(d.date)}
              onPressIn={() => setPressedDate(d.date)}
              onPressOut={() => setPressedDate(null)}
              accessibilityRole="button"
              accessibilityLabel={`${dayLabel}, ${t.home.details}`}
              className={`-mx-2.5 flex-row items-center gap-2.5 rounded-xl px-2.5 py-3 ${
                pressedDate === d.date ? "bg-ink/[0.05] dark:bg-paper/[0.07]" : ""
              }`}
            >
              <View
                className="flex-row items-center gap-1"
                style={{ width: KOL_DAN }}
              >
                <Text className="font-grotesk-medium text-[16px] text-ink dark:text-paper">
                  {dayLabel}
                </Text>
                {/* Ševron UDESNO: „vodi dalje", ne „širi se ovdje" (ChevronDown je bio harmonika). */}
                <ChevronRight size={14} strokeWidth={2} color={fg} opacity={0.35} />
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
                {d.precipProbMax >= 1 ? `${Math.round(d.precipProbMax)} %` : "0 %"}
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
          </Fragment>
        );
      })}
    </View>
  );
}
