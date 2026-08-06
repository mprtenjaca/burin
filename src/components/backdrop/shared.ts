import type { Animated } from "react-native";

/**
 * Zajedničko za ambijentalne slojeve heroja (6.8.2026.). Svaki sloj crta
 * drugu "atmosferu" po vremenu — vidi `backdropEffect` u weatherLook.
 *
 * Pravila za sve slojeve:
 *  - SVG + `Animated` transform/opacity, uvijek `useNativeDriver: true`
 *    (JS driver je štucao nakon reloada — thread je tada zauzet)
 *  - suptilno: pozadina ostaje pozadina, tipografija je glavna
 *  - petlje moraju biti bešavne: pomak ciklusa = period uzorka
 */
export type LayerProps = {
  width: number;
  height: number;
  /** Pomak skrola — sloj se pomiče (paralaksa) dok hero odlazi. */
  scrollY?: Animated.Value;
  /**
   * Jačina oborine (`precipIntensity`) — kiša i snijeg mijenjaju brzinu
   * i gustoću. Slojevi bez oborine je ignoriraju.
   */
  intensity?: "light" | "moderate" | "heavy";
};

/** Množitelj TRAJANJA po jačini: manji broj = brže pada. */
export const SPEED_BY_INTENSITY = {
  light: 1.6,
  moderate: 1,
  heavy: 0.6,
} as const;

/** Nagib kosih elemenata: koliko px udesno "ode" po visini heroja. */
export const SLOPE = 0.55;

/**
 * Determinističan pseudo-slučajan broj 0–1 iz cijelog broja. Raspored
 * čestica mora biti isti u svakom renderu (inače pahulje "skaču" pri
 * svakom re-renderu), pa se ne koristi Math.random.
 */
export function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}
