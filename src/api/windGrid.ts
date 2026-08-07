import { fetchJson } from "./client";

/**
 * Mreža vjetra iz Open-Metea — vlastiti sloj crtica na karti.
 *
 * Zašto ne OWM: besplatni `wind_new` je POLJE BOJA, ne strelice (izmjereno
 * 5.8.2026.); strelice postoje samo u Maps 2.0 sloju `WND`, koji na
 * besplatnom ključu vraća 401. Open-Meteo daje brzinu I smjer po točki
 * besplatno, a MapLibre symbol sloj crta stotine rotiranih ikona na GPU-u
 * bez troška — što s `react-native-maps` markerima nije bilo izvedivo.
 *
 * Izmjereno 5.8.2026.: 56 točaka u JEDNOM upitu = HTTP 200 za 317 ms.
 * Open-Meteo prima `latitude`/`longitude` kao liste i vraća niz odgovora.
 */

/** Jedna točka mreže sa satnim nizom vjetra. */
export type WindGridPoint = {
  lat: number;
  lon: number;
  /** Lokalni ISO po satu, isti oblik kao `useTimelineHours` ("...T14:00"). */
  times: string[];
  /** km/h po satu. */
  speeds: (number | undefined)[];
  /** Meteorološki smjer u stupnjevima: odakle vjetar PUŠE. */
  directions: (number | undefined)[];
};

type OmPoint = {
  latitude: number;
  longitude: number;
  hourly?: {
    time: string[];
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
  };
};

/**
 * Koliko crtica po strani kadra. 14×11 = 154 točke: gusto da se vidi
 * strujanje, a još uvijek jedan upit i čitljiva karta. Open-Meteo podnosi
 * i više, ali gušće od ovoga se crtice počnu preklapati na malom ekranu.
 */
const COLS = 14;
const ROWS = 11;

/**
 * Najmanji razmak mreže u stupnjevima.
 *
 * Izmjereno 6.8.2026.: Open-Meteo je za točke razmaknute 0.008° vratio
 * IDENTIČNE vrijednosti (44.100/44.108/44.116 → sve 21.4 km/h, sve
 * zaokružene na latitude 44.12) — model je na ~0.1° rezoluciji, pa gušća
 * mreža ne donosi nove podatke, samo troši kvotu i crta stotine
 * istovjetnih strujnica jednu na drugoj. Zato se pri jakom približavanju
 * mreža PROREĐUJE umjesto da se steže s kadrom.
 */
const MIN_GRID_STEP_DEG = 0.05;

/** Rub kadra se izostavlja — crtice na samom rubu izgledaju odsječeno. */
const INSET = 0.08;

export type Bounds = { west: number; south: number; east: number; north: number };

/**
 * Izvezeno radi testova: ravnomjerna mreža unutar granica kadra.
 *
 * Broj točaka pada kad bi razmak sišao ispod rezolucije modela — inače
 * se pri približavanju traže deseci točaka iz ISTE ćelije modela, koje
 * sve vrate isti broj (izmjereno, vidi `MIN_GRID_STEP_DEG`).
 */
export function gridPoints(bounds: Bounds): { lat: number; lon: number }[] {
  const { west, south, east, north } = bounds;
  const w = east - west;
  const h = north - south;

  const usable = 1 - 2 * INSET;
  // Bar 2 po strani: ispod toga nema mreže, a interpolacija treba susjede.
  const cols = Math.max(2, Math.min(COLS, Math.floor((w * usable) / MIN_GRID_STEP_DEG)));
  const rows = Math.max(2, Math.min(ROWS, Math.floor((h * usable) / MIN_GRID_STEP_DEG)));

  const points: { lat: number; lon: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // (i + 0.5) / n centrira točke u svoje ćelije umjesto da ih lijepi na rub.
      const fx = INSET + ((c + 0.5) / cols) * usable;
      const fy = INSET + ((r + 0.5) / rows) * usable;
      points.push({
        lat: Number((south + fy * h).toFixed(3)),
        lon: Number((west + fx * w).toFixed(3)),
      });
    }
  }
  return points;
}

/** Izvezeno radi testova: odgovor Open-Metea → točke mreže. */
export function parseWindGrid(raw: unknown): WindGridPoint[] {
  // Jedna točka se vraća kao objekt, više njih kao niz.
  const list: OmPoint[] = Array.isArray(raw) ? raw : [raw as OmPoint];
  const num = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;

  return list
    .filter((p) => p?.hourly?.time?.length)
    .map((p) => ({
      lat: p.latitude,
      lon: p.longitude,
      times: p.hourly!.time,
      speeds: p.hourly!.time.map((_, i) => num(p.hourly!.wind_speed_10m?.[i])),
      directions: p.hourly!.time.map((_, i) => num(p.hourly!.wind_direction_10m?.[i])),
    }));
}

/**
 * Dohvaća mrežu vjetra za zadani kadar karte. Jedan upit za sve točke.
 */
export async function fetchWindGrid(bounds: Bounds): Promise<WindGridPoint[]> {
  const points = gridPoints(bounds);
  const lats = points.map((p) => p.lat).join(",");
  const lons = points.map((p) => p.lon).join(",");

  const raw = await fetchJson<unknown>(
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&hourly=wind_speed_10m,wind_direction_10m` +
      `&past_days=1&forecast_days=3&timezone=auto`,
  );
  return parseWindGrid(raw);
}

/** Vjetar razložen na komponente u jednoj točki (istok+, sjever+). */
type Vector = { u: number; v: number; speed: number };

/**
 * Vjetar u proizvoljnoj točki — interpolacija iz mreže po obrnutoj
 * udaljenosti (IDW), s najbliža 4 susjeda.
 *
 * Zašto se NE smije interpolirati smjer u stupnjevima: prosjek 350° i 10°
 * daje 180° — točno suprotno od stvarnog (0°). Zato se smjer prvo razloži
 * na u/v komponente, one se prosječe, pa se smjer rekonstruira.
 */
function sampleWind(
  grid: WindGridPoint[],
  hourIndex: Map<WindGridPoint, number>,
  lat: number,
  lon: number,
): Vector | null {
  const near: { d2: number; u: number; v: number; speed: number }[] = [];

  for (const point of grid) {
    const i = hourIndex.get(point);
    if (i === undefined) continue;
    const speed = point.speeds[i];
    const direction = point.directions[i];
    if (speed === undefined || direction === undefined) continue;

    // Smjer strujanja (kamo teče) = meteorološki + 180°, u radijanima.
    const rad = ((direction + 180) % 360) * (Math.PI / 180);
    // 0° = prema sjeveru, raste u smjeru kazaljke na satu.
    const u = Math.sin(rad) * speed;
    const v = Math.cos(rad) * speed;

    const dLat = point.lat - lat;
    // Stupanj dužine je kraći prema polovima — bez ovoga su udaljenosti krive.
    const dLon = (point.lon - lon) * Math.cos(lat * (Math.PI / 180));
    near.push({ d2: dLat * dLat + dLon * dLon, u, v, speed });
  }

  if (near.length === 0) return null;
  near.sort((a, b) => a.d2 - b.d2);

  let wu = 0;
  let wv = 0;
  let ws = 0;
  let wsum = 0;
  for (const p of near.slice(0, 4)) {
    // +1e-9 da točka koja padne točno na čvor mreže ne dijeli s nulom.
    const w = 1 / (p.d2 + 1e-9);
    wu += p.u * w;
    wv += p.v * w;
    ws += p.speed * w;
    wsum += w;
  }

  return { u: wu / wsum, v: wv / wsum, speed: ws / wsum };
}

/**
 * Koliko koraka ima jedna putanja. Kratko: putanja je NOSAČ animiranih
 * crtica, ne sama crta koja se vidi — crtice klize po njoj i dugačka
 * putanja bi ih razvukla preko pola karte.
 */
const STEPS = 6;
/** Duljina jednog koraka u stupnjevima (~2 km) na regionalnom kadru. */
const STEP_DEG = 0.018;

/**
 * Referentna širina kadra za `STEP_DEG` (zoom ≈ 8, regionalni pogled).
 * Strujnica se skalira s kadrom: fiksna duljina je na jakom približavanju
 * prelazila 80 % širine ekrana (izmjereno 6.8.2026. na zoomu 12), pa su
 * se crte razvlačile preko cijele karte i izgledale kao da vjetra nema.
 */
const REFERENCE_SPAN_DEG = 2.14;
/** Granice skaliranja — crta ne smije nestati ni prerasti kadar. */
const MIN_STEP_DEG = 0.0015;
const MAX_STEP_DEG = 0.05;

/**
 * Dodatni početci strujnica unutar svake ćelije mreže (8.8.2026.).
 *
 * Namjerno NESIMETRIČNI: pravilni pomaci (0.5/0.5) bi posložili strujnice
 * u vidljivu rešetku, a polje vjetra mora izgledati kao polje. Množe se
 * duljinom koraka, pa gustoća prati približavanje kao i sve ostalo.
 */
const SEED_OFFSETS: [number, number][] = [
  [0.35, 0.65],
  [-0.6, 0.3],
  [0.55, -0.45],
];

/**
 * Koliko daleko od čvora smiju pasti dodatni početci, u koracima.
 *
 * Prevelik razmak bi ih izbacio u susjednu ćeliju i strujnice bi se
 * udvostručile jedna preko druge; premalen bi ih zbio uz čvor i ne bi se
 * dobilo ništa. 9 koraka je otprilike pola ćelije pri tipičnom kadru.
 */
const SEED_SPREAD = 9;

/** Duljina koraka strujnice za dani kadar; bez kadra ostaje zadana. */
export function stepDegFor(bounds?: Bounds): number {
  if (!bounds) return STEP_DEG;
  const span = Math.abs(bounds.east - bounds.west);
  if (!Number.isFinite(span) || span <= 0) return STEP_DEG;
  const scaled = STEP_DEG * (span / REFERENCE_SPAN_DEG);
  return Math.min(MAX_STEP_DEG, Math.max(MIN_STEP_DEG, scaled));
}

/**
 * GeoJSON za sloj vjetra: **strujnice**, ne pojedinačne crtice.
 *
 * Svaka crta kreće iz jedne točke mreže i korača kroz polje vjetra — u
 * svakom koraku uzme interpolirani smjer NA TRENUTNOJ poziciji i pomakne se
 * dalje. Zato se crta savija tamo gdje se vjetar okreće ("kao zmija"),
 * umjesto da ravne crtice strše jedna prema drugoj.
 *
 * Isti postupak koriste Windy i RainViewer; podaci su naši (Open-Meteo
 * mreža), ne tuđi API.
 */
export function windFeatures(
  grid: WindGridPoint[],
  timeIso: string,
  /** Kadar karte — duljina strujnice se skalira s njim (vidi `stepDegFor`). */
  bounds?: Bounds,
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const stepDeg = stepDegFor(bounds);
  // Indeks sata po točki: traži se jednom, ne u svakom koraku svake crte.
  const hourIndex = new Map<WindGridPoint, number>();
  for (const point of grid) {
    const i = point.times.indexOf(timeIso);
    if (i >= 0) hourIndex.set(point, i);
  }
  if (hourIndex.size === 0) return { type: "FeatureCollection", features: [] };

  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  /*
   * VIŠE STRUJNICA IZ ISTIH PODATAKA (Markov zahtjev 8.8.2026.: „mozda
   * da ih vise ima, pogotovo na zoom-inu").
   *
   * Mreža se NE može zgusnuti — model je na ~0.1°, pa bi gušće točke
   * vratile iste brojeve i samo trošile satnu kvotu (izmjereno 6.8.,
   * vidi `MIN_GRID_STEP_DEG`). Ali strujnice se INTERPOLIRAJU
   * (`sampleWind` računa vjetar na BILO KOJOJ točki), pa se između
   * čvorova mreže smiju posijati dodatne bez ijednog novog upita.
   *
   * Svaki čvor time daje četiri početka umjesto jednog: sam čvor i tri
   * pomaknuta unutar njegove ćelije. Pomaci su nesimetrični (0.35/0.65)
   * da se ne poslažu u pravilnu rešetku — inače bi se vidjeli redovi
   * umjesto polja.
   */
  const seeds: { lat: number; lon: number; from: WindGridPoint }[] = [];
  for (const point of grid) {
    if (!hourIndex.has(point)) continue;
    seeds.push({ lat: point.lat, lon: point.lon, from: point });
    for (const [dLat, dLon] of SEED_OFFSETS) {
      seeds.push({
        lat: point.lat + dLat * stepDeg * SEED_SPREAD,
        lon: point.lon + dLon * stepDeg * SEED_SPREAD,
        from: point,
      });
    }
  }

  for (const start of seeds) {
    const coords: [number, number][] = [];
    let lat = start.lat;
    let lon = start.lon;
    let speedSum = 0;
    let samples = 0;

    for (let s = 0; s < STEPS; s++) {
      const wind = sampleWind(grid, hourIndex, lat, lon);
      // Bez vjetra nema strujnice — tišina se ne crta.
      if (!wind || wind.speed < 0.5) break;

      // 5 decimala (~1 m): na 4 su se kratki koraci jakog zooma zgnječili
      // u istu točku i strujnica bi se izgubila.
      coords.push([Number(lon.toFixed(5)), Number(lat.toFixed(5))]);
      speedSum += wind.speed;
      samples++;

      // Korak je JEDINIČNI po smjeru: duljina crte ne ovisi o brzini, inače
      // bi slab vjetar davao točkice, a jak prelazio pola karte.
      const norm = Math.hypot(wind.u, wind.v) || 1;
      lat += (wind.v / norm) * stepDeg;
      lon += ((wind.u / norm) * stepDeg) / Math.cos(lat * (Math.PI / 180));
    }

    // Dvije točke nisu krivulja.
    if (coords.length < 3) continue;

    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: { speed: speedSum / samples },
    });
  }

  return { type: "FeatureCollection", features };
}
