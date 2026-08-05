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
 * Koliko crtica po strani kadra. 9×7 = 63 točke: gusto da se vidi strujanje,
 * a još uvijek jedan upit i čitljiva karta. Open-Meteo podnosi i više, ali
 * gušće od ovoga se crtice počnu preklapati na malom ekranu.
 */
const COLS = 14;
const ROWS = 11;

/** Rub kadra se izostavlja — crtice na samom rubu izgledaju odsječeno. */
const INSET = 0.08;

export type Bounds = { west: number; south: number; east: number; north: number };

/** Izvezeno radi testova: ravnomjerna mreža unutar granica kadra. */
export function gridPoints(bounds: Bounds): { lat: number; lon: number }[] {
  const { west, south, east, north } = bounds;
  const w = east - west;
  const h = north - south;
  const points: { lat: number; lon: number }[] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // (i + 0.5) / n centrira točke u svoje ćelije umjesto da ih lijepi na rub.
      const fx = INSET + ((c + 0.5) / COLS) * (1 - 2 * INSET);
      const fy = INSET + ((r + 0.5) / ROWS) * (1 - 2 * INSET);
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
/** Duljina jednog koraka u stupnjevima (~2 km). */
const STEP_DEG = 0.018;

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
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  // Indeks sata po točki: traži se jednom, ne u svakom koraku svake crte.
  const hourIndex = new Map<WindGridPoint, number>();
  for (const point of grid) {
    const i = point.times.indexOf(timeIso);
    if (i >= 0) hourIndex.set(point, i);
  }
  if (hourIndex.size === 0) return { type: "FeatureCollection", features: [] };

  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  for (const start of grid) {
    if (!hourIndex.has(start)) continue;

    const coords: [number, number][] = [];
    let lat = start.lat;
    let lon = start.lon;
    let speedSum = 0;
    let samples = 0;

    for (let s = 0; s < STEPS; s++) {
      const wind = sampleWind(grid, hourIndex, lat, lon);
      // Bez vjetra nema strujnice — tišina se ne crta.
      if (!wind || wind.speed < 0.5) break;

      coords.push([Number(lon.toFixed(4)), Number(lat.toFixed(4))]);
      speedSum += wind.speed;
      samples++;

      // Korak je JEDINIČNI po smjeru: duljina crte ne ovisi o brzini, inače
      // bi slab vjetar davao točkice, a jak prelazio pola karte.
      const norm = Math.hypot(wind.u, wind.v) || 1;
      lat += (wind.v / norm) * STEP_DEG;
      lon += ((wind.u / norm) * STEP_DEG) / Math.cos(lat * (Math.PI / 180));
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
