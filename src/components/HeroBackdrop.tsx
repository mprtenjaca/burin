import { memo } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { CloudsLayer } from "@/components/backdrop/CloudsLayer";
import { FogLayer } from "@/components/backdrop/FogLayer";
import { LightningLayer } from "@/components/backdrop/LightningLayer";
import { RainLayer } from "@/components/backdrop/RainLayer";
import { RaysLayer } from "@/components/backdrop/RaysLayer";
import { SnowLayer } from "@/components/backdrop/SnowLayer";
import type { BackdropEffect, GradientStops } from "@/utils/weatherLook";

/**
 * Pozadina heroja: DIJAGONALNI gradijent po vremenu + ambijentalni sloj
 * koji ovisi o vremenu, sve u react-native-svg — bez novih nativnih
 * modula i bez rebuilda.
 *
 * Slojevi, odozdo prema gore:
 *   1. gradijent boje vremena, dijagonalan (gore-lijevo → dolje-desno,
 *      po Markovom promptu 6.8.2026.), stapa se u boju podloge
 *   2. AMBIJENT po vremenu (`backdropEffect`): sunčane zrake koje tinjaju
 *      i svjetlucaju, kiša koja klizi, pahulje koje padaju, ili tihe niti
 *      magle. Svaki sloj je zaseban modul u `components/backdrop/`.
 *   3. "fade" gradijent proziran → boja podloge (okomit, da rub prema
 *      karticama ostane ravan), koji ambijent i boju izblijedi prema dolje
 */

const LAYERS = {
  rays: RaysLayer,
  rain: RainLayer,
  snow: SnowLayer,
  clouds: CloudsLayer,
  fog: FogLayer,
  lightning: LightningLayer,
} as const;

export const HeroBackdrop = memo(function HeroBackdrop({
  stops,
  pageBg,
  width,
  height,
  effects = ["rays"],
  intensity = "moderate",
  scrollY,
}: {
  stops: GradientStops;
  /** Boja podloge stranice u koju se gradijent stapa (mist/night). */
  pageBg: string;
  width: number;
  height: number;
  /**
   * Ambijentalni slojevi — iz `backdropEffects(code, isDay)`. Više njih
   * daje kombinacije: susnježica = kiša + snijeg, grmljavina = kiša +
   * bljeskovi. Crtaju se redom, prvi je najniži.
   */
  effects?: BackdropEffect[];
  /** Jačina oborine — kiša i snijeg mijenjaju brzinu (`precipIntensity`). */
  intensity?: "light" | "moderate" | "heavy";
  /**
   * Pomak skrola početne — ambijent se pomiče (paralaksa) dok hero
   * izlazi iz kadra. Bez njega su slojevi statični (npr. u pregledima).
   */
  scrollY?: Animated.Value;
}) {
  /*
   * Oblačno i magla nose boju DUBLJE niz ekran (Markov odabir 6.8.2026.):
   * njihove su palete sive i plave, pa im rani prijelaz u podlogu izgleda
   * kao da boje gotovo i nema. Topla vremena ostaju kraća — ondje
   * gradijent mora prepustiti mjesto karticama.
   */
  /*
   * DJELOMIČNO OBLAČNO NE RAČUNA SE KAO "duboko" (6.8.2026.): ono od
   * 6.8.2026. nosi i `clouds` uz `rays`, ali paleta mu je topla i kratka
   * kao suncu. Bez ove iznimke bi mu se gradijent produbio i promijenio
   * izgled ekrana koji je već odobren. Duboko je samo PRAVO oblačno —
   * dakle oblaci BEZ sunčanih zraka.
   */
  const sparseClouds = effects.includes("clouds") && effects.includes("rays");
  const deep = (effects.includes("clouds") && !sparseClouds) || effects.includes("fog");
  const mid = deep ? "0.34" : "0.24";
  const low = deep ? "0.62" : "0.46";
  const end = deep ? "0.9" : "0.74";

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {/*
            Dijagonala (x2 0.6, y2 1): topli tok ide iz gornjeg lijevog
            kuta prema dolje-desno. Donji rub svejedno završava u pageBg
            — to jamči okomiti fade sloj iznad, pa prijelaz na kartice
            ostaje ravan.
          */}
          <LinearGradient id="hero-bg" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={stops[0]} />
            <Stop offset={mid} stopColor={stops[1]} />
            <Stop offset={low} stopColor={stops[2]} />
            <Stop offset={end} stopColor={pageBg} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#hero-bg)" />
      </Svg>

      {effects.map((name) => {
        const Layer = LAYERS[name];
        return (
          <Layer
            key={name}
            width={width}
            height={height}
            scrollY={scrollY}
            intensity={intensity}
            /* Oblaci uz zrake su rijetki i blijedi — vidi CloudsLayer. */
            density={name === "clouds" && sparseClouds ? "sparse" : "full"}
          />
        );
      })}

      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Fade prati dubinu gradijenta — inače bi gasio boju prerano. */}
          <LinearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={pageBg} stopOpacity="0" />
            <Stop offset={deep ? "0.5" : "0.35"} stopColor={pageBg} stopOpacity="0" />
            <Stop offset={deep ? "0.78" : "0.62"} stopColor={pageBg} stopOpacity="0.9" />
            <Stop offset={end} stopColor={pageBg} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#hero-fade)" />
      </Svg>
    </View>
  );
});
HeroBackdrop.displayName = "HeroBackdrop";
