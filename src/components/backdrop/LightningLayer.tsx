import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { rnd, type LayerProps } from "./shared";

/**
 * GRMLJAVINA — rijetki bljeskovi koji nakratko osvijetle cijeli kadar.
 *
 * Ide UZ kišu (vidi `backdropEffects`), ne umjesto nje. Namjerno je vrlo
 * rijedak: bljesak svakih 7–15 s, u dva-tri kratka trzaja kao pravo
 * sijevanje. Češće od toga postaje naporno na ekranu koji se gleda
 * svakodnevno.
 */

/** Trajanja jednog trzaja — vrlo kratko. */
const FLASH_IN_MS = 60;
const FLASH_OUT_MS = 180;
/** Stanke između bljeskova u istoj "grmljavini". */
const GAP_MS = 110;
/** Mirovanje do sljedećeg bljeska. */
const REST_MS = [7000, 11000, 15000];

/** Najveća prozirnost bljeska — suptilno, ne stroboskop. */
const FLASH_OPACITY = 0.5;

const Flash = memo(function Flash({
  width,
  height,
  restMs,
  delayMs,
  double,
}: {
  width: number;
  height: number;
  restMs: number;
  delayMs: number;
  /** Dvostruki trzaj — pravo sijevanje rijetko bljesne samo jednom. */
  double: boolean;
}) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const strike = () => [
      Animated.timing(glow, {
        toValue: 1,
        duration: FLASH_IN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 0,
        duration: FLASH_OUT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ];

    const loop = Animated.loop(
      Animated.sequence([
        ...strike(),
        ...(double ? [Animated.delay(GAP_MS), ...strike()] : []),
        Animated.delay(restMs),
      ]),
    );
    const timer = setTimeout(() => loop.start(), delayMs);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [glow, restMs, delayMs, double]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: glow.interpolate({
            inputRange: [0, 1],
            outputRange: [0, FLASH_OPACITY],
          }),
        },
      ]}
      pointerEvents="none"
    >
      {/* Izričite dimenzije: "100%" bez viewBoxa daje kvadrat (uređaj). */}
      <Svg width={width} height={height}>
        <Defs>
          {/* Svjetlo dolazi ODOZGO — jače pri vrhu, gasi se prema dnu. */}
          <LinearGradient id="lightning" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#lightning)" />
      </Svg>
    </Animated.View>
  );
});
Flash.displayName = "Flash";

export const LightningLayer = memo(function LightningLayer({
  width,
  height,
}: LayerProps) {
  /** Dva neovisna bljeska s različitim tempom — oluja nema ritam. */
  const flashes = useMemo(
    () =>
      Array.from({ length: 2 }, (_, i) => ({
        restMs: REST_MS[i % REST_MS.length]!,
        delayMs: Math.round(rnd(i + 17) * 6000),
        double: i === 0,
      })),
    [],
  );

  return (
    <>
      {flashes.map((f, i) => (
        <Flash key={i} {...f} width={width} height={height} />
      ))}
    </>
  );
});
LightningLayer.displayName = "LightningLayer";
