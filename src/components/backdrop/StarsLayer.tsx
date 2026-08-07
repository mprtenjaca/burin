import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle, Defs, Mask, RadialGradient, Stop } from "react-native-svg";

import { moonPhase, moonShadowOffset } from "@/utils/weatherLook";

import { rnd, type LayerProps } from "./shared";

/**
 * VEDRA NOĆ — zvjezdano nebo s mjesecom u pravoj mijeni (6.8.2026.).
 *
 * Zašto uopće postoji: vedra noć je dotad padala u `default` granu
 * `backdropEffects` i dobivala OBLAKE — dakle "vedro" se crtalo kao
 * naoblaka. Paleta (`nightClear`) je cijelo vrijeme bila ispravna, samo
 * sloj nije.
 *
 * Zvijezde su noćni parnjak sunčevim zrakama i slijede isto pravilo:
 * NE POMIČU SE, samo mijenjaju svjetlinu. Točka koja klizi nebom čita se
 * kao pahulja ili kap — mirna geometrija je ono što razlikuje vedro
 * vrijeme od oborine.
 */

/** Boja zvijezda i mjeseca — topla bijela, ne čisto #FFF (blaže na oku). */
const STAR = "#F4F6FF";
const MOON = "#F8F7F2";

/**
 * Zvijezde se dijele na DVIJE vrste, jer pravo nebo nije ujednačeno:
 *  - `dust`  brojne sitne točkice koje jedva tinjaju (dubina neba)
 *  - `bright` malobrojne krupnije koje jasno pulsiraju (ono što se pamti)
 *
 * Bez sitnih je nebo prazno, bez krupnih je monotono.
 */
const DUST_COUNT = 54;
const BRIGHT_COUNT = 11;

/**
 * Skupine koje dijele jednu animacijsku petlju. Pravilo projekta: po
 * element = po `Animated.View` se ne skalira (sunce je montiralo 31
 * sloj). Nepravilnost se čuva razlikama UNUTAR skupine — položajem,
 * veličinom i početnom fazom.
 */
const DUST_GROUPS = 3;
const BRIGHT_GROUPS = 4;

/**
 * Trajanja disanja SITNIH zvijezda — one nose mirnu dubinu neba, pa
 * ostaju spore. Namjerno se ne poklapaju (inače cijelo nebo pulsira u
 * taktu).
 */
const DUST_BREATH_MS = [3000, 3800, 2400];

/**
 * KRUPNE zvijezde SIJEVAJU, ne dišu (dorada 6.8.2026.).
 *
 * Prvo su i one samo tinjale: puni ciklus 7–11 s uz promjenu od 0.25
 * alfe. Izmjereno je da je to ispod praga zamjećivanja — na uređaju se
 * činilo da animacije nema. Ista greška koju je RaysLayer već imao
 * ("5.2–8.3 s je izgledalo kao da se ništa ne događa").
 *
 * Sada: zvijezda plane za ~260 ms, ugasi se za ~700 ms i onda MIRUJE
 * nekoliko sekundi. Oko hvata promjenu, ali nebo ostaje mirno — jer u
 * svakom trenutku sijeva samo pokoja.
 */
const FLASH_IN_MS = 260;
const FLASH_OUT_MS = 700;
/** Mirovanje između bljeskova po skupini — dugo i različito. */
const REST_MS = [1800, 3200, 2400, 4100];

/**
 * Koliko visine zauzima zvjezdano polje (0.86 od 6.8.2026., prije 0.62).
 *
 * Nebo mora sezati DUBLJE niz ekran, kao i gradijent — inače zvijezde
 * stanu na dvije trećine dok boja ide do 0.9, pa se donji dio heroja
 * vidi kao prazan pojas ispod zvjezdanog neba. Fade prema karticama ih
 * ionako gasi na dnu.
 */
const FIELD_H = 0.86;

/**
 * Mjesec: udio širine od DESNOG ruba i visina.
 *
 * Podignut na 0.17 (Markov ispravak 6.8.2026., prije 0.3): traka
 * upozorenja stoji točno preko te visine i zaklanjala ga je. Sada je
 * IZNAD trake, u pojasu s datumom, gdje ništa ne stoji desno.
 */
const MOON_RIGHT = 0.2;
const MOON_TOP = 0.17;
const MOON_R = 26;

type Star = { x: number; y: number; r: number; base: number };

/**
 * Determinističan raspored (`rnd`, ne Math.random): pri svakom renderu
 * mora ispasti isto nebo, inače zvijezde "skaču" na svaku promjenu
 * stanja — točno onaj bug koji je već jednom uhvaćen na uređaju.
 */
function makeStars(count: number, w: number, h: number, seed: number, big: boolean): Star[] {
  return Array.from({ length: count }, (_, i) => {
    const s = seed + i * 7;
    return {
      x: rnd(s) * w,
      y: rnd(s + 1) * h * FIELD_H,
      r: big ? 1.6 + rnd(s + 2) * 1.4 : 0.6 + rnd(s + 3) * 0.7,
      /*
       * Osnovna prozirnost: krupne idu do PUNE bijele (bljesak ih vodi
       * na `base × 1`), sitne su tek nagoviještene. Krupne su podignute
       * s 0.55–0.90 na 0.75–1.0 jer u miru stoje na 45 % te vrijednosti
       * — s prijašnjom bazom bi u miru bile jedva vidljive.
       */
      base: big ? 0.75 + rnd(s + 4) * 0.25 : 0.2 + rnd(s + 5) * 0.32,
    };
  });
}

export const StarsLayer = memo(function StarsLayer({
  width,
  height,
  scrollY,
  density = "full",
}: LayerProps) {
  /*
   * `sparse` prorjeđuje polje na ~55 % i gasi mjesec. Zasad ga ne koristi
   * nijedno vrijeme, ali sloj mora poštovati isti ugovor kao ostali —
   * kad zatreba noćna kombinacija (npr. malo oblaka uz zvijezde), rjeđe
   * nebo je već tu.
   */
  const sparse = density === "sparse";
  const dustCount = sparse ? Math.round(DUST_COUNT * 0.55) : DUST_COUNT;
  const brightCount = sparse ? Math.round(BRIGHT_COUNT * 0.55) : BRIGHT_COUNT;

  const dust = useMemo(
    () => makeStars(dustCount, width, height, 11, false),
    [dustCount, width, height],
  );
  const bright = useMemo(
    () => makeStars(brightCount, width, height, 907, true),
    [brightCount, width, height],
  );

  /*
   * Mijena se računa JEDNOM po montiranju: srp se mijenja danima, pa nema
   * razloga da se osvježava u renderu. `Date.now()` je ovdje namjeran —
   * mjesec mora odgovarati stvarnoj noći.
   */
  const shadow = useMemo(() => moonShadowOffset(moonPhase()), []);

  const dustAnims = useRef(
    Array.from({ length: DUST_GROUPS }, () => new Animated.Value(0)),
  ).current;
  const brightAnims = useRef(
    Array.from({ length: BRIGHT_GROUPS }, () => new Animated.Value(0)),
  ).current;
  /** Mjesec diše vrlo sporo i vrlo malo — samo da ne bude mrtva naljepnica. */
  const moonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /*
     * DVA RITMA (dorada 6.8.2026.):
     *  - sitne DIŠU: sporo gore-dolje, nose mirnu dubinu neba
     *  - krupne SIJEVAJU: brzo plane, ugasi se, pa dugo miruje
     *
     * Uvijek native driver: JS driver štuca nakon reloada, jer je JS
     * thread tada zauzet montiranjem aplikacije.
     */
    const breathe = (v: Animated.Value, ms: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: ms,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: ms,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const flash = (v: Animated.Value, rest: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: FLASH_IN_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: FLASH_OUT_MS,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          // Mirovanje: bez njega bi zvijezde treptale kao alarm.
          Animated.delay(rest),
        ]),
      );

    const loops = [
      ...dustAnims.map((v, i) => breathe(v, DUST_BREATH_MS[i] ?? 3000)),
      ...brightAnims.map((v, i) => flash(v, REST_MS[i] ?? 2600)),
      // Mjesec diše vrlo sporo i vrlo malo — samo da ne bude naljepnica.
      breathe(moonAnim, 7200),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dustAnims, brightAnims, moonAnim]);

  /*
   * Paralaksa: nebo se pomiče SPORIJE od sadržaja (0.25), pa se pri
   * skrolu dobiva dubina. Zvijezde su najdalji sloj koji app crta, zato
   * je faktor manji nego kod oblaka.
   */
  const parallax = scrollY
    ? scrollY.interpolate({
        inputRange: [0, height],
        outputRange: [0, -height * 0.25],
        extrapolate: "clamp",
      })
    : 0;

  /*
   * `range` je [mirno, na vrhuncu] — množitelj osnovne prozirnosti
   * zvijezde. Sitne PADAJU prema nuli (dišu iz mirnog stanja), krupne
   * RASTU iznad 1 (plane jače od mirnog stanja) — zato su rasponi
   * obrnuti, a ne samo različiti po iznosu.
   */
  const groups: {
    stars: Star[];
    anim: Animated.Value;
    range: [number, number];
    glow: boolean;
  }[] = [
    ...dustAnims.map((anim, g) => ({
      stars: dust.filter((_, i) => i % DUST_GROUPS === g),
      anim,
      // Sitne se gase gotovo do nule — dojam da ih ima još dublje.
      range: [1, 0.25] as [number, number],
      glow: false,
    })),
    ...brightAnims.map((anim, g) => ({
      stars: bright.filter((_, i) => i % BRIGHT_GROUPS === g),
      anim,
      // Krupne u miru tinjaju na 45 %, a u bljesku odu do PUNE svjetline.
      range: [0.45, 1] as [number, number],
      glow: true,
    })),
  ];

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { transform: [{ translateY: parallax }] }]}
      pointerEvents="none"
    >
      {groups.map((g, i) => (
        <Animated.View
          key={i}
          style={[
            StyleSheet.absoluteFill,
            {
              /*
               * Prozirnost skupine množi osnovnu prozirnost zvijezde, pa
               * unutar iste petlje svaka i dalje ima svoju svjetlinu —
               * bez toga bi cijela skupina treperila kao jedno tijelo.
               */
              opacity: g.anim.interpolate({
                inputRange: [0, 1],
                outputRange: g.range,
              }),
            },
          ]}
        >
          <Svg width={width} height={height}>
            {g.glow && (
              <Defs>
                {/*
                  SJAJ oko krupnih zvijezda (dorada 6.8.2026.): mekani
                  krug ~3.5× polumjera. Bljesak time ne mijenja samo
                  točku nego i aureolu oko nje, pa se "zasja" vidi i
                  krajičkom oka — sama točka od 2 px je premala da bi
                  promjena svjetline bila uočljiva.
                */}
                <RadialGradient id={`star-glow-${i}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={STAR} stopOpacity="0.5" />
                  <Stop offset="1" stopColor={STAR} stopOpacity="0" />
                </RadialGradient>
              </Defs>
            )}
            {g.glow &&
              g.stars.map((s, j) => (
                <Circle
                  key={`glow-${j}`}
                  cx={s.x}
                  cy={s.y}
                  r={s.r * 3.5}
                  fill={`url(#star-glow-${i})`}
                />
              ))}
            {g.stars.map((s, j) => (
              <Circle key={j} cx={s.x} cy={s.y} r={s.r} fill={STAR} opacity={s.base} />
            ))}
          </Svg>
        </Animated.View>
      ))}

      {/* MJESEC — izostaje u rijetkoj varijanti (vidi `sparse` gore). */}
      {!sparse && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: moonAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 0.82],
              }),
            },
          ]}
        >
          <Svg width={width} height={height}>
            <Defs>
              {/*
                Halo: mjesec na pravom nebu nije oštar disk nego ima blagi
                sjaj. Bez njega izgleda kao nalijepljeni krug.
              */}
              <RadialGradient id="moon-halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0.45" stopColor={MOON} stopOpacity="0.22" />
                <Stop offset="1" stopColor={MOON} stopOpacity="0" />
              </RadialGradient>
              {/*
                SRP se REŽE MASKOM, ne crta sjenom u boji neba (popravak
                6.8.2026., nađen na uređaju).

                Prije je preko diska išao krug boje `#161D2E`. Kako je
                pomaknut, virio je do ~23 px IZVAN mjeseca — a ondje nema
                mjeseca da ga skrije, nego halo sjaj koji je svjetliji od
                te boje. Taj se višak vidio kao zaseban tamni krug, pa je
                cijelo izgledalo kao pomrčina.

                Maska nema taj problem jer ne dodaje boju: bijelo znači
                "vidi se", crno "ne vidi se". Ono što padne izvan diska
                ne crta ništa.
              */}
              <Mask id="moon-mask">
                <Circle
                  cx={width * (1 - MOON_RIGHT)}
                  cy={height * MOON_TOP}
                  r={MOON_R}
                  fill="#fff"
                />
                <Circle
                  cx={width * (1 - MOON_RIGHT) + MOON_R * shadow}
                  cy={height * MOON_TOP}
                  r={MOON_R}
                  fill="#000"
                />
              </Mask>
            </Defs>

            {/*
              Halo prati SRP, ne puni disk: slabiji je i pomaknut prema
              osvijetljenoj strani. Sjaj oko tamnog dijela mjeseca bi
              odavao da ondje nešto jest, a upravo to je davalo dojam
              pomrčine.
            */}
            <Circle
              cx={width * (1 - MOON_RIGHT) - MOON_R * shadow * 0.35}
              cy={height * MOON_TOP}
              r={MOON_R * 2.2}
              fill="url(#moon-halo)"
            />
            <Circle
              cx={width * (1 - MOON_RIGHT)}
              cy={height * MOON_TOP}
              r={MOON_R}
              fill={MOON}
              opacity={0.95}
              mask="url(#moon-mask)"
            />
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  );
});
StarsLayer.displayName = "StarsLayer";
