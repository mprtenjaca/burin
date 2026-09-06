import type { PollenLevels } from "@/utils/weatherLook";

import { fetchJson } from "./client";
import type { CurrentWeather, DailyPoint, HourlyPoint, Place } from "./types";
import { placeId } from "./types";

const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const AIR_QUALITY_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";
const MARINE_BASE = "https://marine-api.open-meteo.com/v1/marine";

/**
 * Glavni model: **ECMWF IFS**. Izmjereno na 12 mjesta različitog reljefa
 * protiv arhive stvarnih jutarnjih minimuma (12.–30.7.2026.): ECMWF
 * promašuje 0.97 °C, GFS 1.09, UKMO 1.18, a `best_match` (zadani miks)
 * 1.83 °C. ECMWF je bio najbolji na 8 od 12 mjesta.
 *
 * Razlika je najveća upravo tamo gdje je aplikacija griješila: Starigrad
 * 0.5 °C vs 2.8 °C, Split 0.4 vs 2.7. `best_match` tamo bira ICON, koji
 * kraškom zaleđu i podvelebitskom kraju ne dopušta noćno hlađenje.
 *
 * ECMWF ne daje UV indeks ni vidljivost i pokriva 14 dana, pa se ta polja
 * i zadnji dani dopunjuju iz `best_match` poziva (vidi `fetchForecast`).
 *
 * IZVEZENO namjerno: `learnModelBias` mora učiti pristranost iz **istog**
 * modela koji se prikazuje. Dok je to bila zasebna (izostavljena) vrijednost,
 * bias se učio iz `best_match`-a i oduzimao od ECMWF-a — izmjereno 5.8.2026.
 * kao odmak od 2.66 °C prema V&R-u umjesto 2.40 °C, s pogrešnim predznakom u
 * Lici i Istri (Otočac je jutrom grijan 1.6 °C umjesto hlađen).
 */
export const PRIMARY_MODEL = "ecmwf_ifs025";

const CURRENT_PARAMS =
  "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,pressure_msl,cloud_cover,precipitation";
const HOURLY_PARAMS =
  "temperature_2m,apparent_temperature,weather_code,is_day,precipitation,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m,pressure_msl,cloud_cover,uv_index,visibility";
const DAILY_PARAMS =
  "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,uv_index_max,wind_speed_10m_max";

// ---- sirovi (raw) tipovi odgovora ----

export type OmRawCurrent = {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  weather_code: number;
  is_day: number;
  wind_speed_10m: number;
  wind_gusts_10m: number;
  wind_direction_10m: number;
  relative_humidity_2m: number;
  pressure_msl: number;
  cloud_cover: number;
  precipitation: number;
};

export type OmRawHourly = {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  weather_code: number[];
  is_day: number[];
  precipitation: number[];
  precipitation_probability: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  relative_humidity_2m: number[];
  pressure_msl: number[];
  cloud_cover: number[];
  uv_index: number[];
  visibility: number[];
};

export type OmRawDaily = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  sunrise: string[];
  sunset: string[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  uv_index_max: number[];
  wind_speed_10m_max: number[];
};

type OmCurrentResponse = { current: OmRawCurrent };

type OmGeoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
};
type OmGeoResponse = { results?: OmGeoResult[] };

type OmPollenHourly = {
  time?: string[];
  alder_pollen?: (number | null)[];
  birch_pollen?: (number | null)[];
  grass_pollen?: (number | null)[];
  mugwort_pollen?: (number | null)[];
  olive_pollen?: (number | null)[];
  ragweed_pollen?: (number | null)[];
};

type OmAirQualityResponse = {
  current?: { european_aqi?: number };
  hourly?: OmPollenHourly;
};

type OmMarineResponse = {
  current?: { sea_surface_temperature?: number | null };
};

// ---- mapperi (izvezeni radi testova) ----

export function mapCurrent(raw: OmRawCurrent): CurrentWeather {
  return {
    temp: raw.temperature_2m,
    feelsLike: raw.apparent_temperature,
    code: raw.weather_code,
    isDay: raw.is_day === 1,
    windSpeed: raw.wind_speed_10m,
    /* Stariji keširani odgovori nemaju udare — 0 znači "bez značke". */
    windGusts: raw.wind_gusts_10m ?? 0,
    windDir: raw.wind_direction_10m,
    humidity: raw.relative_humidity_2m,
    pressure: raw.pressure_msl,
    cloudCover: raw.cloud_cover,
    precipitation: raw.precipitation,
  };
}

/** Lokalni ISO punog sata za `now`, npr. "2026-08-04T10:00". */
function currentHourIso(now: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
}

/** Od punog sata trenutnog vremena, po zadanom najviše 24 točke. */
export function mapHourly(
  raw: OmRawHourly,
  now: Date = new Date(),
  limit = 24,
): HourlyPoint[] {
  const startIso = currentHourIso(now);
  const points: HourlyPoint[] = [];
  for (let i = 0; i < raw.time.length && points.length < limit; i++) {
    const time = raw.time[i]!;
    if (time < startIso) continue;
    points.push({
      time,
      temp: raw.temperature_2m[i]!,
      feelsLike: raw.apparent_temperature[i]!,
      code: raw.weather_code[i]!,
      isDay: raw.is_day[i] === 1,
      precip: raw.precipitation[i]!,
      precipProb: raw.precipitation_probability[i] ?? 0,
      windSpeed: raw.wind_speed_10m[i]!,
      windDir: raw.wind_direction_10m[i]!,
      windGusts: raw.wind_gusts_10m[i]!,
      humidity: raw.relative_humidity_2m[i]!,
      pressure: raw.pressure_msl[i]!,
      cloudCover: raw.cloud_cover[i]!,
      uv: raw.uv_index[i] ?? 0,
      visibility: raw.visibility[i] ?? 0,
    });
  }
  return points;
}

export function mapDaily(raw: OmRawDaily): DailyPoint[] {
  return raw.time.map((date, i) => ({
    date,
    code: raw.weather_code[i]!,
    tMax: raw.temperature_2m_max[i]!,
    tMin: raw.temperature_2m_min[i]!,
    sunrise: raw.sunrise[i]!,
    sunset: raw.sunset[i]!,
    precipSum: raw.precipitation_sum[i] ?? 0,
    precipProbMax: raw.precipitation_probability_max[i] ?? 0,
    uvMax: raw.uv_index_max[i] ?? 0,
    windMax: raw.wind_speed_10m_max[i] ?? 0,
  }));
}

// ---- javni API ----

export async function fetchCurrent(lat: number, lon: number): Promise<CurrentWeather> {
  const base = `${FORECAST_BASE}?latitude=${lat}&longitude=${lon}&current=${CURRENT_PARAMS}&timezone=auto`;
  // Izvan ECMWF pokrivenosti (rijetko) pada se na zadani miks.
  try {
    const res = await fetchJson<OmCurrentResponse>(`${base}&models=${PRIMARY_MODEL}`);
    if (typeof res.current?.temperature_2m === "number") return mapCurrent(res.current);
  } catch {
    // nastavi na fallback
  }
  return mapCurrent((await fetchJson<OmCurrentResponse>(base)).current);
}

/**
 * Trenutno vrijeme za VIŠE mjesta odjednom — JEDAN upit (8.8.2026.).
 *
 * Postoji zbog ladice i tražilice: one pokazuju temperaturu po gradu iz
 * keša (`burin:last-weather`), a keš nitko nije osvježavao. Nakon dan-dva
 * je ondje stajala temperatura koja odavno ne vrijedi.
 *
 * Zašto jedan upit, a ne petlja: Open-Meteo ima SATNU KVOTU (~600/h,
 * probijena testiranjem 6.8.). Šest gradova × svako pokretanje bi je
 * trošilo bez potrebe. Ovaj oblik prima liste koordinata odvojene
 * zarezom i vraća NIZ odgovora istim redoslijedom.
 *
 * Vraća `null` na mjestu svakog grada koji nije uspio — pozivatelj tada
 * zadrži staru vrijednost umjesto da je obriše.
 */
export async function fetchCurrentBatch(
  points: { lat: number; lon: number }[],
): Promise<(CurrentWeather | null)[]> {
  if (points.length === 0) return [];

  const lats = points.map((p) => p.lat).join(",");
  const lons = points.map((p) => p.lon).join(",");
  const url =
    `${FORECAST_BASE}?latitude=${lats}&longitude=${lons}` +
    `&current=${CURRENT_PARAMS}&timezone=auto&models=${PRIMARY_MODEL}`;

  try {
    const res = await fetchJson<OmCurrentResponse | OmCurrentResponse[]>(url);
    /*
     * Za JEDNU točku Open-Meteo vraća objekt, za više njih NIZ. Oba
     * oblika se moraju podnijeti — inače bi jedan spremljeni grad rušio
     * osvježavanje.
     */
    const list = Array.isArray(res) ? res : [res];
    return points.map((_, i) => {
      const cur = list[i]?.current;
      return typeof cur?.temperature_2m === "number" ? mapCurrent(cur) : null;
    });
  } catch {
    // Kvota, mreža ili neispravan odgovor — keš ostaje kakav je bio.
    return points.map(() => null);
  }
}

type OmForecastResponse = { hourly: OmRawHourly; daily: OmRawDaily };

/**
 * Spaja dva izvora: temperature i oborine iz ECMWF-a (izmjereno točnijeg),
 * a UV indeks, vidljivost i zadnja dva dana iz zadanog miksa — ECMWF ta
 * polja ne daje, a pokriva 14 od 16 dana.
 */
export async function fetchForecast(
  lat: number,
  lon: number,
): Promise<{
  hourly: HourlyPoint[];
  hourlyAll: HourlyPoint[];
  daily: DailyPoint[];
}> {
  const base = `${FORECAST_BASE}?latitude=${lat}&longitude=${lon}&hourly=${HOURLY_PARAMS}&daily=${DAILY_PARAMS}&forecast_days=16&timezone=auto`;

  const [primary, fallback] = await Promise.all([
    fetchJson<OmForecastResponse>(`${base}&models=${PRIMARY_MODEL}`).catch(
      () => undefined,
    ),
    fetchJson<OmForecastResponse>(base),
  ]);

  const merged = mergeForecasts(primary, fallback);
  return {
    // `hourly`: sljedeća 24 h za traku na početnoj.
    hourly: mapHourly(merged.hourly),
    // `hourlyAll`: cijeli raspon, za detalje pojedinog dana.
    hourlyAll: mapHourly(merged.hourly, new Date(0), Number.POSITIVE_INFINITY),
    daily: mapDaily(merged.daily),
  };
}

/** Polja koja ECMWF ne daje pa se uzimaju iz zadanog miksa. */
const HOURLY_FROM_FALLBACK = ["uv_index", "visibility"] as const;

/**
 * Za svaki sat/dan uzima vrijednost primarnog modela, a gdje je ona
 * nedostupna (null ili izvan njegovog raspona) vrijednost rezervnog.
 * Izvezeno radi testova.
 */
export function mergeForecasts(
  primary: OmForecastResponse | undefined,
  fallback: OmForecastResponse,
): OmForecastResponse {
  if (!primary?.hourly?.time?.length) return fallback;

  const primaryHourIndex = new Map<string, number>();
  primary.hourly.time.forEach((time, i) => primaryHourIndex.set(time, i));
  const primaryDayIndex = new Map<string, number>();
  primary.daily.time.forEach((date, i) => primaryDayIndex.set(date, i));

  const hourly = { ...fallback.hourly } as OmRawHourly;
  for (const key of Object.keys(fallback.hourly) as (keyof OmRawHourly)[]) {
    if (key === "time") continue;
    if ((HOURLY_FROM_FALLBACK as readonly string[]).includes(key)) continue;
    const primaryValues = primary.hourly[key];
    if (!Array.isArray(primaryValues)) continue;
    hourly[key] = fallback.hourly.time.map((time, i) => {
      const pi = primaryHourIndex.get(time);
      const pv = pi === undefined ? undefined : primaryValues[pi];
      return typeof pv === "number" ? pv : (fallback.hourly[key] as number[])[i]!;
    }) as never;
  }

  const daily = { ...fallback.daily } as OmRawDaily;
  for (const key of Object.keys(fallback.daily) as (keyof OmRawDaily)[]) {
    if (key === "time") continue;
    const primaryValues = primary.daily[key];
    if (!Array.isArray(primaryValues)) continue;
    daily[key] = fallback.daily.time.map((date, i) => {
      const pi = primaryDayIndex.get(date);
      const pv = pi === undefined ? undefined : primaryValues[pi];
      const fv = (fallback.daily[key] as (number | string)[])[i]!;
      return pv === null || pv === undefined ? fv : pv;
    }) as never;
  }

  return { hourly, daily };
}

/**
 * Hrvatska mjesta na vrh (stabilno — unutar grupa redoslijed API-ja
 * ostaje). Geocoding nema filter države, a korisniku u Hrvatskoj je
 * "Novalja, Hrvatska" gotovo uvijek ono što traži, ne istoimeno mjesto
 * na drugom kontinentu. Izvezeno radi testova.
 */
export function croatiaFirst<T extends { countryCode?: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => Number(b.countryCode === "HR") - Number(a.countryCode === "HR"),
  );
}

export async function geocode(query: string): Promise<Place[]> {
  const url = `${GEOCODING_BASE}?name=${encodeURIComponent(query)}&language=hr&count=10&format=json`;
  const res = await fetchJson<OmGeoResponse>(url);
  // `countryCode` OSTAJE u Place (dorada 6.8.2026.): bira Meteoalarm
  // feed za upozorenja u 38 europskih zemalja.
  return croatiaFirst(
    (res.results ?? []).map((r) => ({
      id: placeId(r.latitude, r.longitude),
      name: r.name,
      country: r.country,
      countryCode: r.country_code,
      lat: r.latitude,
      lon: r.longitude,
    })),
  );
}

/** Jedan dan peludi: datum `YYYY-MM-DD` + DNEVNI MAKSIMUM po vrsti. */
export type PollenDay = {
  date: string;
  levels: PollenLevels;
};

export type AirQuality = {
  aqi?: number;
  /**
   * DANAŠNJE vrijednosti (dnevni maksimum) — ono što kartica pokazuje.
   * grains/m³ po vrsti; CAMS model (Europa), ne mjerenje.
   */
  pollen: PollenLevels;
  /** Danas + sljedeća dva dana, za podstranicu peludi. */
  pollenDays: PollenDay[];
};

/** Vrijednost peludi: broj ili izostanak (CAMS zna vratiti null). */
function pollenNum(v: number | null | undefined): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

const POLLEN_FIELDS = [
  ["alder", "alder_pollen"],
  ["birch", "birch_pollen"],
  ["grass", "grass_pollen"],
  ["mugwort", "mugwort_pollen"],
  ["olive", "olive_pollen"],
  ["ragweed", "ragweed_pollen"],
] as const;

/** Ključ vrste u `PollenLevels` — izveden iz popisa gore, da se ne razidu. */
type PollenSpeciesKey = (typeof POLLEN_FIELDS)[number][0];

/**
 * Satni niz → DNEVNI PROSJEK po vrsti i danu.
 *
 * Zašto po danu, a ne tekući sat (popravak 6.9.2026., Markov nalaz —
 * "na dane je točna, na dane nije"): pelud kroz dan varira DESETEROSTRUKO.
 * Zadar 6.9.2026., ambrozija: 1.4 u ponoć, 27.1 u 9 h, 12.5 u 16 h, 48.7 u
 * 23 h — trideset i pet puta raspon unutar istog dana. Kartica je dotad
 * pokazivala `current`, dakle jedan jedini sat, pa je ista aplikacija na
 * istom danu javljala i "niska" i "vrlo visoka" ovisno o tome kad je
 * korisnik pogledao.
 *
 * PROSJEK, NE MAKSIMUM — ispravak istog dana, nekoliko sati kasnije.
 * Prva izvedba je uzimala maksimum uz obrazloženje da bi prosjek
 * "razvodnio vršak satima mirne noći". Zvuči logično, ali je pogrešno:
 * mjerenje protiv kojeg se uspoređujemo radi TOČNO TO.
 *
 * Hirstov peludomjer nije trenutni mjerač — traka se vrti 24 sata, pa se
 * zrnca prebroje pod mikroskopom i podijele s protokom zraka. Plivina
 * brojka JEST dnevni prosjek. Uspoređivati naš vršak s njihovim prosjekom
 * znači uspoređivati dvije različite mjere, i zato je aplikacija javljala
 * razred više: 6.9.2026. je pisala "vrlo visoka" (max 48.7) dok je ZZJZ
 * mjerio "visoka".
 *
 * Izmjereno na tri dana u Zadru (Pliva: visoka / visoka / visoka):
 *   maksimum → VRLO VISOKA, VRLO VISOKA, VISOKA   (0 od 3 pogođeno)
 *   prosjek  → VISOKA,      VISOKA,      UMJERENA (2 od 3)
 *
 * Treći dan (prosjek 4.9) ostaje niži jer model za taj dan predviđa slabu
 * ambroziju, a Pliva prognozira visoku — to je razlika MODELA i MJERENJA
 * koju agregacija ne može popraviti.
 */
export function pollenDaysFromHourly(hourly: OmPollenHourly | undefined, days = 3): PollenDay[] {
  const times = hourly?.time;
  if (!times?.length) return [];

  /** Zbroj i broj sati po danu i vrsti — prosjek se računa na kraju. */
  const byDate = new Map<string, Partial<Record<PollenSpeciesKey, { sum: number; n: number }>>>();
  for (let i = 0; i < times.length; i += 1) {
    const date = times[i]!.slice(0, 10);
    let acc = byDate.get(date);
    if (!acc) {
      acc = {};
      byDate.set(date, acc);
    }
    for (const [key, field] of POLLEN_FIELDS) {
      const v = pollenNum(hourly?.[field]?.[i]);
      if (v === undefined) continue;
      const seen = acc[key];
      if (seen) {
        seen.sum += v;
        seen.n += 1;
      } else {
        acc[key] = { sum: v, n: 1 };
      }
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, days)
    .map(([date, acc]) => {
      const levels: PollenLevels = {};
      for (const [key] of POLLEN_FIELDS) {
        const a = acc[key];
        if (!a || a.n === 0) continue;
        // Na jednu decimalu — kao što objavljuju peludomjeri.
        levels[key] = Math.round((a.sum / a.n) * 10) / 10;
      }
      return { date, levels };
    });
}

/**
 * Kvaliteta zraka + pelud iz ISTOG upita (isti endpoint, samo više
 * parametara) — pelud ne košta nijedan dodatni poziv, pa ni satni niz za
 * tri dana ne troši dodatnu kvotu.
 *
 * Vraća objekt, nikad `undefined` (react-query pravilo).
 */
export async function fetchAirQuality(lat: number, lon: number): Promise<AirQuality> {
  const url =
    `${AIR_QUALITY_BASE}?latitude=${lat}&longitude=${lon}` +
    `&current=european_aqi` +
    `&hourly=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen` +
    `&forecast_days=3&timezone=auto`;
  const res = await fetchJson<OmAirQualityResponse>(url);
  const pollenDays = pollenDaysFromHourly(res.hourly);
  return {
    aqi: res.current?.european_aqi,
    // Kartica na početnoj govori o DANAŠNJEM danu.
    pollen: pollenDays[0]?.levels ?? {},
    pollenDays,
  };
}

/**
 * Temperatura mora. Marine API pokriva samo morske točke — za kopnene
 * gradove (npr. Zagreb) vraća `null`, a ne grešku.
 *
 * Vraća `null` (NE `undefined`) kad mora nema: react-query zabranjuje
 * `undefined` kao rezultat upita i ruši ekran greškom "Query data cannot
 * be undefined" (izmjereno na Zagrebu, 6.8.2026.).
 */
export async function fetchSeaTemperature(
  lat: number,
  lon: number,
): Promise<number | null> {
  const url = `${MARINE_BASE}?latitude=${lat}&longitude=${lon}&current=sea_surface_temperature&timezone=auto`;
  try {
    const res = await fetchJson<OmMarineResponse>(url);
    const temp = res.current?.sea_surface_temperature;
    return typeof temp === "number" && Number.isFinite(temp) ? temp : null;
  } catch {
    return null;
  }
}
