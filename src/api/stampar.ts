import type { PollenGrade, PollenGraded, PollenSpecies } from "@/utils/weatherLook";
import { haversineKm } from "@/utils/geo";

import { fetchText } from "./client";
import type { PollenDay } from "./openMeteo";

/**
 * PELUD S PELUDOMJERA — NZJZ „Dr. Andrija Štampar" (6.9.2026.).
 *
 * RAZVOJNI IZVOR. Koristi se SAMO u razvojnoj gradnji (`__DEV__` u
 * `useWeatherBundle`) i ne smije se pojaviti u objavljenoj aplikaciji —
 * Markova odluka nakon pravne provjere 6.9.2026.: čitanje javne stranice za
 * vlastito testiranje je jedno, a dijeljenje tuđih podataka korisnicima u
 * produkciji drugo. Štamparovi uvjeti korištenja NE zabranjuju ponovnu
 * uporabu podataka (pozivaju se na Pravilnik o ponovnoj uporabi
 * informacija javnog sektora), ali traže da se za nju zatraži dozvola. Dok
 * je nema, ovo ostaje alat za usporedbu CAMS-a s mjerenjem, ne izvor za
 * korisnike.
 *
 * ZAŠTO ŠTAMPAR, A NE PLIVA: Pliva izričito zabranjuje distribuciju bez
 * pismenog odobrenja. A ni ne treba — Pliva PRESLIKAVA Štamparove podatke:
 * brojke su iste do decimale (Zadar 6.6 / 3.9 / 0.8 na oba mjesta, isti
 * dan), a Štampar ima ISTIH 25 gradova u izborniku. Štampar je izvor.
 *
 * ŠTO STRANICA DAJE: za odabrani grad, po vrsti, tri dana — prvi je
 * MJERENJE (s brojkom na njihovoj skali 0–12+), sljedeća dva su PROGNOZA
 * (samo razred). Skala je njihova, ne grains/m³:
 *   niska 0–1.9 · umjerena 2–5.9 · visoka 6–11.9 · vrlo visoka ≥ 12
 * Zato razred ide u aplikaciju GOTOV (`PollenGraded`) i ne provlači se kroz
 * pragove kalibrirane za CAMS.
 *
 * KAKO SE ČITA: obična GET stranica s parametrom `title=<id grada>` —
 * Drupal exposed filter, `method="get"`. Nema API-ja, pa se parsira HTML.
 * Parser je čista funkcija nad tekstom, izvezena i testirana na spremljenom
 * isječku prave stranice (`__fixtures__/stampar-zagreb.html`). Kad Štampar
 * promijeni stranicu, taj test pukne prvi — što i želimo.
 *
 * KOLIKO ČESTO: Štampar objavljuje JEDNOM DNEVNO (mjerenje jučerašnjeg
 * dana + prognoza). Upit se zato kešira 6 sati po GRADU (ne po mjestu),
 * ne osvježava se na fokus i ima jedan pokušaj ponovno uz dug razmak —
 * vidi `useWeatherBundle`. Jedan developer × jedan grad × 4 puta na dan je
 * opterećenje koje se ne primjećuje; ništa agresivnije ne dolazi u obzir
 * (Markov zahtjev 6.9.2026.).
 */

const STAMPAR_URL = "https://stampar.hr/hr/peludna-prognoza";

/**
 * Identifikacija u zahtjevu — pristojnost prema tuđem poslužitelju: ako ih
 * ikad zasmeta, znaju tko je i kome pisati.
 */
const USER_AGENT = "Burin/1.0 (razvojna gradnja; usporedba CAMS-a s mjerenjem)";

/** Grad iz Štamparovog izbornika, s koordinatama za pronalazak najbližeg. */
export type StamparCity = { id: number; name: string; lat: number; lon: number };

/**
 * Svih 25 gradova iz `<select name="title">` na stranici, s NJIHOVIM
 * ID-evima — koji NISU abecedni (Dubrovnik 4, Đakovo 5), pa se ne smiju
 * računati nego prepisati. Koordinate su središta gradova.
 */
export const STAMPAR_CITIES: readonly StamparCity[] = [
  { id: 2, name: "Beli Manastir", lat: 45.77, lon: 18.605 },
  { id: 3, name: "Bjelovar", lat: 45.8986, lon: 16.8489 },
  { id: 4, name: "Dubrovnik", lat: 42.6507, lon: 18.0944 },
  { id: 5, name: "Đakovo", lat: 45.3081, lon: 18.41 },
  { id: 6, name: "Karlovac", lat: 45.4929, lon: 15.5553 },
  { id: 7, name: "Koprivnica", lat: 46.1628, lon: 16.8275 },
  { id: 8, name: "Kutina", lat: 45.4761, lon: 16.775 },
  { id: 9, name: "Labin", lat: 45.095, lon: 14.12 },
  { id: 10, name: "Metković", lat: 43.0542, lon: 17.6483 },
  { id: 11, name: "Našice", lat: 45.4936, lon: 18.095 },
  { id: 12, name: "Osijek", lat: 45.555, lon: 18.6955 },
  { id: 13, name: "Pazin", lat: 45.24, lon: 13.9367 },
  { id: 14, name: "Popovača", lat: 45.57, lon: 16.625 },
  { id: 15, name: "Poreč", lat: 45.2275, lon: 13.5947 },
  { id: 16, name: "Pula", lat: 44.8666, lon: 13.8496 },
  { id: 17, name: "Rijeka", lat: 45.3271, lon: 14.4422 },
  { id: 18, name: "Šibenik", lat: 43.735, lon: 15.8952 },
  { id: 19, name: "Sisak", lat: 45.4858, lon: 16.3739 },
  { id: 20, name: "Slavonski Brod", lat: 45.1603, lon: 18.0156 },
  { id: 21, name: "Split", lat: 43.5081, lon: 16.4402 },
  { id: 22, name: "Sveta Nedelja", lat: 45.7947, lon: 15.7822 },
  { id: 23, name: "Varaždin", lat: 46.3044, lon: 16.3378 },
  { id: 24, name: "Virovitica", lat: 45.8319, lon: 17.3839 },
  { id: 25, name: "Zadar", lat: 44.1194, lon: 15.2314 },
  { id: 26, name: "Zagreb", lat: 45.815, lon: 15.9819 },
];

/**
 * Dokle vrijedi mjerenje iz grada — 40 km.
 *
 * Nije 25 kao `DOMINANT_STATION_KM` za temperaturu, i to namjerno: Štampar
 * ima JEDAN peludomjer po županiji (25 postaja za cijelu Hrvatsku), pa je
 * mreža građena da svaka postaja pokrije SVOJU županiju, ne 25 km. Polača
 * je od centra Zadra 24.8 km — s dometom 25 bi Markov kraj ispadao i
 * upadao po GPS šumu, a zadarski peludomjer je jedini u Zadarskoj
 * županiji i mjerodavan je za nju cijelu.
 *
 * 40 km i dalje ne prelijeva preko Velebita ni preko granice (Beč,
 * Ljubljana ostaju na CAMS-u) — vidi testove.
 */
export const STAMPAR_MAX_KM = 40;

/** Najbliži pokriveni grad, ili `undefined` ako je sve dalje od dometa. */
export function nearestStamparCity(lat: number, lon: number): StamparCity | undefined {
  let best: StamparCity | undefined;
  let bestKm = STAMPAR_MAX_KM;
  for (const city of STAMPAR_CITIES) {
    const km = haversineKm({ lat, lon }, city);
    if (km <= bestKm) {
      best = city;
      bestKm = km;
    }
  }
  return best;
}

/**
 * Hrvatsko ime vrste kako ga Štampar piše → naš ključ. Uspoređuje se riječ
 * PRIJE zagrade, malim slovima ("Ambrozija (Ambrosia sp.)" → "ambrozija").
 * Breza/joha/maslina se sad ne pojavljuju (nije sezona), ali stoje da na
 * proljeće ne ispadnu kao nepoznate.
 */
const SPECIES_BY_NAME: Record<string, PollenSpecies> = {
  ambrozija: "ragweed",
  trave: "grass",
  pelin: "mugwort",
  breza: "birch",
  joha: "alder",
  maslina: "olive",
  koprive: "nettle",
  kopriva: "nettle",
  trputac: "plantain",
  crkvina: "pellitory",
  loboda: "goosefoot",
};

/**
 * Razred iz TEKSTA ("visoka") — primarno, jer je to što korisnik na
 * njihovoj stranici čita. Klasa (`allergy_indicator_level_high`) je
 * rezerva ako tekst izostane.
 */
const GRADE_BY_TEXT: Record<string, PollenGrade> = {
  "nema peludi": 0,
  nema: 0,
  niska: 1,
  umjerena: 2,
  visoka: 3,
  "vrlo visoka": 4,
};

const GRADE_BY_CLASS: Record<string, PollenGrade> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  very_high: 4,
  veryhigh: 4,
};

/**
 * Granice ŠTAMPAROVE skale, za položaj markera unutar polja razreda.
 * Gornja granica "vrlo visoke" je otvorena; puni se do dvostruke donje.
 */
const STAMPAR_BANDS: [number, number][] = [
  [0, 2],
  [2, 6],
  [6, 12],
  [12, 24],
];

/**
 * Položaj markera 0–1 za razred + (neobavezno) brojku na njihovoj skali.
 * Bez brojke (prognozni dani daju samo razred) marker stoji u SREDINI
 * polja — pošteno: ne znamo je li dan na dnu ili vrhu razreda.
 */
export function stamparFraction(grade: PollenGrade, value?: number): number {
  if (grade === 0) return 0;
  const band = 0.25;
  const start = (grade - 1) * band;
  if (value === undefined) return start + band / 2;
  const [from, to] = STAMPAR_BANDS[grade - 1]!;
  const within = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return start + within * band;
}

/** "06.09.2026." → "2026-09-06"; `undefined` ako oblik ne odgovara. */
function isoDate(hr: string): string | undefined {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(hr.trim());
  if (!m) return undefined;
  const [, d, mo, y] = m;
  return `${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
}

export type StamparParsed = {
  /** Dani po datumu, uzlazno; prvi je mjerenje, ostali prognoza. */
  days: PollenDay[];
  /** Imena vrsta koje stranica navodi, a mi ih ne poznajemo — za upozorenje. */
  unknownSpecies: string[];
};

/**
 * Čisti parser HTML-a stranice → dani s gotovim razredima.
 *
 * Nikad ne baca: na bilo kakav neočekivan ulaz vraća prazne dane, a
 * pozivatelj tada pada na CAMS. Robusnost je važnija od potpunosti — ovo je
 * tuđa stranica i mijenja se bez najave.
 *
 * Struktura na koju se oslanja (stanje 6.9.2026.):
 *   <div class="paragraph--type--biljka-grupa">        ← jedna vrsta
 *     <h2><span>Ambrozija (Ambrosia sp.)</span></h2>
 *     <div class="paragraph--type--mjerenje">           ← jedan dan
 *       field-field-datum-mjerenja → 06.09.2026.
 *       allergy_indicator_level_high
 *       field-field-vrijednost-tekst → visoka
 *       field-field-vrijednost → 8.0                    ← samo mjereni dan
 */
export function parseStamparHtml(html: string): StamparParsed {
  const unknownSpecies: string[] = [];
  const byDate = new Map<string, { graded: PollenGraded; levels: Record<string, number> }>();

  const speciesBlocks = html.split("paragraph--type--biljka-grupa").slice(1);
  for (const block of speciesBlocks) {
    const nameMatch = /<h2>\s*<span>([^<]+)<\/span>/.exec(block);
    if (!nameMatch) continue;
    const fullName = nameMatch[1]!.trim();
    const shortName = fullName.split("(")[0]!.trim().toLowerCase();
    const key = SPECIES_BY_NAME[shortName];
    if (!key) {
      if (!unknownSpecies.includes(fullName)) unknownSpecies.push(fullName);
      continue;
    }

    const dayBlocks = block.split("paragraph--type--mjerenje").slice(1);
    for (const day of dayBlocks) {
      const dateM = /field-field-datum-mjerenja[\s\S]*?<div class="field-item">\s*([^<]+?)\s*<\/div>/.exec(day);
      const date = dateM ? isoDate(dateM[1]!) : undefined;
      if (!date) continue;

      const textM = /field-field-vrijednost-tekst[\s\S]*?<div class="field-item">\s*([^<]+?)\s*<\/div>/.exec(day);
      const classM = /allergy_indicator_level_([a-z_]+)/.exec(day);
      const text = textM?.[1]?.trim().toLowerCase();
      const grade: PollenGrade | undefined =
        (text !== undefined ? GRADE_BY_TEXT[text] : undefined) ??
        (classM ? GRADE_BY_CLASS[classM[1]!] : undefined);
      if (grade === undefined) continue;

      // `field-field-vrijednost ` (s razmakom) — NE `-tekst`; brojka postoji
      // samo na mjerenom danu.
      const valueM = /field-field-vrijednost field-type[\s\S]*?<div class="field-item">\s*([\d.,]+)\s*<\/div>/.exec(day);
      const value = valueM ? Number.parseFloat(valueM[1]!.replace(",", ".")) : undefined;
      const numeric = value !== undefined && Number.isFinite(value) ? value : undefined;

      let entry = byDate.get(date);
      if (!entry) {
        entry = { graded: {}, levels: {} };
        byDate.set(date, entry);
      }
      entry.graded[key] = { grade, fraction: stamparFraction(grade, numeric) };
      if (numeric !== undefined) entry.levels[key] = numeric;
    }
  }

  const days: PollenDay[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, e]) => ({
      date,
      // `levels` nosi NJIHOVU brojku (skala 0–12+), samo za prikaz — razred
      // se NE računa iz nje (pragovi su za CAMS), nego dolazi iz `graded`.
      levels: e.levels,
      graded: e.graded,
      source: "stampar" as const,
    }));

  return { days, unknownSpecies };
}

/**
 * Dohvat za jedan grad. Vraća prazne dane (nikad ne baca do pozivatelja u
 * react-queryju osim mrežne greške), pa `useWeatherBundle` tada zadrži
 * CAMS. Nepoznate vrste se logiraju da se vide u razvoju — to je jedini
 * način da saznamo da je Štampar dodao vrstu.
 */
export async function fetchStamparPollen(cityId: number): Promise<PollenDay[]> {
  const html = await fetchText(`${STAMPAR_URL}?title=${cityId}`, {
    // Stranica je ~110 kB HTML-a; zadani rok od 10 s zna biti kratak na mobilnoj mreži.
    timeoutMs: 20_000,
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  });
  const { days, unknownSpecies } = parseStamparHtml(html);
  if (unknownSpecies.length > 0) {
    console.warn(`[burin] Štampar navodi vrste koje ne poznajemo: ${unknownSpecies.join(", ")}`);
  }
  return days;
}
