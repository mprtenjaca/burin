import { memo } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { CloudsLayer } from "@/components/backdrop/CloudsLayer";
import { FogLayer } from "@/components/backdrop/FogLayer";
import { LightningLayer } from "@/components/backdrop/LightningLayer";
import { RainLayer } from "@/components/backdrop/RainLayer";
import { RaysLayer } from "@/components/backdrop/RaysLayer";
import { SnowLayer } from "@/components/backdrop/SnowLayer";
import { StarsLayer } from "@/components/backdrop/StarsLayer";
import type { LayerProps } from "@/components/backdrop/shared";
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

/**
 * Efekt → komponenta sloja. IZVEZENO (6.8.2026.) jer ga koristi i
 * zaglavlje ladice: dok je `DrawerContent` imao vlastitu kopiju popisa,
 * dodavanje sloja je tražilo izmjenu na dva mjesta — pri dodavanju
 * zvijezda je ta druga kopija ostala bez njih i typecheck je pao.
 * Tip `Record<BackdropEffect, …>` sada jamči da su svi efekti pokriveni.
 */
export const BACKDROP_LAYERS: Record<
  BackdropEffect,
  React.ComponentType<LayerProps>
> = {
  rays: RaysLayer,
  rain: RainLayer,
  snow: SnowLayer,
  clouds: CloudsLayer,
  fog: FogLayer,
  lightning: LightningLayer,
  stars: StarsLayer,
};

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
   * SVA vremena nose boju jednako duboko niz ekran (Markov odabir
   * 6.8.2026., drugi krug). Prije su samo oblačno i magla imali "duboku"
   * varijantu, a topla vremena su gasila boju već na 0.74 — pokraj
   * oblačnog je sunce izgledalo kao da mu gradijent nedostaje pola
   * ekrana. Sada je dubina jedinstvena i grana `deep` više ne postoji.
   */
  /*
   * Produbljeno drugi put (Markov ispravak 6.8.2026.): 0.34/0.62/0.9 je
   * i dalje ostavljalo vidljiv pojas podloge iznad kartica. Sada boja
   * seže gotovo do dna prvog ekrana.
   */
  const MID = "0.4";
  const LOW = "0.7";
  const END = "0.97";

  /*
   * Djelomično oblačno (`rays` + `clouds`) i dalje dobiva RIJEĐE oblake —
   * to je gustoća sloja, ne dubina gradijenta. Ta dva su prije bila
   * spojena u jedan `deep`, pa je gustoća oblaka odlučivala i o duljini
   * boje; sad su razdvojeni.
   */
  const sparseClouds = effects.includes("clouds") && effects.includes("rays");

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
            {/*
              Boja se drži do KRAJA i ne prelazi sama u `pageBg`
              (dorada 6.8.2026.): dok je i ovdje stajao prijelaz u
              podlogu, zbrajao se s fade slojem na istoj visini i davao
              tvrdu liniju. Gašenje u podlogu radi ISKLJUČIVO fade —
              jedan prijelaz, ne dva.
            */}
            <Stop offset="0" stopColor={stops[0]} />
            <Stop offset={MID} stopColor={stops[1]} />
            <Stop offset={LOW} stopColor={stops[2]} />
            <Stop offset="1" stopColor={stops[2]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#hero-bg)" />
      </Svg>

      {effects.map((name) => {
        const Layer = BACKDROP_LAYERS[name];
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
          {/*
            Fade prati dubinu gradijenta — inače bi gasio boju prerano.

            VIŠE MEĐUSTOPOVA (Markov ispravak 6.8.2026.): prije su bila
            samo dva (0 → 0.9 alfe kroz 27 % visine), pa se prijelaz
            vidio kao TVRDA LINIJA na pola ekrana. Dva su razloga bila:
            skok od 0.9 alfe u jednom potezu, i to što je u istoj zoni i
            sam gradijent boje išao prema `pageBg` — dva prijelaza su se
            zbrajala na istoj visini.

            Krivulja je sada nalik ease-in: kreće vrlo sporo (0.08 na
            60 %), pa ubrzava. Oko primjećuje POČETAK promjene, ne njen
            kraj, pa blag početak skriva cijeli prijelaz.
          */}
          <LinearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={pageBg} stopOpacity="0" />
            <Stop offset="0.5" stopColor={pageBg} stopOpacity="0" />
            <Stop offset="0.6" stopColor={pageBg} stopOpacity="0.08" />
            <Stop offset="0.7" stopColor={pageBg} stopOpacity="0.24" />
            <Stop offset="0.79" stopColor={pageBg} stopOpacity="0.48" />
            <Stop offset="0.87" stopColor={pageBg} stopOpacity="0.74" />
            <Stop offset="0.93" stopColor={pageBg} stopOpacity="0.92" />
            <Stop offset={END} stopColor={pageBg} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#hero-fade)" />
      </Svg>
    </View>
  );
});
HeroBackdrop.displayName = "HeroBackdrop";
