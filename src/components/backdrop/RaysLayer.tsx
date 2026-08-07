import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Defs, Line, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { SLOPE, rnd, type LayerProps } from "./shared";

/**
 * SUNCE — mirne kose zrake koje naizmjenično TINJAJU (ne klize), uz
 * mekan sjaj koji ulazi preko gornjeg desnog ruba.
 *
 * Zašto tinjanje umjesto klizanja: kad se kose crte pomiču, oko ih čita
 * kao oborinu (kiša). Sunčano vrijeme zato dobiva mirnu geometriju, a
 * život mu daje promjena SVJETLINE.
 *
 * ISKRICE SU MAKNUTE (Markov ispravak 8.8.2026.): sitne točke koje su se
 * palile i gasile su se na DNEVNOM nebu čitale kao ZVIJEZDE, a zvijezde
 * su jezik noći (`StarsLayer`). Sunce sada nosi zrake i sjaj — danju se
 * vidi svjetlo, ne točke. (Kod je obrisan; u povijesti je pod
 * `SparkleGroup` ako ikad zatreba odsjaj na moru.)
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

/**
 * Koliko skupina dijeli jednu animaciju. Manje slojeva = brže montiranje
 * pri prebacivanju grada; dovoljno skupina da se ritam i dalje čita kao
 * nepravilan.
 */
const RAY_GROUPS = 4;


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

  return (
    <Animated.View style={[StyleSheet.absoluteFill, shift]} pointerEvents="none">
      {/*
        SJAJ SUNCA U GORNJEM DESNOM KUTU (Markov zahtjev 8.8.2026.).

        Isti potez kao na widgetu, ali izveden GRADIJENTOM, ne zamućenim
        krugom: `feGaussianBlur` na Androidu zna otpasti (naučeno na
        Android widgetu 8.8. — oblaci su ostajali tvrdi krugovi), a
        `RadialGradient` je ISPUNA i prolazi svuda jednako.

        Središte je na samom KUTU (100 %, 0 %), pa se vidi četvrtina
        sjaja — svjetlo koje ulazi preko ruba, a ne mrlja nalijepljena
        na nebo.

        RADIJUS JE IZMJEREN, ne pogođen. Prva izvedba je imala 95 % i
        renderom se pokazala kao promašaj: gornji desni i gornji LIJEVI
        kut razlikovali su se za **1 razinu svjetline** — sjaj se razlio
        preko cijelog vrha i čitao se samo kao „nebo je gore svjetlije".
        Mjereno na tri radijusa (razlika desni−lijevi kut): 95 % → 1,
        55 % → 18, **45 % → 35**. Tek zadnji se čita kao izvor svjetla.

        Dva stopa iznad nule (0.42 → 0.16 na 35 %) drže jezgru punom
        prije pada; s jednim stopom prijelaz izgleda kao krug s rubom.
      */}
      <Svg width="100%" height="100%" pointerEvents="none">
        <Defs>
          <RadialGradient id="sun-glow" cx="100%" cy="0%" r="45%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.42" />
            <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sun-glow)" />
      </Svg>

      {rayGroups.map((lines, i) => (
        <RayGroup
          key={i}
          lines={lines}
          height={height}
          durationMs={BREATH_MS[i % BREATH_MS.length]!}
          delayMs={Math.round(rnd(i + 7) * 2600)}
        />
      ))}
    </Animated.View>
  );
});
RayGroup.displayName = "RayGroup";
RaysLayer.displayName = "RaysLayer";
