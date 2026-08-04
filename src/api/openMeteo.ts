import { fetchJson } from "./client";
import type { CurrentWeather, DailyPoint, HourlyPoint, Place } from "./types";
import { placeId } from "./types";

const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const AIR_QUALITY_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

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
type OmForecastResponse = { hourly: OmRawHourly; daily: OmRawDaily };

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

/** Od punog sata trenutnog vremena, najviše 24 točke. */
export function mapHourly(raw: OmRawHourly, now: Date = new Date()): HourlyPoint[] {
  const startIso = currentHourIso(now);
  const points: HourlyPoint[] = [];
  for (let i = 0; i < raw.time.length && points.length < 24; i++) {
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
  const url = `${FORECAST_BASE}?latitude=${lat}&longitude=${lon}&current=${CURRENT_PARAMS}&timezone=auto`;
  const res = await fetchJson<OmCurrentResponse>(url);
  return mapCurrent(res.current);
}

export async function fetchForecast(
  lat: number,
  lon: number,
): Promise<{ hourly: HourlyPoint[]; daily: DailyPoint[] }> {
  const url = `${FORECAST_BASE}?latitude=${lat}&longitude=${lon}&hourly=${HOURLY_PARAMS}&daily=${DAILY_PARAMS}&forecast_days=16&timezone=auto`;
  const res = await fetchJson<OmForecastResponse>(url);
  return { hourly: mapHourly(res.hourly), daily: mapDaily(res.daily) };
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
