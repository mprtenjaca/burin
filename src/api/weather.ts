import type {
  CurrentWeather,
  DailyPoint,
  DhmzObservation,
  HourlyPoint,
  Place,
  WeatherBundle,
} from "./types";

/*
 * Korekcija modela stvarnim mjerenjima (DHMZ). Dizajn:
 *
 * 1. Povjerenje u postaju ovisi o udaljenosti. Postaja na 1 km (Split-
 *    Marjan) je praktički termometar tog mjesta i smije ispraviti model
 *    gotovo u cijelosti; postaja na 35 km je druga mikroklima i smije ga
 *    samo dotjerati. Zato i težina razlike i najveći dopušteni pomak
 *    padaju s udaljenošću (5 °C na 0 km -> 1 °C na 40 km).
 *
 * 2. Ista korekcija se prenosi na krivulju sati (correctHourly), inače
 *    hero kaže 25° a prvi sat u traci 27° — vidljivo proturječje. Model
 *    sistematski promaši noćno hlađenje u kraškom zaleđu (provjereno
 *    4.8.2026.: Zemunik izmjerio 22.4°, model tvrdio 27.5° na istoj
 *    točki; Daruvar +8.1 °C), pa korekcija noću drži punu težinu, danju
 *    je prigušena (sunce razbije jezero hladnog zraka), a s odmakom
 *    prognoze blijedi prema nuli.
 */

/** Unutar ovog radijusa mjerenje korigira model; dalje korekcija slabi do nule. */
const CORRECTION_RANGE_KM = 40;

/** Najveći pomak: postaja uz samo mjesto smije više od daleke. */
const MAX_CORRECTION_NEAR_C = 5;
const MAX_CORRECTION_FAR_C = 1;

/** Prigušenje korekcije danju (miješanje zraka poništi noćni efekt). */
const DAYTIME_FACTOR = 0.35;

/**
 * Blijeđenje s odmakom prognoze. Prvih nekoliko sati nosi punu korekciju
 * (greška modela se ne ispravi sama od sebe u sat vremena), pa tek onda
 * slabi — bez toga je jutarnji minimum ostao pretopao jer je korekcija
 * popustila prije nego je noć završila.
 */
const LEAD_FULL_HOURS = 8;
const LEAD_FADE_HOURS = 30;

/**
 * Pomak (°C) koji mjerenje najbliže postaje nameće modelu za "sada".
 * 0 kad nema postaje, postaja nema temperaturu ili je predaleko.
 */
export function observationDelta(
  current: CurrentWeather,
  obs?: DhmzObservation,
): number {
  if (!obs || obs.temp === undefined) return 0;
  const closeness = Math.max(0, 1 - obs.distanceKm / CORRECTION_RANGE_KM);
  if (closeness <= 0) return 0;
  const raw = closeness * (obs.temp - current.temp);
  const cap =
    MAX_CORRECTION_FAR_C +
    (MAX_CORRECTION_NEAR_C - MAX_CORRECTION_FAR_C) * closeness;
  return Math.max(-cap, Math.min(cap, raw));
}

/** "Sada" korigirano mjerenjem; osjet se pomiče za istu razliku. */
export function correctWithObservation(
  current: CurrentWeather,
  obs?: DhmzObservation,
): CurrentWeather {
  const delta = observationDelta(current, obs);
  if (delta === 0) return current;
  return {
    ...current,
    temp: current.temp + delta,
    feelsLike: current.feelsLike + delta,
  };
}

function parseLocalIso(iso: string): Date {
  const [datePart, timePart] = iso.split("T");
  const [y = 1970, m = 1, d = 1] = (datePart ?? "").split("-").map(Number);
  const [hh = 0, mm = 0] = (timePart ?? "").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/**
 * Prenosi trenutnu grešku modela na satnu krivulju: puna težina noću,
 * prigušena danju, i linearno blijedi do LEAD_FADE_HOURS unaprijed.
 * Time je prvi sat u traci konzistentan s herojem, a noćni sati u
 * zaleđu prestaju biti 3-4 °C pretopli.
 */
export function correctHourly(
  hourly: HourlyPoint[],
  delta: number,
  now: Date = new Date(),
): HourlyPoint[] {
  if (delta === 0) return hourly;
  return hourly.map((h) => {
    const hoursAhead = Math.max(
      0,
      (parseLocalIso(h.time).getTime() - now.getTime()) / 3_600_000,
    );
    const leadFade =
      hoursAhead <= LEAD_FULL_HOURS
        ? 1
        : Math.max(
            0,
            1 - (hoursAhead - LEAD_FULL_HOURS) / (LEAD_FADE_HOURS - LEAD_FULL_HOURS),
          );
    const dayFactor = h.isDay ? DAYTIME_FACTOR : 1;
    const applied = delta * leadFade * dayFactor;
    if (applied === 0) return h;
    return { ...h, temp: h.temp + applied, feelsLike: h.feelsLike + applied };
  });
}

/** Spaja izvore (Open-Meteo + DHMZ + AQI) u jedan paket za UI. */
export function buildBundle(args: {
  place: Place;
  current: CurrentWeather;
  hourly: HourlyPoint[];
  hourlyAll: HourlyPoint[];
  daily: DailyPoint[];
  dhmz?: DhmzObservation;
  aqi?: number;
  seaTemp?: number;
}): WeatherBundle {
  return {
    place: args.place,
    current: args.current,
    hourly: args.hourly,
    hourlyAll: args.hourlyAll,
    daily: args.daily,
    dhmz: args.dhmz,
    aqi: args.aqi,
    seaTemp: args.seaTemp,
    fetchedAt: Date.now(),
  };
}
