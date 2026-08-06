import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Skelet učitavanja (redizajn 6.8.2026.): prati STVARNI raspored ekrana
 * — puni hero s velikom brojkom, traka sati na dnu, pa bento kartice —
 * i preko svega prelazi valoviti odsjaj.
 *
 * Zašto prati raspored: skelet koji ne nalikuje sadržaju izgleda kao
 * greška; kad se poklapa, prijelaz u prave podatke je neprimjetan.
 */

/** Trajanje jednog prolaza odsjaja. */
const SHIMMER_MS = 1400;

/** Tihi placeholder blok. */
export function Skeleton({ className, style }: { className?: string; style?: object }) {
  return (
    <View
      className={`rounded-2xl bg-ink/[0.07] dark:bg-paper/10 ${className ?? ""}`}
      style={style}
    />
  );
}

/**
 * Valoviti odsjaj preko cijelog skeleta: kosi svijetli pojas koji putuje
 * slijeva nadesno. Jedan sloj za cijeli ekran — jeftinije od odsjaja po
 * svakom bloku, a dojam je isti.
 */
function Shimmer() {
  const { dark } = useThemeColors();
  const { width, height } = useWindowDimensions();
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: SHIMMER_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [wave]);

  // Pojas je širok pola ekrana; putuje od lijevo izvan kadra do desno.
  const band = width * 0.5;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          transform: [
            {
              translateX: wave.interpolate({
                inputRange: [0, 1],
                outputRange: [-band, width + band],
              }),
            },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <Svg width={band} height={height}>
        <Defs>
          <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={dark ? "#FAFAF8" : "#FFFFFF"} stopOpacity="0" />
            <Stop
              offset="0.5"
              stopColor={dark ? "#FAFAF8" : "#FFFFFF"}
              stopOpacity={dark ? "0.07" : "0.75"}
            />
            <Stop offset="1" stopColor={dark ? "#FAFAF8" : "#FFFFFF"} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={band} height={height} fill="url(#shimmer)" />
      </Svg>
    </Animated.View>
  );
}

/** Jedna kolona u traci sati. */
function HourColumn() {
  return (
    <View className="w-[64px] items-center gap-1.5" style={{ marginRight: 6 }}>
      <Skeleton className="h-[16px] w-8 rounded-md" />
      <Skeleton className="h-[21px] w-[21px] rounded-full" />
      <Skeleton className="h-[12px] w-7 rounded-md" />
      <Skeleton className="h-[13px] w-9 rounded-md" />
    </View>
  );
}

/**
 * Skelet početnog ekrana — isti raspored kao pravi: hero preko punog
 * viewporta (datum, ime mjesta, velika brojka, opis) s trakom sati na
 * dnu, pa bento kartice ispod pregiba.
 */
export function HomeSkeleton() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <View className="flex-1 bg-mist dark:bg-night">
      {/* Hero: sve je centrirano, kao u pravom rasporedu. */}
      <View style={{ height }}>
        {/* Datum na vrhu. */}
        <View
          className="items-center gap-1.5"
          style={{ position: "absolute", top: insets.top + 58, left: 0, right: 0 }}
        >
          <Skeleton className="h-[16px] w-24 rounded-md" />
          <Skeleton className="h-[14px] w-16 rounded-md" />
        </View>

        {/* Sredina: tMax, strelica, ime, VELIKA brojka, opis, osjet. */}
        <View className="flex-1 items-center justify-center gap-3">
          <Skeleton className="h-[16px] w-10 rounded-md" />
          <Skeleton className="h-[38px] w-[16px] rounded-md" />
          <Skeleton className="h-[20px] w-32 rounded-md" />
          {/* Velika brojka — najviši blok, kao pravih 128 px. */}
          <Skeleton className="h-[110px] w-48" />
          <Skeleton className="h-[20px] w-28 rounded-md" />
          <Skeleton className="h-[15px] w-24 rounded-md" />
        </View>

        {/* Traka sati na dnu heroja. */}
        <View
          className="flex-row px-4"
          style={{ position: "absolute", bottom: insets.bottom + 10, left: 0, right: 0 }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <HourColumn key={i} />
          ))}
        </View>
      </View>

      {/* Ispod pregiba: bento kartice u paru, kao prave (visina 160). */}
      <View className="gap-2.5 px-4 pt-1">
        <View className="flex-row gap-2.5">
          <Skeleton className="flex-1" style={{ height: 160 }} />
          <Skeleton className="flex-1" style={{ height: 160 }} />
        </View>
        <View className="flex-row gap-2.5">
          <Skeleton className="flex-1" style={{ height: 160 }} />
          <Skeleton className="flex-1" style={{ height: 160 }} />
        </View>
      </View>

      <Shimmer />
    </View>
  );
}
