/**
 * Imena ikona widgeta — u ZASEBNOJ datoteci bez ijednog uvoza.
 *
 * Zašto odvojeno od `widgetIcons.ts`: taj modul radi `require` na PNG-ove
 * i na nativne module, pa ga `widgetData` (čista logika, testira se) ne
 * smije uvući. Ovdje su samo imena, koja trebaju obje strane.
 *
 * Imena se poklapaju s datotekama u `assets/widget/` i s ključevima u
 * `scripts/generate-widget-icons.mjs`.
 */
const OUTLINE_NAMES = [
  "sun",
  "partly",
  "cloud",
  "rain",
  "snow",
  "thunder",
  "fog",
  "night",
  "night-cloudy",
  "wind",
] as const;

/**
 * PUNE inačice, sufiks `-fill` (7.8.2026.).
 *
 * Zaključani zaslon iOS crta u `vibrant` načinu: sve se svede na jedan
 * ton i pretvori u masku, pa se tanke linije stanje do neprimjetnosti, a
 * prazna unutrašnjost obrisa se ne razlikuje od podloge. Zato i Appleov
 * widget ondje koristi pune ikone (`*.fill` u SF Symbolsima).
 */
const FILL_NAMES = OUTLINE_NAMES.map((n) => `${n}-fill` as const);

export const WIDGET_ICON_NAMES = [...OUTLINE_NAMES, ...FILL_NAMES] as const;

export type WidgetIconName = (typeof WIDGET_ICON_NAMES)[number];

/** Obris → puna inačica. Koristi ga zaključani zaslon. */
export function filled(name: string): WidgetIconName {
  return `${name}-fill` as WidgetIconName;
}

/**
 * WMO kod + doba dana → ikona.
 *
 * Prati `paletteKey` u `weatherLook.ts` (isti pragovi, isti redoslijed),
 * ali ima DVIJE noćne varijante gdje paleta ima jednu: vedra noć dobiva
 * mjesec sa zvijezdama, oblačna mjesec za oblakom. Magla ima svoju ikonu
 * jer je vizualno posve drugačija od naoblake, iako dijeli paletu.
 */
/**
 * Ambijentalni sloj widgeta (7.8.2026.) — suptilni uzorak preko
 * gradijenta, parnjak `backdropEffects` iz aplikacije.
 *
 * Ima MANJE vrsta nego aplikacija: widget nema `Path` ni `Canvas`, pa se
 * crta samo ono što se da složiti od pravokutnika i krugova. Grmljavina
 * zato dijeli sloj s kišom (bljeskovi se ne mogu nacrtati, a i ne bi
 * imali smisla bez animacije), a magla s naoblakom.
 */
export type AmbientKind = "none" | "rays" | "rain" | "snow" | "clouds" | "partly" | "stars";

export function ambientForWeather(code: number, isDay: boolean): AmbientKind {
  if (code >= 95 && code <= 99) return "rain";
  if (code >= 71 && code <= 86 && code !== 80 && code !== 81 && code !== 82) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 45 || code === 48) return "clouds";
  // >= 3 (ne === 3) zbog razreda 3.5 "pretezno oblacno" iz DHMZ mjerenja:
  // s jednakoscu je propadao do  i davao SUNCE na oblacnom nebu.
  if (code >= 3 && code < 4) return "clouds";
  /*
   * Djelomično oblačno ima SVOJ sloj (Markov ispravak 7.8.2026.): oblak
   * je izraženiji nego kod pune naoblake, da se razlika vidi. Noću ide na
   * običnu naoblaku — mjesec je već u ikoni.
   */
  if (code === 2) return isDay ? "partly" : "clouds";
  if (code <= 1) return isDay ? "rays" : "stars";
  return "clouds";
}

export function iconForWeather(code: number, isDay: boolean): WidgetIconName {
  if (code >= 95 && code <= 99) return "thunder";
  if (code >= 71 && code <= 86 && code !== 80 && code !== 81 && code !== 82) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 45 || code === 48) return "fog";
  // Isto kao u ambientForWeather: 3.5 mora ostati naoblaka.
  if (code >= 3 && code < 4) return isDay ? "cloud" : "night-cloudy";
  /*
   * Kod 1 (pretežno vedro) dijeli ikonu s 2 od 9.9.2026. — isti razlog
   * kao u `weatherCodes.ts`: Open-Meteo daje 1 i za ~45 % naoblake, a
   * goli „sun" je na pločici lagao da je vedro. `partly` PNG već postoji
   * pa je ovo samo JS; ambijent (`ambientForWeather`) ostaje `rays` jer
   * widget ne može zrake + oblake odjednom, a sunce još vlada.
   */
  if (code === 2 || code === 1) return isDay ? "partly" : "night-cloudy";
  if (code === 0) return isDay ? "sun" : "night";
  return isDay ? "cloud" : "night-cloudy";
}
