import type { HourlyPoint } from "../types";
import { CLEAR_SKY_MAX_CLOUD, CLEAR_SKY_MAX_MM, clearSkyProbCap, dropImpossiblePrecip, withCurrentCode, withPastCodes } from "../weather";

/**
 * Prvi stupac trake sati nosi ISTI kod kao heroj (10.9.2026.) — isto
 * pravilo koje za temperaturu već vrijedi. Heroj piše ono što radar i
 * postaja mjere; traka je iz modela, pa je znala crtati kišu dok heroj
 * kaže oblačno.
 */
const h = (time: string, code: number): HourlyPoint => ({ time, code } as unknown as HourlyPoint);
const now = new Date(2026, 8, 10, 13, 24);

describe("withCurrentCode", () => {
  it("mijenja kod SAMO tekućem satu, ostatak trake ostaje prognoza", () => {
    const hourly = [h("2026-09-10T13:00", 61), h("2026-09-10T14:00", 61), h("2026-09-10T15:00", 3)];
    const out = withCurrentCode(hourly, 3, now);
    expect(out.map((p) => p.code)).toEqual([3, 61, 3]);
    expect(out[1]).toBe(hourly[1]);
  });

  it("isti kod = ISTA referenca — memo(Hero) ne smije pucati uzalud", () => {
    const hourly = [h("2026-09-10T13:00", 3), h("2026-09-10T14:00", 61)];
    expect(withCurrentCode(hourly, 3, now)).toBe(hourly);
  });

  it("bez tekućeg sata u nizu (star niz) ne mijenja ništa", () => {
    const hourly = [h("2026-09-10T11:00", 61), h("2026-09-10T12:00", 61)];
    expect(withCurrentCode(hourly, 3, now)).toBe(hourly);
  });

  it("radi i s vlastitim razredom 3.5", () => {
    const out = withCurrentCode([h("2026-09-10T13:00", 95)], 3.5, now);
    expect(out[0]!.code).toBe(3.5);
  });
});

/*
 * PROŠLI SATI IZ RADARA (11.9.2026., Markov nalaz „ikonice za danas mi se
 * čine netočne").
 *
 * Stvarni slučaj: model je za Zadar u 07:00 tvrdio „pretežno vedro"
 * (kod 1) dok je radar nad istom točkom imao 32 dBZ, a u 07:40 39 dBZ.
 * Traka je taj kriv podatak držala i nakon što je kiša prošla.
 */
describe("withPastCodes", () => {
  const jutro = new Date(2026, 8, 11, 8, 25);
  const traka = () => [
    h("2026-09-11T06:00", 1),
    h("2026-09-11T07:00", 1), // model: „pretežno vedro" — a padalo je
    h("2026-09-11T08:00", 1), // tekući sat
    h("2026-09-11T09:00", 51),
  ];

  it("Zadar 07:00: model kaže vedro, radar je vidio kišu → KIŠA", () => {
    const out = withPastCodes(traka(), new Map([["2026-09-11T07:00", 63]]), jutro);
    expect(out.map((p) => p.code)).toEqual([1, 63, 1, 51]);
  });

  it("NE DIRA tekući ni buduće sate — njih vode heroj i model", () => {
    const past = new Map([
      ["2026-09-11T08:00", 65], // tekući — mora ostati
      ["2026-09-11T09:00", 65], // budući — mora ostati
    ]);
    expect(withPastCodes(traka(), past, jutro)).toEqual(traka());
  });

  it("sat bez okvira se ne dira", () => {
    const out = withPastCodes(traka(), new Map([["2026-09-11T07:00", 63]]), jutro);
    expect(out[0]!.code).toBe(1);
  });

  it("prazna mapa vraća ISTU referencu — memo ne smije pucati uzalud", () => {
    const t = traka();
    expect(withPastCodes(t, new Map(), jutro)).toBe(t);
  });

  it("isti kod vraća ISTU referencu", () => {
    const t = traka();
    expect(withPastCodes(t, new Map([["2026-09-11T07:00", 1]]), jutro)).toBe(t);
  });

  it("mijenja više prošlih sati odjednom", () => {
    const past = new Map([
      ["2026-09-11T06:00", 61],
      ["2026-09-11T07:00", 65],
    ]);
    expect(withPastCodes(traka(), past, jutro).map((p) => p.code)).toEqual([61, 65, 1, 51]);
  });
});

/*
 * KISA IZ VEDROG NEBA (11.9.2026.) — Markov nalaz: „za Zadar u 2 pise kisa
 * a mislim da se to nece desiti… ikona kise i 94 % sto je NEMOGUCE".
 *
 * Izmjereno, ECMWF za Zadar u 14:00:
 *   kod 53 „rosulja", 0.8 mm, vjerojatnost 94 %, NAOBLAKA 14 %
 * Drugi model (best_match) za isti sat: kod 1 „pretezno vedro", 0 mm.
 *
 * Na 12 gradova x 48 h: 174 sata s oborinom, od toga 24 (14 %) uz
 * naoblaku < 40 %. Najgori Dubrovnik 20:00 — rosulja uz 5 % oblaka.
 */
const hp = (over: Partial<HourlyPoint>): HourlyPoint =>
  ({ time: "2026-09-11T14:00", code: 53, precip: 0.8, precipProb: 94, cloudCover: 14, ...over }) as HourlyPoint;

describe("dropImpossiblePrecip", () => {
  it("Zadar 14:00: rosulja 0.8 mm uz 14 % neba → nije oborina", () => {
    const out = dropImpossiblePrecip([hp({})]);
    expect(out[0]!.code).toBe(1); // 14 % → pretezno vedro
    expect(out[0]!.precip).toBe(0);
    // Postotak se STISCE prema naoblaci, ne nulira: 14 % neba -> 5 %.
    expect(out[0]!.precipProb).toBe(5);
  });

  it("Dubrovnik 20:00: rosulja uz 5 % neba → nije oborina", () => {
    const out = dropImpossiblePrecip([hp({ code: 51, precip: 0.2, precipProb: 45, cloudCover: 5 })]);
    expect(out[0]!.code).toBe(0);
  });

  it("Split: 4.4 mm uz 29 % neba OSTAJE — konvekcija pada iz malo oblaka", () => {
    const out = dropImpossiblePrecip([hp({ code: 63, precip: 4.4, precipProb: 100, cloudCover: 29 })]);
    expect(out[0]!.code).toBe(63);
  });

  it("obicna kisa pod oblacnim nebom se NE dira", () => {
    const out = dropImpossiblePrecip([hp({ code: 63, precip: 2, precipProb: 80, cloudCover: 90 })]);
    expect(out[0]!.code).toBe(63);
  });

  it("granice: 30 % neba i 0.5 mm", () => {
    expect(CLEAR_SKY_MAX_CLOUD).toBe(30);
    expect(CLEAR_SKY_MAX_MM).toBe(1);
    // Zadar (0.8 mm, 14 %) pada; Split (4.4 mm, 29 %) ostaje.
    expect(dropImpossiblePrecip([hp({ cloudCover: 29, precip: 1 })])[0]!.code).not.toBe(53);
    expect(dropImpossiblePrecip([hp({ cloudCover: 30, precip: 1 })])[0]!.code).toBe(53);
    expect(dropImpossiblePrecip([hp({ cloudCover: 29, precip: 1.1 })])[0]!.code).toBe(53);
  });

  it("bez izmjene vraca ISTU referencu — memo ne smije pucati", () => {
    const same = [hp({ code: 3, precip: 0, precipProb: 0, cloudCover: 90 })];
    expect(dropImpossiblePrecip(same)).toBe(same);
  });

  /*
   * Markov nalaz, isti sat: „sad za Zadar piše 0 % za sljedeći sat i onda
   * u 15h 79 %, nema smisla — a nije ni 0 vjerojatno". Prva verzija je
   * postotak NULIRALA i time napravila nemoguć skok 0 → 80 %.
   *
   * Izmjereno na 12 gradova × 72 h, sati BEZ IJEDNE KAPI (mm = 0):
   *   naoblaka 0–14 % → prosjek 1 %  |  15–29 % → 4 % (p90 8 %)
   * Dakle ni posve suh sat nije na nuli. Strop je `naoblaka / 3`.
   */
  it("postotak se STISCE prema naoblaci, ne nulira", () => {
    expect(clearSkyProbCap(14)).toBe(5);
    expect(clearSkyProbCap(29)).toBe(10);
    expect(clearSkyProbCap(5)).toBe(2);
  });

  it("nikad ne DIZE postotak — model koji je dao manje zadrzava svoj broj", () => {
    expect(dropImpossiblePrecip([hp({ precipProb: 2, cloudCover: 29 })])[0]!.precipProb).toBe(2);
  });

  /*
   * Markov nalaz: „piše mi u 3 80 % padalina za Zadar". ECMWF za 15:00:
   * 80 % uz 0 mm i 25 % neba; yr.no za isti sat `clearsky_day`.
   * Izmjereno na 12 gradova × 72 h: od 690 suhih sati 21 nosi >= 50 %.
   */
  it("Zadar 15:00: 80 % uz 0 mm i 25 % neba -> postotak pada na 8 %", () => {
    const out = dropImpossiblePrecip([hp({ code: 1, precip: 0, precipProb: 80, cloudCover: 25 })]);
    expect(out[0]!.precipProb).toBe(8);
    expect(out[0]!.code).toBe(1); // kod se ne dira, nije oborinski
  });

  it("suh sat pod OBLACNIM nebom smije nositi postotak", () => {
    const out = dropImpossiblePrecip([hp({ code: 3, precip: 0, precipProb: 30, cloudCover: 95 })]);
    expect(out[0]!.precipProb).toBe(30);
  });

  it("sat s KISOM zadrzava svoj postotak — dira se samo suhi", () => {
    const out = dropImpossiblePrecip([hp({ code: 63, precip: 2, precipProb: 90, cloudCover: 95 })]);
    expect(out[0]!.precipProb).toBe(90);
  });

  it("snijeg i grmljavina se sude istim pravilom", () => {
    expect(dropImpossiblePrecip([hp({ code: 71, precip: 0.2, cloudCover: 10 })])[0]!.code).toBe(0);
    expect(dropImpossiblePrecip([hp({ code: 95, precip: 0.3, cloudCover: 20 })])[0]!.code).toBe(1);
  });
});
