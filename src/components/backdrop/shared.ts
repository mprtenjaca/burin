import { Platform, type Animated } from "react-native";

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
  /**
   * Gustoća sloja: `"full"` je zadano (oblačno), `"sparse"` je rjeđe i
   * blijeđe — koristi ga djelomično oblačno, gdje oblaci stoje UZ zrake
   * sunca pa ne smiju prekriti nebo (6.8.2026.).
   */
  density?: "full" | "sparse";
};

/**
 * SLABIJI UREĐAJ DOBIVA MANJE ČESTICA (8.8.2026.).
 *
 * Nađeno na uređaju (Galaxy S10e, Android 12): kiša je vidljivo štucala.
 * Uzrok nije animacija — transformi idu nativnim driverom i njih GPU vozi
 * bez muke — nego SAM CRTEŽ: kiša montira 63 `<Line>` elementa, a svaki
 * nosi `strokeDasharray` i okrugle krajeve. `react-native-svg` to
 * rasterizira na CPU-u pri svakom kadru, pa se trošak množi brojem crta.
 *
 * Zato se smanjuje BROJ ELEMENATA, a ne kvaliteta animacije: raspored je
 * i dalje nepravilan, petlja i dalje bešavna, samo je gušće ondje gdje
 * uređaj to može podnijeti.
 *
 * Granica je Androidova RAZINA API-ja, jer je to jedini pokazatelj snage
 * dostupan bez nativnog modula. API 33 (Android 13, kraj 2022.) dijeli
 * uređaje otprilike ondje gdje leži i generacijski skok u snazi GPU-a —
 * S10e je na 31, dakle "lagani". Nije savršeno mjerilo (ima starih
 * flagshipova i novih jeftinih telefona), ali griješi na sigurnu stranu:
 * u najgorem slučaju moćan stariji telefon dobije nešto rjeđu kišu, što
 * se golim okom jedva vidi.
 *
 * iOS ostaje na punom broju — ondje štucanja nije bilo, a najstariji
 * podržani uređaji su i dalje brži od S10e u rasterizaciji.
 */
export const IS_LOW_END: boolean =
  Platform.OS === "android" && typeof Platform.Version === "number" && Platform.Version < 33;

/**
 * Prorjeđivanje niza na zadani udio, ravnomjerno po duljini.
 *
 * Uzima svaki n-ti element umjesto prvih N: raspored čestica po širini
 * ekrana mora ostati ravnomjeran. Da se uzme prvih 30, kiša bi pala samo
 * na lijevu polovicu — točno onaj bug koji je već jednom nađen na maloj
 * pločici widgeta.
 */
export function thin<T>(items: T[], keep: number): T[] {
  if (keep >= items.length) return items;
  const step = items.length / keep;
  const out: T[] = [];
  for (let i = 0; i < keep; i++) {
    const item = items[Math.floor(i * step)];
    if (item !== undefined) out.push(item);
  }
  return out;
}

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
