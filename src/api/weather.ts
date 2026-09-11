import { dhmzTextToCode } from "@/utils/weatherCodes";

import { biasSlotForHour, isZeroBias } from "./bias";
import type { ModelBias } from "./bias";
import type { CurrentWeather, DailyPoint, DhmzObservation, HourlyPoint, Place, WeatherBundle } from "./types";
import { currentHourIso } from "./openMeteo";

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

/**
 * Kad je najbliža postaja unutar ovog dometa, ona ODLUČUJE SAMA — ostale se
 * ne miješaju u prosjek.
 *
 * Povod (Markov nalaz 8.8.2026.): Pridraga i Zadar pokazivali su 31–33 °C
 * dok je Zadar-aerodrom (7 i 11 km) mjerio 35.1. Prosjek triju postaja je
 * blisku postaju PREGLASAO: Veli Rat je svjetionik okružen morem (30.4 °C),
 * Gospić je planina na 560 m (27.7 °C) — dvije posve druge mikroklime na
 * 45+ km. Za Zadar je korekcija tako čak POGORŠALA model: 33.6 bez nje,
 * 32.7 s njom, termometar 35.1.
 *
 * Leave-one-out na 35 postaja, protiv termometra: bez korekcije 1.406,
 * sadašnji prosjek 1.259, samo najbliža uvijek 1.205, **ovo pravilo 1.188**.
 *
 * Strmije padanje težine NE rješava isto (kvadratno 1.272, kubno 1.281 —
 * oboje lošije od linearnog): problem nije oblik krivulje nego to što
 * daleke postaje uopće sudjeluju kad postoji bliska. Prosjek triju ostaje
 * za mjesta bez bliske postaje, gdje je i dalje bolji od jedne daleke.
 *
 * PRAG JE 25 km, ne 15 (ispravak isti dan, iz ispisa s UREĐAJA). Prvotnih
 * 15 je bilo pogođeno, ne izmjereno, i palo je točno između dva slučaja:
 * Zadar je od aerodroma 10.3 km i prolazio je, a PRIDRAGA 18.7 km — pa je
 * padala natrag na prosjek s Gospićem i Kninom i pokazivala 33 umjesto 35.
 *
 * Izmjereno na 36 postaja: 15 km → 1.179, 20 → 1.189, **25 → 1.178**,
 * 30 → 1.204, uvijek prosjek → 1.249, uvijek najbliža → 1.249. Između 15 i
 * 25 je razlika šum, pa je izabran onaj koji pokriva stvarni slučaj —
 * 25 km aktivira pravilo za 13/36 postaja umjesto 8/36.
 */
const DOMINANT_STATION_KM = 25;

/**
 * Prigušenje korekcije danju (miješanje zraka poništi noćni efekt).
 *
 * 0.7, ne 0.35 (izmjereno 8.8.2026. nakon Markova nalaza: Pridraga u 8 h
 * pokazivala 25 °C dok su druge aplikacije davale 29–30).
 *
 * Leave-one-out na 36 DHMZ postaja, protiv TERMOMETRA: bez korekcije 1.46,
 * na 0.35 → 1.215, na 0.7 → **1.109**, na 1.0 → 1.246 °C. Krivulja pada do
 * 0.7 pa raste, dakle prigušenje ostaje opravdano — samo je bilo prejako i
 * propuštalo je tek trećinu izmjerene razlike.
 *
 * NAPOMENA: uzorak je jedan termin (kasno popodne). Jutarnji režim, koji je
 * Marka i naveo na nalaz, nije zasebno izmjeren — `measure-daytime.mjs`
 * skuplja termine pa se broj može potvrditi na širem uzorku.
 */
const DAYTIME_FACTOR = 0.7;

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
export function observationDelta(current: CurrentWeather, obs?: DhmzObservation | DhmzObservation[]): number {
  const all = (Array.isArray(obs) ? obs : obs ? [obs] : []).filter((o) => o.temp !== undefined);
  if (all.length === 0) return 0;

  /*
   * Vrlo bliska postaja ODLUČUJE SAMA — vidi `DOMINANT_STATION_KM`.
   * Termometar na 7 km je taj mikroklimat; postaja na 45 km je drugi kraj
   * i samo ga razvodni.
   */
  const nearest = all.reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a));
  const list =
    nearest.distanceKm <= DOMINANT_STATION_KM ? [nearest] : all;

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
  const cap = MAX_CORRECTION_FAR_C + (MAX_CORRECTION_NEAR_C - MAX_CORRECTION_FAR_C) * bestCloseness;
  return Math.max(-cap, Math.min(cap, raw));
}

/**
 * Dokle vrijedi DHMZ-ov OPIS neba, u kilometrima (9.9.2026.).
 *
 * 25 km, znatno uže od 60 km koje vrijedi za temperaturu. Temperatura se u
 * prostoru mijenja glatko (zato tamo radi i prosjek triju postaja), a
 * naoblaka je zakrpasta — jedan oblak nad Zadrom ne govori ništa o
 * Benkovcu. Uža granica znači da opis dolazi samo od postaje koja gleda
 * ISTO nebo kao korisnik.
 */
export const CONDITION_RANGE_KM = 25;

/**
 * "Sada" korigirano mjerenjima: temperatura i osjet za isti delta, a od
 * 9.9.2026. i OPIS VREMENA s najbliže postaje.
 *
 * Povod za opis je Markov nalaz s prozora: aplikacija je za Zadar pisala
 * „djelomično oblačno" iz modela, dok je DHMZ na zadarskoj postaji mjerio
 * „pretežno oblačno". Isti obrazac koji je već zapisan u odlukama —
 * ECMWF je za Roč davao „vedro" uz izmjerenu grmljavinu u Pazinu. Model
 * nije mjerenje, a nebo je upravo ono što postaja gleda.
 *
 * Bira se NAJBLIŽA postaja, ne prosjek: opisi se ne mogu prosječiti
 * („vedro" + „oblačno" nije „umjereno oblačno" nego dva različita neba).
 */
export function correctWithObservation(current: CurrentWeather, obs?: DhmzObservation | DhmzObservation[]): CurrentWeather {
  const delta = observationDelta(current, obs);

  const list = obs === undefined ? [] : Array.isArray(obs) ? obs : [obs];
  const nearest = list
    .filter((o) => o.distanceKm <= CONDITION_RANGE_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
  const measuredCode = dhmzTextToCode(nearest?.conditionText);

  if (delta === 0 && measuredCode === undefined) return current;
  return {
    ...current,
    temp: current.temp + delta,
    feelsLike: current.feelsLike + delta,
    // Mjerenje pobjeđuje model; nepoznat ili predaleki opis ostavlja model.
    code: measuredCode ?? current.code,
  };
}

/**
 * Uklanja naučenu pristranost modela iz satne krivulje. Ovo rješava ono
 * što korekcija mjerenjem ne može: prognozu za sutra i dalje. Model u
 * kraškom zaleđu sistematski ne dopušta noćno hlađenje (Starigrad:
 * izmjerena dnevna amplituda 11.7 °C, model daje ~6 °C), pa su jutarnji
 * minimumi bili nekoliko stupnjeva previsoki.
 */
export function debiasHourly(hourly: HourlyPoint[], bias: ModelBias): HourlyPoint[] {
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
export function correctHourly(hourly: HourlyPoint[], delta: number, now: Date = new Date()): HourlyPoint[] {
  if (delta === 0) return hourly;
  return hourly.map((h) => {
    const hoursAhead = Math.max(0, (parseLocalIso(h.time).getTime() - now.getTime()) / 3_600_000);
    const leadFade = hoursAhead <= LEAD_FULL_HOURS ? 1 : Math.max(0, 1 - (hoursAhead - LEAD_FULL_HOURS) / (LEAD_FADE_HOURS - LEAD_FULL_HOURS));
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
  pollenDays?: WeatherBundle["pollenDays"];
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
    pollenDays: args.pollenDays,
    seaTemp: args.seaTemp,
    fetchedAt: Date.now(),
  };
}

/**
 * PRVI SAT TRAKE NOSI ISTI KOD KAO HEROJ (10.9.2026.).
 *
 * Isto pravilo koje već vrijedi za temperaturu („hero i prvi sat u traci
 * moraju se poklapati"): heroj sad piše ono što radar i postaja MJERE, a
 * traka je iz modela — pa je prvi stupac znao crtati kišu dok heroj kaže
 * oblačno. Stupac koji predstavlja tekući sat dobiva presuđeni kod;
 * ostatak trake ostaje prognoza. Bez tekućeg sata u nizu (stari niz) se
 * ne mijenja ništa.
 */
export function withCurrentCode(hourly: HourlyPoint[], code: number, now: Date): HourlyPoint[] {
  const iso = currentHourIso(now);
  const idx = hourly.findIndex((h) => h.time === iso);
  if (idx < 0 || hourly[idx]!.code === code) return hourly;
  return hourly.map((h, i) => (i === idx ? { ...h, code } : h));
}

/**
 * PROŠLI SATI TRAKE SE POPRAVLJAJU IZ RADARA (11.9.2026.).
 *
 * Markov nalaz: „ove ikonice za forecast za danas mi se čine netočne".
 * Bio je u pravu, i to mjerljivo: model je za Zadar u 07:00 tvrdio
 * „pretežno vedro" (kod 1, 0 mm) dok je radar nad istom točkom imao
 * 32 dBZ, a u 07:40 čak 39 dBZ (10 mm/h). Traka je taj kriv podatak
 * držala i nakon što je kiša prošla, jer je `withCurrentCode` popravljao
 * SAMO tekući stupac.
 *
 * Radar nosi ~2 h povijesti (13 okvira po 10 min), pa se prošli sati ne
 * moraju nagađati — za njih postoji mjerenje. Svakom prošlom satu se
 * uzme NAJJAČI odjek unutar tog sata (6 okvira): pljusak od 15 min je
 * ono što je čovjek tog sata upamtio, a prosjek bi ga izgladio u ništa.
 *
 * Prevodi se istim pravilima kao „sada" (`precipCodeFromDbz`), ali BEZ
 * grmljavine: munje radar ne vidi, a za prošli sat nema postaje koja bi
 * ih potvrdila. Sat bez ijednog okvira se ne dira.
 *
 * Budući sati ostaju model — njih radar ne zna.
 */
export function withPastCodes(
  hourly: HourlyPoint[],
  pastCodes: Map<string, number>,
  now: Date,
): HourlyPoint[] {
  if (pastCodes.size === 0) return hourly;
  const iso = currentHourIso(now);
  let changed = false;
  const out = hourly.map((h) => {
    if (h.time >= iso) return h;
    const code = pastCodes.get(h.time);
    if (code === undefined || code === h.code) return h;
    changed = true;
    return { ...h, code };
  });
  return changed ? out : hourly;
}
