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
 */
const PRIMARY_MODEL = "ecmwf_ifs025";

const CURRENT_PARAMS =
  "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_direction_10m,relative_humidity_2m,pressure_msl,cloud_cover,precipitation";
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
  admin1?: string;
};
type OmGeoResponse = { results?: OmGeoResult[] };

type OmAirQualityResponse = { current?: { european_aqi?: number } };

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

export async function geocode(query: string): Promise<Place[]> {
  const url = `${GEOCODING_BASE}?name=${encodeURIComponent(query)}&language=hr&count=8&format=json`;
  const res = await fetchJson<OmGeoResponse>(url);
  return (res.results ?? []).map((r) => ({
    id: placeId(r.latitude, r.longitude),
    name: r.name,
    country: r.country,
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export async function fetchAirQuality(lat: number, lon: number): Promise<number | undefined> {
  const url = `${AIR_QUALITY_BASE}?latitude=${lat}&longitude=${lon}&current=european_aqi&timezone=auto`;
  const res = await fetchJson<OmAirQualityResponse>(url);
  return res.current?.european_aqi;
}

/**
 * Temperatura mora. Marine API pokriva samo morske točke — za kopnene
 * gradove (npr. Zagreb) vraća `null`, a ne grešku, pa se `null` mora
 * izričito pretvoriti u `undefined` da UI ne prikaže "0°" u Zagrebu.
 */
export async function fetchSeaTemperature(
  lat: number,
  lon: number,
): Promise<number | undefined> {
  const url = `${MARINE_BASE}?latitude=${lat}&longitude=${lon}&current=sea_surface_temperature&timezone=auto`;
  try {
    const res = await fetchJson<OmMarineResponse>(url);
    const temp = res.current?.sea_surface_temperature;
    return typeof temp === "number" && Number.isFinite(temp) ? temp : undefined;
  } catch {
    return undefined;
  }
}
