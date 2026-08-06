import { biasSlotForHour, isZeroBias } from "./bias";
import type { ModelBias } from "./bias";
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
 *    gotovo u cijelosti; postaja na 55 km je druga mikroklima i smije ga
 *    samo dotjerati. Zato težina razlike pada s udaljenošću, a najveći
 *    dopušteni pomak ovisi o blizini najbliže postaje (5 °C uz mjesto ->
 *    1 °C na granici od 60 km). Udaljenost se kažnjava JEDNOM — vidi
 *    `observationDelta`.
 *
 * 2. Ista korekcija se prenosi na krivulju sati (correctHourly), inače
 *    hero kaže 25° a prvi sat u traci 27° — vidljivo proturječje. Model
 *    sistematski promaši noćno hlađenje u kraškom zaleđu (provjereno
 *    4.8.2026.: Zemunik izmjerio 22.4°, model tvrdio 27.5° na istoj
 *    točki; Daruvar +8.1 °C), pa korekcija noću drži punu težinu, danju
 *    je prigušena (sunce razbije jezero hladnog zraka), a s odmakom
 *    prognoze blijedi prema nuli.
 */

/**
 * Unutar ovog radijusa mjerenje korigira model; dalje korekcija slabi do nule.
 *
 * 60 km, ne 40: u međuterminima DHMZ objavi samo ~29 postaja (izmjereno
 * 5.8.2026. u 01 h), pa je na 40 km pola zemlje ostajalo posve bez korekcije.
 * Leave-one-out na 29 postaja: 60 km daje 1.99 °C, 40 km 2.09 °C.
 */
const CORRECTION_RANGE_KM = 60;

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
 * Pomak (°C) koji mjerenja okolnih postaja nameću modelu za "sada".
 * Koristi se prosjek nekoliko postaja vagan po udaljenosti — leave-one-out
 * test na 62 DHMZ postaje (4.8.2026.) pokazao je da prosjek 3 postaje daje
 * 1.73 °C prosječnog odmaka od termometra, dok samo najbliža daje 1.91 °C
 * a čisti model 1.85 °C: jedna nereprezentativna postaja tako ne odlučuje
 * sama. Vraća 0 kad nema upotrebljive postaje u dometu.
 */
export function observationDelta(
  current: CurrentWeather,
  obs?: DhmzObservation | DhmzObservation[],
): number {
  const list = (Array.isArray(obs) ? obs : obs ? [obs] : []).filter(
    (o) => o.temp !== undefined,
  );
  if (list.length === 0) return 0;

  let weightSum = 0;
  let deltaSum = 0;
  let bestCloseness = 0;
  for (const o of list) {
    const closeness = Math.max(0, 1 - o.distanceKm / CORRECTION_RANGE_KM);
    if (closeness <= 0) continue;
    weightSum += closeness;
    deltaSum += closeness * (o.temp! - current.temp);
    bestCloseness = Math.max(bestCloseness, closeness);
  }
  if (weightSum <= 0) return 0;

  /*
   * Vagani prosjek razlike, BEZ dodatnog množenja s `bestCloseness`.
   * Udaljenost je već uračunata dvaput bi je kaznila: težina svake postaje
   * pada s udaljenošću (`closeness`), pa je prosjek množen još i najboljom
   * blizinom puštao npr. samo 30 % stvarne razlike. Model je noću pretopao
   * na 25 od 29 postaja (izmjereno +2.24 °C, 5.8.2026. u 01 h), a arhiva
   * tu grešku ne vidi (na Polači uči +0.14 °C uz stvarnu +4 °C) — pa je
   * mjerenje jedina obrana i ne smije se prigušiti.
   *
   * Leave-one-out na 29 postaja: bez prigušenja 1.99 °C, s prigušenjem
   * 2.37 °C, bez ikakve korekcije 2.58 °C. Granica (`cap`) i dalje ovisi o
   * blizini, pa daleka postaja ne može napraviti veliki pomak.
   */
  const raw = deltaSum / weightSum;
  const cap =
    MAX_CORRECTION_FAR_C +
    (MAX_CORRECTION_NEAR_C - MAX_CORRECTION_FAR_C) * bestCloseness;
  return Math.max(-cap, Math.min(cap, raw));
}

/** "Sada" korigirano mjerenjima; osjet se pomiče za istu razliku. */
export function correctWithObservation(
  current: CurrentWeather,
  obs?: DhmzObservation | DhmzObservation[],
): CurrentWeather {
  const delta = observationDelta(current, obs);
  if (delta === 0) return current;
  return {
    ...current,
    temp: current.temp + delta,
    feelsLike: current.feelsLike + delta,
  };
}

/**
 * Uklanja naučenu pristranost modela iz satne krivulje. Ovo rješava ono
 * što korekcija mjerenjem ne može: prognozu za sutra i dalje. Model u
 * kraškom zaleđu sistematski ne dopušta noćno hlađenje (Starigrad:
 * izmjerena dnevna amplituda 11.7 °C, model daje ~6 °C), pa su jutarnji
 * minimumi bili nekoliko stupnjeva previsoki.
 */
export function debiasHourly(
  hourly: HourlyPoint[],
  bias: ModelBias,
): HourlyPoint[] {
  if (isZeroBias(bias)) return hourly;
  return hourly.map((h) => {
    const b = bias[biasSlotForHour(Number(h.time.slice(11, 13)))];
    if (b === 0) return h;
    return { ...h, temp: h.temp - b, feelsLike: h.feelsLike - b };
  });
}

/**
 * Isto za dnevne min/max. Minimum se ravna po jutarnjoj pristranosti
 * (`dawn`) jer dnevni minimum gotovo uvijek pada u to razdoblje.
 */
export function debiasDaily(daily: DailyPoint[], bias: ModelBias): DailyPoint[] {
  if (isZeroBias(bias)) return daily;
  return daily.map((d) => ({
    ...d,
    tMin: d.tMin - bias.dawn,
    tMax: d.tMax - bias.day,
  }));
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
  pollen?: WeatherBundle["pollen"];
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
    pollen: args.pollen,
    seaTemp: args.seaTemp,
    fetchedAt: Date.now(),
  };
}
