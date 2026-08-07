import { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { HeroBackdrop } from "@/components/HeroBackdrop";
import { t } from "@/i18n";
import { colors } from "@/theme/colors";
import {
  ACCENT_CORAL,
  backdropEffects,
  precipIntensity,
  weatherGradient,
} from "@/utils/weatherLook";
import { codeToCondition } from "@/utils/weatherCodes";

/**
 * Razvojni pregled pozadina (6.8.2026.): odabir vremena → gradijent +
 * ambijentalni sloj odmah na ekranu.
 *
 * Zašto postoji: efekti se vežu uz WMO kodove koje u stvarnosti nemamo
 * kad ih razvijamo (snijeg u kolovozu, magla po suncu). Bez ovog ekrana
 * se izgled snijega i grmljavine ne bi vidio do zime.
 */
type Sample = { code: number; isDay: boolean };

/**
 * Po jedan predstavnik svakog efekta i svake kombinacije.
 *
 * Oznake se IZVODE iz `codeToCondition` (dorada 6.8.2026.), ne pišu se
 * ovdje: bile su tvrdo upisane na hrvatskom, pa bi na engleskom sučelju
 * ostale jedini neprevedeni ekran. Noćni uzorci dobivaju sufiks
 * razdoblja, jer im je WMO kod isti kao dnevnima.
 */
const SAMPLES: Sample[] = [
  { code: 0, isDay: true },
  { code: 2, isDay: true },
  { code: 3, isDay: true },
  { code: 45, isDay: true },
  { code: 51, isDay: true },
  { code: 63, isDay: true },
  { code: 65, isDay: true },
  { code: 82, isDay: true },
  { code: 95, isDay: true },
  { code: 66, isDay: true },
  { code: 71, isDay: true },
  { code: 75, isDay: true },
  { code: 0, isDay: false },
  { code: 61, isDay: false },
  { code: 75, isDay: false },
];

/** "Kiša" danju, "Kiša · noć" noću — kod je isti, pozadina nije. */
function sampleLabel(s: Sample): string {
  const label = codeToCondition(s.code, s.isDay).label;
  return s.isDay ? label : `${label} · ${t.home.nightShort.toLowerCase()}`;
}

export default function PreviewScreen() {
  const window = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [dark, setDark] = useState(false);

  const sample = SAMPLES[index]!;
  const stops = weatherGradient(sample.code, sample.isDay, dark);
  const effects = backdropEffects(sample.code, sample.isDay);
  const intensity = precipIntensity(sample.code);
  const pageBg = dark ? colors.night : colors.mist;
  const condition = codeToCondition(sample.code, sample.isDay);
  const previewH = Math.round(window.height * 0.46);

  return (
    <ScrollView
      className="flex-1 bg-mist dark:bg-night"
      contentContainerClassName="gap-4 pb-8"
    >
      {/*
        Pravi HeroBackdrop, ne kopija — pregled mora pokazati ono što se
        stvarno prikazuje na početnoj, uključujući ulazne animacije.
        `key` mijenja identitet pri promjeni vremena, pa se animacije
        pokrenu iznova (inače bi ulazna odsvirala samo prvi put).
      */}
      <View
        style={{ height: previewH, width: window.width, backgroundColor: pageBg }}
      >
        <HeroBackdrop
          key={`${sample.code}-${sample.isDay}-${dark}`}
          stops={stops}
          pageBg={pageBg}
          width={window.width}
          height={previewH}
          effects={effects}
          intensity={intensity}
        />
        <View className="flex-1 items-center justify-center">
          <Text
            className="font-grotesk-bold"
            style={{ fontSize: 64, color: dark ? colors.paper : colors.ink }}
          >
            18°
          </Text>
          <Text
            className="font-grotesk-bold text-[17px]"
            style={{ color: dark ? colors.paper : colors.ink }}
          >
            {condition.label}
          </Text>
        </View>
      </View>

      <View className="gap-3 px-4">
        <Text className="px-1 font-grotesk text-[13px] text-ink/55 dark:text-paper/55">
          {t.preview.hint}
        </Text>

        {/* Tema: gradijenti su drukčiji za svijetlu i tamnu. */}
        <View className="flex-row gap-2">
          {[false, true].map((isDarkOption) => (
            <Pressable
              key={String(isDarkOption)}
              onPress={() => setDark(isDarkOption)}
              className={`flex-1 items-center rounded-xl py-3 ${
                dark === isDarkOption ? "bg-ink dark:bg-paper" : "bg-white dark:bg-coal"
              }`}
            >
              <Text
                className={`font-grotesk-bold text-[14px] ${
                  dark === isDarkOption
                    ? "text-paper dark:text-ink"
                    : "text-ink/70 dark:text-paper/70"
                }`}
              >
                {isDarkOption ? t.preview.dark : t.preview.light}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row flex-wrap gap-2">
          {SAMPLES.map((s, i) => {
            const active = i === index;
            return (
              <Pressable
                key={`${s.code}-${s.isDay}-${i}`}
                onPress={() => setIndex(i)}
                className={`rounded-full px-4 py-2.5 ${
                  active ? "" : "bg-white dark:bg-coal"
                }`}
                style={active ? { backgroundColor: ACCENT_CORAL } : undefined}
              >
                <Text
                  className={`font-grotesk-bold text-[13.5px] ${
                    active ? "text-white" : "text-ink/70 dark:text-paper/70"
                  }`}
                >
                  {sampleLabel(s)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Što se točno crta — korisno pri podešavanju slojeva. */}
        <Text className="px-1 font-grotesk text-[12px] text-ink/45 dark:text-paper/45">
          WMO {sample.code} · {sample.isDay ? "dan" : "noć"} · {effects.join(" + ")} ·{" "}
          {intensity}
        </Text>
      </View>
    </ScrollView>
  );
}
