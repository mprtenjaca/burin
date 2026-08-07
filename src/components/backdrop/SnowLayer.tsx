import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { SPEED_BY_INTENSITY, rnd, type LayerProps } from "./shared";

/**
 * SNIJEG — pahulje koje polako padaju i pritom se NJIŠU lijevo-desno.
 *
 * Svaka pahulja je vlastiti `Animated.View` s dvije neovisne petlje: pad
 * (linearan, bešavan) i njihanje (sinusno). Padu se ne smije mijenjati
 * tempo — na spoju petlje bi "trznuo".
 */
const FLAKES = 26;

/** Koliko skupina dijeli jednu petlju pada — manje slojeva, brže montiranje. */
const FLAKE_GROUPS = 5;

/**
 * Trajanja pada; različita da se pahulje ne slože u redove.
 * BRŽE od prvotnog (6.8.2026.): 9–18 s je izgledalo kao da pahulje
 * lebde u mjestu; sada se jasno vidi da PADAJU.
 */
const FALL_MS = [5200, 6800, 4300, 7600, 5900, 8400, 4900];
/** Trajanja njihanja — namjerno neuskladiva s padom. */
const SWAY_MS = [3100, 4300, 2700, 3700, 5100];

/**
 * SKUPINA pahulja koje dijele jednu animaciju pada i njihanja (dorada
 * 6.8.2026.).
 *
 * Zašto grupno: prije je svaka pahulja bila vlastiti `Animated.View` s
 * dvije petlje (26 slojeva, 52 petlje). Sve se gradilo pri prebacivanju
 * grada, pa je prijelaz "štekao". Raspored unutar skupine je i dalje
 * nepravilan — pahulje se razlikuju po x, veličini i POČETNOJ VISINI —
 * pa se zajednički pad ne primjećuje.
 */
const FlakeGroup = memo(function FlakeGroup({
  flakes,
  height,
  fallMs,
  swayMs,
  swayPx,
  phase,
}: {
  flakes: { x: number; y: number; r: number; opacity: number }[];
  height: number;
  fallMs: number;
  swayMs: number;
  swayPx: number;
  /**
   * Početna FAZA ciklusa (0–1), umjesto odgode pokretanja.
   *
   * Skupine se moraju razlikovati da pad ne izgleda kao jedan blok, ali
   * se to NE smije postići čekanjem: skupina koja čeka stoji na mjestu i
   * čita se kao greška (vidi popravak u tijelu komponente).
   */
  phase: number;
}) {
  const fall = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fallLoop = Animated.loop(
      Animated.timing(fall, {
        toValue: 1,
        duration: fallMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: swayMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: -1,
          duration: swayMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    /*
     * ODMAK IDE U FAZU, NE U ODGODU POKRETANJA (popravak 8.8.2026.).
     *
     * Prije je ovdje stajao `setTimeout` do 4 s prije `start()`. Dva
     * kvara koja su se na uređaju vidjela zajedno:
     *
     *  1. SNIJEG KREĆE OD POLA EKRANA — skupina je do 4 s stajala
     *     ZAMRZNUTA dok su ostale padale. Kako su pahulje unaprijed
     *     razbacane preko dvostruke visine, nepomična skupina se čita
     *     kao "snijeg počinje na pola".
     *  2. VODORAVNI TRAGOVI — čekao je i `swayLoop`, pa su pahulje sve
     *     to vrijeme visjele na FIKSNOM bočnom pomaku. Statičan pomak uz
     *     pad izgleda kao razvučena crta ulijevo ili udesno.
     *
     * Rješenje: petlje kreću ODMAH, a razlika među skupinama se dobiva
     * POČETNOM VRIJEDNOŠĆU. `fall` starta na svom dijelu ciklusa (0–1),
     * `sway` na svom (−1..1), pa je raspored i dalje nepravilan — ali
     * ništa ne stoji.
     */
    fall.setValue(phase);
    sway.setValue(Math.sin(phase * Math.PI * 2));
    fallLoop.start();
    swayLoop.start();
    return () => {
      fallLoop.stop();
      swayLoop.stop();
    };
  }, [fall, sway, fallMs, swayMs, phase]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          transform: [
            {
              /*
               * Skupina putuje TOČNO jednu visinu kadra; pahulje unutar
               * nje već stoje na različitim visinama (`y`), pa se stalno
               * netko nalazi u kadru. Platno je dvostruko visoko i
               * pomaknuto gore, pa se ulazak i izlazak nikad ne vide.
               */
              translateY: fall.interpolate({
                inputRange: [0, 1],
                outputRange: [0, height],
              }),
            },
            {
              translateX: sway.interpolate({
                inputRange: [-1, 1],
                outputRange: [-swayPx, swayPx],
              }),
            },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <Svg
        width="100%"
        height={height * 2}
        style={{ position: "absolute", top: -height }}
      >
        {flakes.map((f) => (
          <Circle
            key={`${f.x}-${f.y}`}
            cx={f.x}
            cy={f.y}
            r={f.r}
            fill="#FFFFFF"
            opacity={f.opacity}
          />
        ))}
      </Svg>
    </Animated.View>
  );
});

export const SnowLayer = memo(function SnowLayer({
  width,
  height,
  scrollY,
  intensity = "moderate",
}: LayerProps) {
  const H = height || 1;
  const speed = SPEED_BY_INTENSITY[intensity];

  const shift = scrollY
    ? {
        transform: [
          {
            translateY: scrollY.interpolate({
              inputRange: [0, H],
              outputRange: [0, -H * 0.35],
              extrapolate: "clamp",
            }),
          },
        ],
      }
    : undefined;

  /**
   * Pahulje razvrstane u SKUPINE koje padaju zajedno (dorada 6.8.2026.).
   * Determinističan raspored — inače skaču na svaki re-render.
   *
   * `y` je početna visina UNUTAR skupine: raspoređena je preko dvostruke
   * visine platna, pa dok skupina putuje jednu visinu, uvijek netko
   * ulazi odozgo i netko izlazi dolje.
   */
  const flakeGroups = useMemo(() => {
    const groups: { x: number; y: number; r: number; opacity: number }[][] =
      Array.from({ length: FLAKE_GROUPS }, () => []);
    for (let i = 0; i < FLAKES; i++) {
      groups[i % FLAKE_GROUPS]!.push({
        x: rnd(i + 3) * width,
        y: rnd(i + 199) * height * 2,
        // Manje pahulje su "dalje": sitnije i bljeđe.
        r: 1.4 + rnd(i + 53) * 2.4,
        opacity: 0.3 + rnd(i + 97) * 0.45,
      });
    }
    return groups;
  }, [width, height]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, shift]} pointerEvents="none">
      {flakeGroups.map((flakes, i) => (
        <FlakeGroup
          key={i}
          flakes={flakes}
          height={height}
          // Gušća oborina pada brže; njihanje ostaje isto (vjetar, ne pad).
          fallMs={Math.round(FALL_MS[i % FALL_MS.length]! * speed)}
          swayMs={SWAY_MS[i % SWAY_MS.length]!}
          swayPx={12 + rnd(i + 149) * 14}
          // Faza umjesto odgode — vidi FlakeGroup: odgoda je skupinu
          // ostavljala nepomičnu, pa je snijeg "kretao od pola ekrana".
          phase={rnd(i + 211)}
        />
      ))}
    </Animated.View>
  );
});
FlakeGroup.displayName = "FlakeGroup";
SnowLayer.displayName = "SnowLayer";
