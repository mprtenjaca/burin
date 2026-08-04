import type { CurrentWeather, DhmzObservation, HourlyPoint } from "../types";
import { correctHourly, correctWithObservation, observationDelta } from "../weather";

const model: CurrentWeather = {
  temp: 24,
  feelsLike: 26,
  code: 1,
  isDay: false,
  windSpeed: 10,
  windDir: 180,
  humidity: 50,
  pressure: 1013,
  cloudCover: 20,
  precipitation: 0,
};

const obs = (temp: number | undefined, distanceKm: number): DhmzObservation => ({
  stationName: "Zadar",
  lat: 44.13,
  lon: 15.206,
  distanceKm,
  temp,
  measuredAt: "04.08.2026. 22:00",
});

describe("correctWithObservation (korekcija heroja DHMZ mjerenjem)", () => {
  it("mala razlika na 0 km se primjenjuje cijela", () => {
    expect(correctWithObservation(model, obs(23, 0)).temp).toBeCloseTo(23, 5);
  });

  it("postaja na pola radijusa daje pola razlike", () => {
    // 20 km od 40 km radijusa -> tezina 50 %; razlika -1 -> pomak -0.5
    const c = correctWithObservation(model, obs(23, 20));
    expect(c.temp).toBeCloseTo(23.5, 5);
  });

  it("postaja na granici radijusa (40 km) nema utjecaja", () => {
    expect(correctWithObservation(model, obs(27, 40)).temp).toBe(24);
    expect(correctWithObservation(model, obs(27, 45)).temp).toBe(24);
  });

  it("bliska postaja smije ispraviti veliku grešku modela (Zemunik/Pridraga)", () => {
    // Stvarni slučaj 4.8.2026.: postaja mjeri 22.4°, model tvrdi 27.5°.
    // Postaja na 4 km je pouzdana pa se greška uklanja gotovo u cijelosti.
    const m = { ...model, temp: 27.5, feelsLike: 30 };
    const c = correctWithObservation(m, obs(22.4, 4));
    expect(c.temp).toBeLessThan(24);
    expect(c.temp).toBeGreaterThan(22);
  });

  it("daleka postaja smije samo dotjerati, ne prepisati", () => {
    // Ista velika razlika, ali postaja je 35 km daleko -> najviše ~1 °C.
    const m = { ...model, temp: 27.5 };
    const c = correctWithObservation(m, obs(22.4, 35));
    expect(Math.abs(c.temp - 27.5)).toBeLessThanOrEqual(1.2);
  });

  it("osjet se pomiče za istu razliku (ostaje konzistentan)", () => {
    const c = correctWithObservation(model, obs(23, 0));
    expect(c.feelsLike).toBeCloseTo(25, 5); // 26 - 1
  });

  it("daleka postaja nema korekcije", () => {
    expect(correctWithObservation(model, obs(20, 80)).temp).toBe(24);
  });

  it("bez mjerenja temperature nema korekcije", () => {
    expect(correctWithObservation(model, obs(undefined, 5)).temp).toBe(24);
  });

  it("bez postaje vraća model netaknut", () => {
    expect(correctWithObservation(model, undefined)).toEqual(model);
  });

  it("ostale veličine ostaju modelske", () => {
    const c = correctWithObservation(model, obs(23, 0));
    expect(c.humidity).toBe(50);
    expect(c.pressure).toBe(1013);
    expect(c.code).toBe(1);
  });
});

const hour = (time: string, temp: number, isDay: boolean): HourlyPoint => ({
  time,
  temp,
  feelsLike: temp + 1,
  code: 0,
  isDay,
  precip: 0,
  precipProb: 0,
  windSpeed: 5,
  windDir: 180,
  windGusts: 8,
  humidity: 60,
  pressure: 1013,
  cloudCover: 0,
  uv: 0,
  visibility: 20000,
});

describe("correctHourly (prijenos korekcije na traku po satima)", () => {
  const now = new Date(2026, 7, 4, 23, 30);
  // Stvarna krivulja iz Pridrage 4.8.2026. (model je bio 3-4° pretopao).
  const hours = [
    hour("2026-08-04T23:00", 27.8, false),
    hour("2026-08-05T00:00", 27.3, false),
    hour("2026-08-05T03:00", 26.1, false),
    hour("2026-08-05T05:00", 25.8, false),
    hour("2026-08-05T14:00", 36.5, true),
  ];

  it("bez korekcije vraća iste podatke", () => {
    expect(correctHourly(hours, 0, now)).toBe(hours);
  });

  it("noćni sati se hlade prema mjerenju", () => {
    const c = correctHourly(hours, -3, now);
    expect(c[0]!.temp).toBeLessThan(27.8);
    expect(c[3]!.temp).toBeLessThan(25.8); // 05:00 spusten
    expect(c[3]!.temp).toBeGreaterThan(21); // ali ne pretjerano
  });

  it("dnevni sati su prigušeni (sunce razbije hladni zrak)", () => {
    const c = correctHourly(hours, -4, now);
    const nightShift = Math.abs(c[1]!.temp - 27.3);
    const dayShift = Math.abs(c[4]!.temp - 36.5);
    expect(dayShift).toBeLessThan(nightShift);
  });

  it("prvih nekoliko sati nosi punu korekciju (noć ne prekida na pola)", () => {
    const c = correctHourly(hours, -3, now);
    expect(c[0]!.temp).toBeCloseTo(24.8, 5); // 27.8 - 3
    expect(c[3]!.temp).toBeCloseTo(22.8, 5); // 05:00, jos puna korekcija
  });

  it("korekcija blijedi na dalekim satima", () => {
    const far = [
      hour("2026-08-05T02:00", 26, false), // ~2 h unaprijed, puna
      hour("2026-08-06T02:00", 26, false), // ~26 h unaprijed, oslabljena
    ];
    const c = correctHourly(far, -3, now);
    expect(Math.abs(c[0]!.temp - 26)).toBeGreaterThan(Math.abs(c[1]!.temp - 26));
  });

  it("osjet se pomiče zajedno s temperaturom", () => {
    const c = correctHourly(hours, -2, now);
    expect(c[0]!.feelsLike - c[0]!.temp).toBeCloseTo(1, 5);
  });

  it("ostala polja ostaju nepromijenjena", () => {
    const c = correctHourly(hours, -2, now);
    expect(c[0]!.precipProb).toBe(0);
    expect(c[0]!.humidity).toBe(60);
    expect(c[0]!.time).toBe("2026-08-04T23:00");
  });
});

describe("observationDelta s više postaja", () => {
  it("jedna čudna postaja se ublaži ostalima", () => {
    const m = { ...model, temp: 27 };
    // Sama Zemunik-tip postaja (5° niža) daje velik pomak...
    const alone = observationDelta(m, [obs(22, 10)]);
    // ...ali s dvije normalne postaje u prosjeku je pomak manji.
    const averaged = observationDelta(m, [obs(22, 10), obs(26.5, 12), obs(27, 15)]);
    expect(Math.abs(averaged)).toBeLessThan(Math.abs(alone));
  });

  it("kad se sve postaje slažu, pomak ostaje pun", () => {
    const m = { ...model, temp: 27 };
    const d = observationDelta(m, [obs(24, 5), obs(24, 8), obs(24, 10)]);
    expect(d).toBeLessThan(-1.5);
  });

  it("prazan popis -> 0", () => {
    expect(observationDelta(model, [])).toBe(0);
  });

  it("postaje bez temperature se ignoriraju", () => {
    expect(observationDelta(model, [obs(undefined, 5), obs(undefined, 9)])).toBe(0);
  });

  it("predaleke postaje se ne broje", () => {
    expect(observationDelta(model, [obs(20, 50), obs(20, 60)])).toBe(0);
  });
});

describe("observationDelta", () => {
  it("nema postaje -> 0", () => {
    expect(observationDelta(model, undefined)).toBe(0);
  });

  it("postaja bez temperature -> 0", () => {
    expect(observationDelta(model, obs(undefined, 5))).toBe(0);
  });

  it("predaleka postaja -> 0", () => {
    expect(observationDelta(model, obs(20, 50))).toBe(0);
  });
});
