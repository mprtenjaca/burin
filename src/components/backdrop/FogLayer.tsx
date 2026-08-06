import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from "react-native-svg";

import { rnd, type LayerProps } from "./shared";

/**
 * MAGLA — nekoliko VELIKIH mekih volumena koji se lijeno valjaju i dišu,
 * plus stalni veo preko cijelog kadra.
 *
 * Treća generacija (6.8.2026.); prethodne dvije nisu radile:
 *  1. vodoravne pruge — čitale su se kao trake, ne kao magla
 *  2. elipse BEZ rezerve platna — izmjereno da je svih 6 slojeva bilo
 *     srezano na rubovima (dosezi od −295 do 759 px na platnu širine
 *     390), pa su se vidjeli ravni bridovi
 *
 * Sada: platno seže daleko izvan kadra, volumeni su ogromni i vrlo
 * postupno padaju u prozirno, a ima ih malo — magla mora izgledati kao
 * jedna gusta masa, ne kao skup mrlja.
 */
const BANKS = 4;

/**
 * Bočna i okomita rezerva: volumen smije viriti, ali ne biti srezan.
 * 520 je izračunato iz najgoreg slučaja (najširi volumen + pomak), uz
 * zalihu za ekrane šire od 390 px.
 */
const EDGE_PAD = 520;

/** Spor, težak pomak — magla se ne žuri. */
const ROLL_MS = [28000, 36000, 31000, 42000];
const DENSITY_MS = [12000, 15500, 10000, 17000];

/** Stalni veo preko cijelog kadra — osnovna gustoća magle. */
const BASE_VEIL_OPACITY = 0.12;

const Bank = memo(function Bank({
  id,
  cx,
  cy,
  rx,
  ry,
  opacity,
  width,
  height,
  rollMs,
  densityMs,
  delayMs,
  toRight,
}: {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  opacity: number;
  width: number;
  height: number;
  rollMs: number;
  densityMs: number;
  delayMs: number;
  toRight: boolean;
}) {
  const roll = useRef(new Animated.Value(0)).current;
  const density = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pingPong = (v: Animated.Value, ms: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: ms,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: ms,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
    const r = pingPong(roll, rollMs);
    const d = pingPong(density, densityMs);
    const timer = setTimeout(() => {
      r.start();
      d.start();
    }, delayMs);
    return () => {
      clearTimeout(timer);
      r.stop();
      d.stop();
    };
  }, [roll, density, rollMs, densityMs, delayMs]);

  // Kratak put: magla se valja u mjestu, ne putuje preko ekrana.
  const travel = width * 0.14;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: density.interpolate({
            inputRange: [0, 1],
            outputRange: [opacity * 0.5, opacity],
          }),
          transform: [
            {
              translateX: roll.interpolate({
                inputRange: [0, 1],
                outputRange: toRight ? [-travel, travel] : [travel, -travel],
              }),
            },
          ],
        },
      ]}
      pointerEvents="none"
    >
      {/* Platno seže daleko izvan kadra — volumen se nikad ne reže. */}
      <Svg
        width={width + EDGE_PAD * 2}
        height={height + EDGE_PAD * 2}
        style={{ position: "absolute", left: -EDGE_PAD, top: -EDGE_PAD }}
      >
        <Defs>
          {/*
            Vrlo POSTUPAN pad prema rubu: magla nema obris, pa gustoća
            mora slabjeti kroz cijeli polumjer, ne tek pri kraju.
          */}
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0.82" />
            <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.45" />
            <Stop offset="0.82" stopColor="#FFFFFF" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={EDGE_PAD + cx}
          cy={EDGE_PAD + cy}
          rx={rx}
          ry={ry}
          fill={`url(#${id})`}
        />
      </Svg>
    </Animated.View>
  );
});
Bank.displayName = "Bank";

export const FogLayer = memo(function FogLayer({
  width,
  height,
  scrollY,
}: LayerProps) {
  const H = height || 1;

  const shift = scrollY
    ? {
        transform: [
          {
            translateY: scrollY.interpolate({
              inputRange: [0, H],
              outputRange: [0, -H * 0.2],
              extrapolate: "clamp",
            }),
          },
        ],
      }
    : undefined;

  const banks = useMemo(
    () =>
      Array.from({ length: BANKS }, (_, i) => ({
        id: `fog-${i}`,
        cx: width * (0.2 + rnd(i + 13) * 0.6),
        cy: height * (0.1 + rnd(i + 67) * 0.5),
        /*
         * OGROMNI volumeni koji se preklapaju: gustoća se zbraja i
         * dobiva se dojam mase, a ne pojedinačnih mrlja. Rubovi su
         * daleko izvan kadra pa se prijelaz nigdje ne vidi.
         */
        rx: width * (0.9 + rnd(i + 109) * 0.6),
        ry: height * (0.3 + rnd(i + 149) * 0.22),
        opacity: 0.2 + rnd(i + 191) * 0.14,
        rollMs: ROLL_MS[i % ROLL_MS.length]!,
        densityMs: DENSITY_MS[i % DENSITY_MS.length]!,
        delayMs: Math.round(rnd(i + 163) * 9000),
        toRight: rnd(i + 197) > 0.5,
      })),
    [width, height],
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, shift]} pointerEvents="none">
      {/*
        Stalni veo preko CIJELOG kadra: magla je posvuda, ne samo ondje
        gdje je volumen. Izričite dimenzije (ne "100%") — postotak bez
        `viewBox` je na uređaju davao kvadrat na sredini.
      */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#FFFFFF"
          opacity={BASE_VEIL_OPACITY}
        />
      </Svg>
      {banks.map((b) => (
        <Bank key={b.id} {...b} width={width} height={height} />
      ))}
    </Animated.View>
  );
});
FogLayer.displayName = "FogLayer";
