import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import { SLOPE, rnd, type LayerProps } from "./shared";

/**
 * SUNCE — mirne kose zrake koje naizmjenično TINJAJU (ne klize), plus
 * tiho svjetlucanje: sitne točke koje se pale i gase.
 *
 * Zašto tinjanje umjesto klizanja: kad se kose crte pomiču, oko ih čita
 * kao oborinu (kiša). Sunčano vrijeme zato dobiva mirnu geometriju, a
 * život mu daje promjena SVJETLINE.
 */

/** Zrake: [pomak od desnog ruba, širina, osnovna prozirnost]. */
const RAYS: [number, number, number][] = [
  [-40, 5, 0.5],
  [-6, 3, 0.28],
  [26, 7, 0.2],
  [58, 4, 0.44],
  [92, 3, 0.3],
  [128, 6, 0.22],
  [166, 4, 0.48],
  [198, 3, 0.26],
  [232, 7, 0.2],
  [268, 4, 0.42],
  [304, 3, 0.3],
  [338, 6, 0.22],
  [374, 4, 0.5],
  [408, 3, 0.28],
  [444, 5, 0.24],
];

/**
 * Svaka zraka diše svojim tempom — trajanja se ne smiju poklopiti.
 * BRŽE od prvotnog (6.8.2026.): 5.2–8.3 s je izgledalo kao da se ništa
 * ne događa; sada se nestajanje i povratak jasno vide.
 */
const BREATH_MS = [2100, 2900, 1700, 3300, 2400, 3700, 1900];

/** Broj iskrica svjetlucanja. Malo — efekt je potpis, ne konfeti. */
const SPARKLES = 16;
/**
 * PRETEŽNO VEDRO dobiva MANJE iskrica (Markov ispravak 8.8.2026.).
 *
 * Otkad kod 1 crta zrake UZ oblake, na nebu je bilo i punih 16 iskrica i
 * oblaka — pretrpano za stanje koje je "vedro, ali ne posve". Isti
 * `density="sparse"` koji već prorjeđuje oblake sada prorjeđuje i njih.
 *
 * Čisto vedro (kod 0) ostaje na punom broju: ondje su iskrice jedini
 * ukras na nebu.
 */
const SPARKLES_SPARSE = 7;
/**
 * BLJESAK, ne tinjanje (dorada 6.8.2026.): iskrica plane za ~180 ms,
 * ugasi se za ~420 ms i onda dugo MIRUJE. Prije je paljenje trajalo
 * 2.6–4.1 s pa su točke lebdjele preko ekrana kao snijeg.
 */
const FLASH_IN_MS = 180;
const FLASH_OUT_MS = 420;
/** Mirovanje između bljeskova — dugo i različito po skupini. */
const REST_MS = [2400, 3800, 5200, 3100, 6400, 4300];

/**
 * Koliko skupina dijeli jednu animaciju. Manje slojeva = brže montiranje
 * pri prebacivanju grada; dovoljno skupina da se ritam i dalje čita kao
 * nepravilan.
 */
const RAY_GROUPS = 4;
const SPARKLE_GROUPS = 3;

/**
 * Četverokraka zvjezdica ("blic"): duži okomiti i vodoravni krak, kraći
 * dijagonalni. `k` je koliko se krivulja uvlači prema središtu — manji
 * broj daje šiljastije krakove.
 */
function sparkPath(cx: number, cy: number, r: number): string {
  const k = r * 0.26;
  const d = r * 0.44;
  return [
    `M ${cx} ${cy - r}`,
    `C ${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + d} ${cy - d}`,
    `C ${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy}`,
    `C ${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx + d} ${cy + d}`,
    `C ${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r}`,
    `C ${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - d} ${cy + d}`,
    `C ${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy}`,
    `C ${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx - d} ${cy - d}`,
    `C ${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}`,
    "Z",
  ].join(" ");
}

/**
 * SKUPINA zraka koje dišu zajedno — jedan `Animated.View` + jedan `Svg`
 * za više linija (dorada 6.8.2026.).
 *
 * Zašto grupno: prije je svaka zraka bila vlastiti sloj s vlastitom
 * petljom (15 zraka + 16 iskrica = 31 sloj). Sve se to gradilo u
 * trenutku prebacivanja grada, pa je prijelaz na početnu "štekao".
 * Skupine zadržavaju dojam nepravilnosti (svaka ima svoj tempo i
 * odmak), a montira se 4 sloja umjesto 15.
 */
const RayGroup = memo(function RayGroup({
  lines,
  height,
  durationMs,
  delayMs,
}: {
  lines: [number, number, number][];
  height: number;
  durationMs: number;
  delayMs: number;
}) {
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: durationMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    // Odmak u startu: bez njega sve zrake dišu u isto (efekt "pulsa").
    const timer = setTimeout(() => loop.start(), delayMs);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [breath, durationMs, delayMs]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          /*
           * Raspon disanja je ŠIROK (0.06 → puna): zrake vidljivo
           * nestaju i vraćaju se, umjesto da samo blago posvijetle.
           * Nikad do čiste nule — pojava iz ničega bi "iskakala".
           */
          opacity: breath.interpolate({
            inputRange: [0, 1],
            outputRange: [0.06, 1],
          }),
        },
      ]}
      pointerEvents="none"
    >
      <Svg width="100%" height="100%">
        {lines.map(([x, w, opacity]) => (
          <Line
            key={x}
            x1={x}
            y1={0}
            x2={x - height * SLOPE}
            y2={height}
            stroke="#FFFFFF"
            strokeWidth={w}
            // Prozirnost po zraci ostaje na SAMOJ liniji; grupa animira
            // samo zajednički množitelj.
            strokeOpacity={opacity}
            strokeLinecap="round"
          />
        ))}
      </Svg>
    </Animated.View>
  );
});

/**
 * Iskrica: kratak bljesak pa dugo mirovanje. Skalira se uz prozirnost
 * (0.4 → 1) da bljesak "iskoči", umjesto da samo posvijetli.
 */
const SparkleGroup = memo(function SparkleGroup({
  dots,
  restMs,
  delayMs,
}: {
  dots: { x: number; y: number; r: number }[];
  restMs: number;
  delayMs: number;
}) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
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
        // Mirovanje: bez njega je ekran pun stalnog treperenja.
        Animated.delay(restMs),
      ]),
    );
    const timer = setTimeout(() => loop.start(), delayMs);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [glow, restMs, delayMs]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          /*
           * SAMO prozirnost, BEZ skaliranja (nađeno na uređaju
           * 6.8.2026.): `scale` na sloju preko cijelog ekrana skalira
           * oko SREDIŠTA EKRANA, pa su zvjezdice daleko od centra
           * putovale prema njemu i natrag — izgledalo je kao da skaču
           * odozdo prema gore. Zvjezdica se samo pali i gasi na mjestu.
           */
          opacity: glow,
        },
      ]}
      pointerEvents="none"
    >
      <Svg width="100%" height="100%">
        {/*
          Četverokraka zvjezdica (dva duža kraka okomito/vodoravno, dva
          kraća dijagonalno) — kao ikona bljeska. Krugovi su izgledali
          kao loptice koje iskaču (uređaj, 6.8.2026.).

          Krakovi su BEZIER krivulje prema središtu, pa je zvjezdica
          uska u struku i šiljasta na vrhovima.
        */}
        {dots.map((d) => (
          <Path
            key={`${d.x}-${d.y}`}
            d={sparkPath(d.x, d.y, d.r)}
            fill="#FFFFFF"
            opacity={0.95}
          />
        ))}
      </Svg>
    </Animated.View>
  );
});

export const RaysLayer = memo(function RaysLayer({
  width,
  height,
  scrollY,
  density,
}: LayerProps) {
  const H = height || 1;

  /*
   * Blaga paralaksa na skrol: zrake miruju, pa se smiju pomicati SAMO
   * dok se skrola — inače bi se opet čitale kao oborina.
   */
  const shift = scrollY
    ? {
        transform: [
          {
            translateY: scrollY.interpolate({
              inputRange: [0, H],
              outputRange: [0, -H * 0.3],
              extrapolate: "clamp",
            }),
          },
        ],
      }
    : undefined;

  /*
   * Zrake razvrstane u SKUPINE koje dišu zajedno (dorada 6.8.2026.):
   * `i % RAY_GROUPS` miješa susjedne zrake u različite skupine, pa se
   * disanje i dalje čita kao nepravilno, a montira se 4 sloja umjesto
   * 15 — prijelaz na novi grad time prestaje štecati.
   */
  const rayGroups = useMemo(() => {
    const groups: [number, number, number][][] = Array.from(
      { length: RAY_GROUPS },
      () => [],
    );
    RAYS.forEach(([offset, w, opacity], i) => {
      groups[i % RAY_GROUPS]!.push([width - offset, w, opacity]);
    });
    return groups;
  }, [width]);

  /** Iskrice: determinističan raspored (bez Math.random) u gornje 2/3. */
  const sparkleGroups = useMemo(() => {
    const groups: { x: number; y: number; r: number }[][] = Array.from(
      { length: SPARKLE_GROUPS },
      () => [],
    );
    const total = density === "sparse" ? SPARKLES_SPARSE : SPARKLES;
    for (let i = 0; i < total; i++) {
      groups[i % SPARKLE_GROUPS]!.push({
        x: rnd(i + 1) * width,
        y: rnd(i + 41) * height * 0.62,
        // Veće nego prije: krakovi zvjezdice moraju biti vidljivi.
        r: 3.4 + rnd(i + 91) * 3.2,
      });
    }
    return groups;
  }, [width, height, density]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, shift]} pointerEvents="none">
      {rayGroups.map((lines, i) => (
        <RayGroup
          key={i}
          lines={lines}
          height={height}
          durationMs={BREATH_MS[i % BREATH_MS.length]!}
          delayMs={Math.round(rnd(i + 7) * 2600)}
        />
      ))}
      {sparkleGroups.map((dots, i) => (
        <SparkleGroup
          key={i}
          dots={dots}
          restMs={REST_MS[i % REST_MS.length]!}
          // Širok raspon odmaka: bljeskovi se ne smiju poklopiti.
          delayMs={Math.round(rnd(i + 131) * 7000)}
        />
      ))}
    </Animated.View>
  );
});
RayGroup.displayName = "RayGroup";
SparkleGroup.displayName = "SparkleGroup";
RaysLayer.displayName = "RaysLayer";
