import { currentLanguage } from "@/i18n";
import { haversineKm } from "@/utils/geo";

/**
 * Meteoalarm (DHMZ) dijeli Hrvatsku na EMMA regije: 8 kopnenih
 * (HR001–HR008) i 6 pomorskih (HR801–HR806). Feed daje samo ime i ID,
 * BEZ granica — pa se mjesto na regiju mapira ručnom tablicom.
 *
 * Sve ID-jeve i imena potvrdio živi feed 6.8.2026.
 * (feeds.meteoalarm.org/api/v1/warnings/feeds-croatia).
 *
 * Granice su namjerno grube (pravokutnik + sidrena točka): rubno mjesto
 * može pasti u susjednu regiju, što je za upozorenja bezopasno — susjedne
 * regije u praksi nose isto ili slično upozorenje, a nikad se ne ostane
 * bez ijedne regije.
 */
export type EmmaId =
  | "HR001" | "HR002" | "HR003" | "HR004"
  | "HR005" | "HR006" | "HR007" | "HR008"
  | "HR801" | "HR802" | "HR803" | "HR804" | "HR805" | "HR806";

type Box = { latMin: number; latMax: number; lonMin: number; lonMax: number };

type EmmaRegion = {
  id: EmmaId;
  /**
   * Ime za prikaz, po jeziku sučelja (6.8.2026.).
   *
   * Feed nosi ENGLESKA imena u OBA jezična bloka — izmjereno na živom
   * feedu: i `hr-HR` i `en-GB` daju "Knin region". Zato hrvatska imena
   * postoje samo ovdje, a engleska su preuzeta doslovno iz feeda, da se
   * ime regije na ekranu poklapa s tekstom upozorenja iznad njega.
   */
  name: Record<"hr" | "en", string>;
  kind: "land" | "marine";
  box: Box;
  /**
   * Sidrena točka regije — za kopno grad po kojem se regija zove.
   * Kad mjesto padne u više kutija (ili ni u jednu), odlučuje
   * najbliže sidro.
   */
  anchor: { lat: number; lon: number };
};

export const EMMA_REGIONS: EmmaRegion[] = [
  // ---- kopno (DHMZ prognostičke regije) ----
  {
    id: "HR001",
    name: { hr: "kninska regija", en: "Knin region" },
    kind: "land",
    // Sjeverna Dalmacija s zaleđem: Zadar, Ravni kotari, Šibenik, Knin.
    box: { latMin: 43.5, latMax: 44.6, lonMin: 15.0, lonMax: 17.0 },
    anchor: { lat: 44.04, lon: 16.2 },
  },
  {
    id: "HR002",
    name: { hr: "zagrebačka regija", en: "Zagreb region" },
    kind: "land",
    box: { latMin: 45.2, latMax: 46.7, lonMin: 15.7, lonMax: 17.6 },
    anchor: { lat: 45.81, lon: 15.98 },
  },
  {
    id: "HR003",
    name: { hr: "karlovačka regija", en: "Karlovac region" },
    kind: "land",
    box: { latMin: 44.9, latMax: 45.75, lonMin: 14.7, lonMax: 16.1 },
    anchor: { lat: 45.49, lon: 15.55 },
  },
  {
    id: "HR004",
    name: { hr: "gospićka regija", en: "Gospic region" },
    kind: "land",
    box: { latMin: 44.15, latMax: 45.05, lonMin: 14.9, lonMax: 16.35 },
    anchor: { lat: 44.55, lon: 15.37 },
  },
  {
    id: "HR005",
    name: { hr: "osječka regija", en: "Osijek region" },
    kind: "land",
    box: { latMin: 44.7, latMax: 46.0, lonMin: 16.9, lonMax: 19.5 },
    anchor: { lat: 45.55, lon: 18.69 },
  },
  {
    id: "HR006",
    name: { hr: "riječka regija", en: "Rijeka region" },
    kind: "land",
    // Istra + Primorje + kvarnerski otoci.
    box: { latMin: 44.35, latMax: 45.65, lonMin: 13.4, lonMax: 15.1 },
    anchor: { lat: 45.33, lon: 14.44 },
  },
  {
    id: "HR007",
    name: { hr: "dubrovačka regija", en: "Dubrovnik region" },
    kind: "land",
    box: { latMin: 42.35, latMax: 43.15, lonMin: 16.8, lonMax: 18.6 },
    anchor: { lat: 42.65, lon: 18.09 },
  },
  {
    id: "HR008",
    name: { hr: "splitska regija", en: "Split region" },
    kind: "land",
    box: { latMin: 42.85, latMax: 44.05, lonMin: 15.85, lonMax: 17.55 },
    anchor: { lat: 43.51, lon: 16.44 },
  },

  // ---- more (obalni pojas s otocima; vrijedi UZ kopnenu regiju) ----
  {
    id: "HR801",
    name: { hr: "zapadna obala Istre", en: "West Istrian coast" },
    kind: "marine",
    box: { latMin: 44.75, latMax: 45.6, lonMin: 13.2, lonMax: 13.95 },
    anchor: { lat: 45.1, lon: 13.6 },
  },
  {
    id: "HR802",
    name: { hr: "Kvarner i Kvarnerić", en: "Kvarner and Kvarneric" },
    kind: "marine",
    box: { latMin: 44.45, latMax: 45.45, lonMin: 13.95, lonMax: 15.0 },
    anchor: { lat: 44.9, lon: 14.5 },
  },
  {
    id: "HR803",
    name: { hr: "Velebitski kanal", en: "Velebit channel" },
    kind: "marine",
    // Od Senja do Maslenice, uski pojas pod Velebitom.
    box: { latMin: 44.15, latMax: 45.05, lonMin: 14.8, lonMax: 15.6 },
    anchor: { lat: 44.6, lon: 15.2 },
  },
  {
    id: "HR804",
    name: { hr: "sjeverna Dalmacija", en: "North Dalmatia" },
    kind: "marine",
    box: { latMin: 43.55, latMax: 44.45, lonMin: 14.75, lonMax: 16.1 },
    anchor: { lat: 44.0, lon: 15.3 },
  },
  {
    id: "HR805",
    name: { hr: "srednja Dalmacija", en: "Middle Dalmatia" },
    kind: "marine",
    // lat gornja granica ispod Sinja (43.70) — zagora nije more.
    box: { latMin: 42.9, latMax: 43.6, lonMin: 15.85, lonMax: 17.3 },
    anchor: { lat: 43.4, lon: 16.4 },
  },
  {
    id: "HR806",
    name: { hr: "južna Dalmacija", en: "South Dalmatia" },
    kind: "marine",
    box: { latMin: 42.3, latMax: 43.05, lonMin: 16.7, lonMax: 18.6 },
    anchor: { lat: 42.7, lon: 17.8 },
  },
];

const inBox = (b: Box, lat: number, lon: number) =>
  lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax;

/**
 * Najveća udaljenost od sidra regije na kojoj se ono još dodjeljuje.
 *
 * Zašto uopće: feed je HRVATSKI, pa mjesto izvan Hrvatske NE SMIJE dobiti
 * hrvatsko upozorenje (nađeno na uređaju 6.8.2026.: grad u Čileu je
 * prikazivao crveni meteoalarm za vrućinu, jer je "najbliže sidro" uvijek
 * nešto vraćalo). 130 km pušta mjesta koja vire iz svoje kutije
 * (Međimurje, krajnji jug) i granična područja susjeda gdje isto vrijeme
 * stvarno vlada, a odbija sve ostalo.
 */
const MAX_ANCHOR_DISTANCE_KM = 130;

/**
 * Regije čija upozorenja vrijede za mjesto: najviše JEDNA kopnena (kutija
 * pa najbliže sidro) + sve pomorske u čijem pojasu mjesto leži (obalnim
 * mjestima vjetar na moru nešto znači, kopnenima se pojas ne dodjeljuje
 * jer u njega ne padaju).
 *
 * Za mjesto izvan Hrvatske i njezinog rubnog pojasa vraća **prazan niz** —
 * upozorenja tada nema, što je točno: DHMZ ne pokriva tuđe zemlje.
 */
export function regionsForPlace(lat: number, lon: number): EmmaId[] {
  const here = { lat, lon };
  const land = EMMA_REGIONS.filter((r) => r.kind === "land");
  const candidates = land.filter((r) => inBox(r.box, lat, lon));
  const pool = candidates.length > 0 ? candidates : land;
  const nearest = pool.reduce((best, r) =>
    haversineKm(here, r.anchor) < haversineKm(here, best.anchor) ? r : best,
  );

  // Predaleko od svake regije = izvan dosega DHMZ-a; nema upozorenja.
  if (haversineKm(here, nearest.anchor) > MAX_ANCHOR_DISTANCE_KM) return [];

  const marine = EMMA_REGIONS.filter(
    (r) => r.kind === "marine" && inBox(r.box, lat, lon),
  );
  return [nearest.id, ...marine.map((r) => r.id)];
}

/**
 * Ime regije za prikaz na ekranu upozorenja, na jeziku sučelja.
 *
 * Jezik se čita iz `currentLanguage()`, a ne prima propom: pozivatelj je
 * jedan redak u JSX-u usred liste, a modul je i inače čista tablica —
 * hook bi ga vezao uz React stablo bez potrebe.
 */
export function emmaRegionName(id: string): string | undefined {
  return EMMA_REGIONS.find((r) => r.id === id)?.name[currentLanguage()];
}
