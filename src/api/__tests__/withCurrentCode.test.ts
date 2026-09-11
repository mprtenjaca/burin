import type { HourlyPoint } from "../types";
import { withCurrentCode, withPastCodes } from "../weather";

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
