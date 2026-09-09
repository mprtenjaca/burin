import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Defs, Ellipse, G, RadialGradient, Stop } from "react-native-svg";

import { rnd, type LayerProps } from "./shared";

/**
 * OBLAČNO — oblaci koji polako plove preko neba.
 *
 * Dvije generacije prije ovoga nisu radile (obje nađene na uređaju
 * 6.8.2026.):
 *  1. vodoravne trake — čitale su se kao pruge, ne kao oblaci
 *  2. blijede bijele mrlje — na svijetlosivom gradijentu oblačnog
 *     vremena bijelo na bijelom je nevidljivo
 *
 * Zato oblak sada ima i SVJETLO i SJENU: tamnija podloga daje mu obris
 * na svijetlom nebu, svjetliji vrh volumen. Oblik je skup elipsi
 * (grozd), ne jedna — jedna elipsa izgleda kao mrlja, tri kao oblak.
 */
const CLOUDS = 5;

/**
 * Bočna rezerva platna: oblak sme viriti izvan kadra, ali ne smije biti
 * srezan ravnim bridom. Grozd seže ~1.2 × rx (max ~150 px) i plovi
 * ±0.16 × širine, pa 260 px pokriva i najveći slučaj.
 */
const EDGE_PAD = 260;

/** Plovljenje i disanje — trajanja nisu djeljiva pa se ne poklapaju. */
const DRIFT_MS = [19000, 25000, 22000, 28000, 31000];
const BREATH_MS = [6300, 8100, 7200, 9400];

const Cloud = memo(function Cloud({
  id,
  cx,
  cy,
  scale,
  opacity,
  width,
  height,
  driftMs,
  breathMs,
  delayMs,
  toRight,
}: {
  id: string;
  cx: number;
  cy: number;
  scale: number;
  opacity: number;
  width: number;
  height: number;
  driftMs: number;
  breathMs: number;
  delayMs: number;
  toRight: boolean;
}) {
  const drift = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

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
    const d = pingPong(drift, driftMs);
    const b = pingPong(breath, breathMs);
    const timer = setTimeout(() => {
      d.start();
      b.start();
    }, delayMs);
    return () => {
      clearTimeout(timer);
      d.stop();
      b.stop();
    };
  }, [drift, breath, driftMs, breathMs, delayMs]);

  // Kraći put: veći je gurao oblake preko ruba, gdje se vidi rez.
  const travel = width * 0.16;
  const rx = 92 * scale;
  const ry = 42 * scale;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: breath.interpolate({
            inputRange: [0, 1],
            outputRange: [opacity * 0.55, opacity],
          }),
          transform: [
            {
              translateX: drift.interpolate({
                inputRange: [0, 1],
                outputRange: toRight ? [-travel, travel] : [travel, -travel],
              }),
            },
          ],
        },
      ]}
      pointerEvents="none"
    >
      {/*
        Platno je ŠIRE od kadra za `EDGE_PAD` sa svake strane i pomaknuto
        ulijevo: bez toga je oblak koji dosegne rub bio SREZAN ravnim
        bridom (uređaj 6.8.2026.). Sada može mirno viriti izvan ekrana.
      */}
      <Svg
        width={width + EDGE_PAD * 2}
        height={height}
        style={{ position: "absolute", left: -EDGE_PAD }}
      >
        <Defs>
          {/* SJENA: tamni trbuh daje obris na svijetlom nebu. */}
          <RadialGradient id={`${id}-dark`} cx="50%" cy="55%" r="55%">
            <Stop offset="0" stopColor="#3A4048" stopOpacity="0.5" />
            <Stop offset="0.6" stopColor="#3A4048" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#3A4048" stopOpacity="0" />
          </RadialGradient>
          {/* SVJETLO: posvijetljen vrh — volumen, ne ploha. */}
          <RadialGradient id={`${id}-light`} cx="50%" cy="35%" r="52%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/*
          Cijeli grozd je pomaknut za `EDGE_PAD`, jer je platno šire od
          kadra i počinje lijevo od njega — koordinate ostaju u sustavu
          ekrana, pomak radi jedna transformacija.
        */}
        <G x={EDGE_PAD}>
        <G>
          <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id}-dark)`} />
          <Ellipse
            cx={cx - rx * 0.55}
            cy={cy + ry * 0.25}
            rx={rx * 0.62}
            ry={ry * 0.72}
            fill={`url(#${id}-dark)`}
          />
          <Ellipse
            cx={cx + rx * 0.6}
            cy={cy + ry * 0.2}
            rx={rx * 0.58}
            ry={ry * 0.68}
            fill={`url(#${id}-dark)`}
          />
        </G>
        <G>
          <Ellipse
            cx={cx}
            cy={cy - ry * 0.22}
            rx={rx * 0.82}
            ry={ry * 0.78}
            fill={`url(#${id}-light)`}
          />
          <Ellipse
            cx={cx - rx * 0.5}
            cy={cy}
            rx={rx * 0.48}
            ry={ry * 0.56}
            fill={`url(#${id}-light)`}
          />
        </G>
        </G>
      </Svg>
    </Animated.View>
  );
});
Cloud.displayName = "Cloud";

export const CloudsLayer = memo(function CloudsLayer({
  width,
  height,
  scrollY,
  density = "full",
}: LayerProps) {
  const H = height || 1;
  /*
   * ČETIRI GUSTOĆE (9.9.2026.; bile dvije od 6.8.). Brojke po razini:
   *
   *   razina  oblaka  neprozirnost   položaj (od vrha)
   *   sparse    3     0.22–0.38      gornja trećina (uz sunce)
   *   medium    4     0.42–0.62      gornja polovica
   *   dense     5     0.52–0.78      gornje dvije trećine
   *   full      5     0.40–0.75      polovica (kao dosad)
   *
   * Povod: „na djelomično imam dojam da je praktički full sunce" — stari
   * `sparse` (3 oblaka na 0.22–0.38) je za DJELOMIČNO bio prerijedak, a
   * jedina druga razina bila je puna naoblaka. Referenca je V&R-ov
   * Benkovac uz „pretežno oblačno": veliki mekani oblaci koji vidno
   * pokrivaju nebo, a nebo ipak nije zatvoreno.
   *
   * `dense` je namjerno NEPROZIRNIJI od `full`, ne rjeđi: pretežno
   * oblačno na svijetloj plavoj podlozi (djelomično oblačno paleta)
   * treba jače obrise da se vidi, dok `full` stoji na sivoj gdje bi isto
   * već bilo previše. Razlika prema `full` je i u položaju: `full` seže
   * dublje, `dense` ostaje gore i pušta velikoj brojki čistu podlogu.
   */
  const sparse = density === "sparse";
  const medium = density === "medium";
  const dense = density === "dense";
  const count = sparse ? 3 : medium ? 4 : CLOUDS;

  const shift = scrollY
    ? {
        transform: [
          {
            translateY: scrollY.interpolate({
              inputRange: [0, H],
              outputRange: [0, -H * 0.28],
              extrapolate: "clamp",
            }),
          },
        ],
      }
    : undefined;

  /** Determinističan raspored — inače oblaci skaču na svaki re-render. */
  const clouds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: `cloud-${i}`,
        // Puna širina: rezanje na rubu rješava rezerva platna (EDGE_PAD).
        cx: width * (0.1 + rnd(i + 5) * 0.85),
        /*
         * Raspoređeni niže: plavo seže preko pola ekrana (Markov odabir).
         * Rijetki idu JOŠ VIŠE (gornja trećina) — sunce je na vrhu kadra,
         * pa oblaci uz njega izgledaju kao dio istog neba, a velika
         * brojka u sredini ostaje na čistoj podlozi.
         */
        cy: sparse
          ? height * (0.04 + rnd(i + 47) * 0.26)
          : medium
            ? height * (0.05 + rnd(i + 47) * 0.4)
            : dense
              ? height * (0.05 + rnd(i + 47) * 0.55)
              : height * (0.06 + rnd(i + 47) * 0.5),
        // Srednja i gusta razina nose VEĆE oblake: mali oblak i kad je
        // neproziran ostaje „mrljica", a Benkovac ima velike mekane mase.
        scale: (medium || dense ? 1.0 : 0.8) + rnd(i + 89) * 0.8,
        // Blijeđe kad ih je malo: oblak uz sunce ne smije "težiti".
        opacity: sparse
          ? 0.22 + rnd(i + 127) * 0.16
          : medium
            ? 0.42 + rnd(i + 127) * 0.2
            : dense
              ? 0.52 + rnd(i + 127) * 0.26
              : 0.4 + rnd(i + 127) * 0.35,
        driftMs: DRIFT_MS[i % DRIFT_MS.length]!,
        breathMs: BREATH_MS[i % BREATH_MS.length]!,
        delayMs: Math.round(rnd(i + 173) * 6000),
        toRight: rnd(i + 211) > 0.5,
      })),
    [width, height, count, sparse, medium, dense],
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, shift]} pointerEvents="none">
      {clouds.map((c) => (
        <Cloud key={c.id} {...c} width={width} height={height} />
      ))}
    </Animated.View>
  );
});
CloudsLayer.displayName = "CloudsLayer";
