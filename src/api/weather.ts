import type {
  CurrentWeather,
  DailyPoint,
  DhmzObservation,
  HourlyPoint,
  Place,
  WeatherBundle,
} from "./types";

/** Spaja izvore (Open-Meteo + DHMZ + AQI) u jedan paket za UI. */
export function buildBundle(args: {
  place: Place;
  current: CurrentWeather;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  dhmz?: DhmzObservation;
  aqi?: number;
}): WeatherBundle {
  return {
    place: args.place,
    current: args.current,
    hourly: args.hourly,
    daily: args.daily,
    dhmz: args.dhmz,
    aqi: args.aqi,
    fetchedAt: Date.now(),
  };
}
