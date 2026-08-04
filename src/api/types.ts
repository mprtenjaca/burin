/** Mjesto (grad ili GPS lokacija) — ključ za spremanje i za query keys. */
export type Place = {
  id: string; // `${lat.toFixed(3)},${lon.toFixed(3)}`
  name: string;
  country?: string;
  lat: number;
  lon: number;
  isGps?: boolean;
};

export function placeId(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export type CurrentWeather = {
  temp: number;
  feelsLike: number;
  code: number;
  isDay: boolean;
  windSpeed: number;
  windDir: number;
  humidity: number;
  pressure: number;
  cloudCover: number;
  precipitation: number;
};

export type HourlyPoint = {
  time: string; // lokalni ISO, npr. "2026-08-04T16:00"
  temp: number;
  feelsLike: number;
  code: number;
  isDay: boolean;
  precip: number;
  precipProb: number;
  windSpeed: number;
  windDir: number;
  windGusts: number;
  humidity: number;
  pressure: number;
  cloudCover: number;
  uv: number;
  visibility: number;
};

export type DailyPoint = {
  date: string; // "2026-08-04"
  code: number;
  tMin: number;
  tMax: number;
  sunrise: string;
  sunset: string;
  precipSum: number;
  precipProbMax: number;
  uvMax: number;
  windMax: number;
};

export type DhmzObservation = {
  stationName: string;
  lat: number;
  lon: number;
  distanceKm: number;
  temp?: number;
  humidity?: number;
  pressure?: number;
  pressureTrend?: number;
  windDir?: string;
  windSpeed?: number;
  conditionText?: string;
  measuredAt: string; // "04.08.2026. 16:00"
};

export type RadarFrame = {
  time: number; // unix sekunde
  path: string;
  isNowcast: boolean;
};

/**
 * Zamjenjivi izvor kartografskih pločica — karta renderira bilo koji
 * TileSource, pa su RainViewer/OWM samo njegovi dobavljači.
 */
export type TileSource = {
  id: string;
  label: string;
  urlTemplate: string; // sadrži {z}/{x}/{y}
  opacity: number;
  attribution: { label: string; url: string };
};

export type OwmLayer = "temp_new" | "clouds_new" | "wind_new" | "precipitation_new";

export type WeatherBundle = {
  place: Place;
  current: CurrentWeather;
  hourly: HourlyPoint[]; // sljedeća 24 sata (traka na početnoj)
  hourlyAll: HourlyPoint[]; // cijeli raspon, za detalje pojedinog dana
  daily: DailyPoint[]; // 16 dana, UI prikazuje 14
  dhmz?: DhmzObservation; // samo ako je najbliža postaja <= 50 km
  aqi?: number; // european_aqi
  seaTemp?: number; // temperatura mora, samo za obalna mjesta
  fetchedAt: number; // epoch ms — "Podaci od HH:mm"
};
