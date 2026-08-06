import { memo, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";

import { SLOPE, SPEED_BY_INTENSITY, type LayerProps } from "./shared";

/**
 * KIŠA — isprekidane kose zrake koje klize niz dijagonalu.
 *
 * (Ovo je izvorni "zrake" sloj s kojeg je sve krenulo; kad je proradio,
 * Marko je primijetio da izgleda kao kiša — pa je i postao kiša.)
 *
 * Petlja je neprimjetna jer je pomak jednog ciklusa TOČNO jednak zbroju
 * uzorka (period): svaka crtica sleti na mjesto sljedeće. Zato SVI uzorci
 * moraju imati isti zbroj — isti zahtjev kao kod crtica vjetra na karti.
 */
const DASH_PERIOD = 530;

/** Pet uzoraka (duga → praznina → kraća → praznina), svi zbroje na period. */
const DASH_PATTERNS = [
  [210, 105, 75, 140],
  [150, 130, 110, 140],
  [255, 95, 60, 120],
  [120, 145, 135, 130],
  [185, 115, 95, 135],
];

/**
 * Faza po zraci (0–1 perioda). Bez nje sve zrake s istim uzorkom počinju
 * prazninu na ISTOJ visini, pa se preko ekrana povuče vodoravni prazan
 * "val" (nađeno na uređaju 6.8.2026.). 5 uzoraka × 13 faza su relativno
 * prosti, pa nijedna zraka ne ponavlja isti ritam.
 */
const DASH_PHASES = [0, 0.62, 0.24, 0.81, 0.43, 0.13, 0.7, 0.35, 0.91, 0.55, 0.07, 0.78, 0.29];

/** Duljina jedinice duž osi zrake (nagib produljuje put). */
const AXIS = Math.hypot(1, SLOPE);
/** Trajanje jednog ciklusa — sporo, ambijentalno (≈59 px/s). */
const AMBIENT_MS = 9000;

/**
 * Bočna rezerva platna — izračunata, ne pogođena (6.8.2026.):
 *  - ambijent nosi zrake ~255 px ULIJEVO po ciklusu → treba desna rezerva
 *  - skrol (+255) i ulazna animacija (+186) guraju UDESNO, zajedno ~441 px
 *    → treba lijeva rezerva
 * 520 pokriva oba smjera i ostavlja zalihu za veće ekrane.
 */
const SIDE_PAD = 520;

/**
 * Okomita rezerva platna. Bila je vezana SAMO uz visinu (1.3 × H), pa je
 * na niskim plohama presušila: zaglavlje ladice je ~200 px visoko → 260
 * px rezerve, a ambijent po ciklusu nosi 464 px. Kiša bi nestala pa se
 * naglo vratila (nađeno na uređaju 6.8.2026.).
 *
 * Zato rezerva mora pokriti i FIKSNI ambijentalni pomak, ne samo udio
 * visine — `Math.max` uzima veću od te dvije potrebe.
 */
const AMBIENT_TRAVEL = DASH_PERIOD / Math.hypot(1, SLOPE);

/** Okomita rezerva iznad i ispod kadra, u pikselima. */
function vertPad(height: number): number {
  // 1.3 × visine pokriva ulaz i skrol (oba su udio visine); ambijent je
  // fiksan pa mu treba vlastita rezerva, uz malu zalihu.
  return Math.max(height * 1.3, AMBIENT_TRAVEL * 1.25);
}

/** Zrake: [pomak od desnog ruba u px, širina, prozirnost]. Kose 25°. */
const STRIPES: [number, number, number][] = [
  // Negativni pomaci pokrivaju DESNU rezervu (ambijent vuče ulijevo).
  [-500, 3, 0.32],
  [-470, 5, 0.24],
  [-440, 4, 0.48],
  [-408, 3, 0.36],
  [-380, 6, 0.22],
  [-355, 4, 0.44],
  [-330, 4, 0.42],
  [-300, 3, 0.3],
  [-272, 5, 0.24],
  [-244, 4, 0.5],
  [-210, 3, 0.34],
  [-180, 6, 0.22],
  [-152, 4, 0.44],
  [-120, 3, 0.38],
  [-92, 5, 0.26],
  [-68, 4, 0.5],
  [-40, 4, 0.5],
  [-22, 3, 0.3],
  [-8, 6, 0.22],
  [12, 3, 0.42],
  [30, 3, 0.38],
  [48, 5, 0.24],
  [64, 4, 0.5],
  [80, 3, 0.32],
  [96, 6, 0.22],
  [118, 4, 0.44],
  [138, 3, 0.38],
  [154, 5, 0.26],
  [170, 4, 0.5],
  [188, 3, 0.34],
  [204, 6, 0.22],
  [226, 4, 0.42],
  [246, 3, 0.38],
  [262, 5, 0.24],
  [278, 4, 0.5],
  [296, 3, 0.32],
  [312, 6, 0.22],
  [332, 4, 0.44],
  [354, 3, 0.38],
  [370, 5, 0.26],
  [386, 4, 0.5],
  // Pozitivni preko širine ekrana pokrivaju LIJEVU rezervu (skrol/ulaz).
  [410, 3, 0.34],
  [438, 6, 0.22],
  [462, 4, 0.46],
  [490, 3, 0.3],
  [516, 5, 0.24],
  [545, 4, 0.5],
  [578, 3, 0.36],
  [606, 4, 0.42],
  [634, 5, 0.24],
  [666, 3, 0.34],
  [694, 4, 0.48],
  [722, 6, 0.22],
  [752, 3, 0.36],
  [786, 4, 0.44],
  [814, 5, 0.26],
  [846, 3, 0.32],
  [878, 4, 0.5],
  [906, 3, 0.34],
];

export const RainLayer = memo(function RainLayer({
  width,
  height,
  scrollY,
  intensity = "moderate",
}: LayerProps) {
  /*
   * Brzina po jačini (dorada 6.8.2026.): rosulja jedva klizi, pljusak
   * juri. Isti sloj, samo drukčije trajanje ciklusa — petlja ostaje
   * bešavna jer se pomak (period uzorka) ne mijenja.
   */
  const ambientMs = Math.round(AMBIENT_MS * SPEED_BY_INTENSITY[intensity]);
  /** Okomita rezerva platna — na niskim plohama je fiksna, ne udio visine. */
  const pad = vertPad(height);
  /*
   * ULAZNA animacija: pri otvaranju se zrake SPUSTE dijagonalno na svoje
   * mjesto — kreću pomaknute uz svoju os prema gore-desno.
   */
  const intro = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(intro, {
      toValue: 0,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [intro]);

  /*
   * Ambijentalno klizanje: 0 → 1 u petlji, linearno (svaki drugi tempo bi
   * na spoju petlje "trznuo"). Pomak je točno jedan period uzorka.
   */
  const ambient = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ambient, {
        toValue: 1,
        duration: ambientMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [ambient, ambientMs]);

  const H = height || 1;
  const introY = intro.interpolate({ inputRange: [0, 1], outputRange: [0, -H * 0.4] });
  const introX = intro.interpolate({
    inputRange: [0, 1],
    outputRange: [0, H * 0.4 * SLOPE],
  });
  const scrollShiftY = scrollY
    ? scrollY.interpolate({ inputRange: [0, H], outputRange: [0, -H * 0.55] })
    : new Animated.Value(0);
  const scrollShiftX = scrollY
    ? scrollY.interpolate({ inputRange: [0, H], outputRange: [0, H * 0.55 * SLOPE] })
    : new Animated.Value(0);

  // Ambijent ide NIZ dijagonalu; komponenta po y = period / |(1, SLOPE)|.
  const ambientY = ambient.interpolate({
    inputRange: [0, 1],
    outputRange: [0, DASH_PERIOD / AXIS],
  });
  const ambientX = ambient.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (-DASH_PERIOD / AXIS) * SLOPE],
  });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          transform: [
            { translateY: Animated.add(Animated.add(introY, scrollShiftY), ambientY) },
            { translateX: Animated.add(Animated.add(introX, scrollShiftX), ambientX) },
          ],
        },
      ]}
    >
      {/* Platno veće od kadra na sve strane — sloj se pomiče. */}
      <Svg
        width={width + SIDE_PAD * 2}
        height={height + pad * 2}
        style={{ position: "absolute", top: -pad, left: -SIDE_PAD }}
      >
        {STRIPES.map(([offset, w, opacity], i) => (
          <Line
            key={offset}
            x1={SIDE_PAD + width - offset + pad * SLOPE}
            y1={0}
            x2={SIDE_PAD + width - offset - (height + pad) * SLOPE}
            y2={height + pad * 2}
            stroke="#FFFFFF"
            strokeWidth={w}
            strokeOpacity={opacity}
            strokeDasharray={DASH_PATTERNS[i % DASH_PATTERNS.length]}
            strokeDashoffset={-(DASH_PHASES[i % DASH_PHASES.length] ?? 0) * DASH_PERIOD}
            strokeLinecap="round"
          />
        ))}
      </Svg>
    </Animated.View>
  );
});
RainLayer.displayName = "RainLayer";
