import type { DailyPoint, HourlyPoint } from "../types";
import { debiasDaily, debiasHourly } from "../weather";

const h = (time: string, temp: number): HourlyPoint => ({
  time,
  temp,
  feelsLike: temp + 2,
  code: 0,
  isDay: true,
  precip: 0,
  precipProb: 0,
  windSpeed: 10,
  windDir: 180,
  windGusts: 15,
  humidity: 55,
  pressure: 1013,
  cloudCover: 10,
  uv: 3,
  visibility: 20000,
});

describe("debiasHourly", () => {
  const hours = [
    h("2026-08-06T05:00", 28.5), // jutro -> nocna pristranost
    h("2026-08-06T14:00", 34.2), // dan -> dnevna pristranost
    h("2026-08-06T23:00", 27.0), // noc
  ];

  it("bez pristranosti vraća iste podatke", () => {
    expect(debiasHourly(hours, { night: 0, day: 0 })).toBe(hours);
  });

  it("uklanja noćnu pristranost s jutarnjih sati (Starigrad slučaj)", () => {
    // Model je nocu 3 °C pretopao -> jutarnji minimum se spusti.
    const c = debiasHourly(hours, { night: 3, day: 1 });
    expect(c[0]!.temp).toBeCloseTo(25.5, 5);
    expect(c[2]!.temp).toBeCloseTo(24.0, 5);
  });

  it("dnevne sate korigira dnevnom pristranošću", () => {
    const c = debiasHourly(hours, { night: 3, day: 1 });
    expect(c[1]!.temp).toBeCloseTo(33.2, 5);
  });

  it("osjet se pomiče zajedno s temperaturom", () => {
    const c = debiasHourly(hours, { night: 2, day: 2 });
    expect(c[0]!.feelsLike - c[0]!.temp).toBeCloseTo(2, 5);
  });

  it("negativna pristranost grije (model prehladan)", () => {
    const c = debiasHourly(hours, { night: -2, day: 0 });
    expect(c[0]!.temp).toBeCloseTo(30.5, 5);
  });

  it("ostala polja ostaju nepromijenjena", () => {
    const c = debiasHourly(hours, { night: 3, day: 1 });
    expect(c[0]!.precipProb).toBe(0);
    expect(c[0]!.time).toBe("2026-08-06T05:00");
    expect(c[0]!.humidity).toBe(55);
  });
});

describe("debiasDaily", () => {
  const days: DailyPoint[] = [
    {
      date: "2026-08-06",
      code: 0,
      tMin: 28.3,
      tMax: 34.7,
      sunrise: "2026-08-06T05:49",
      sunset: "2026-08-06T20:17",
      precipSum: 0,
      precipProbMax: 5,
      uvMax: 8,
      windMax: 20,
    },
  ];

  it("minimum se ravna po noćnoj, maksimum po dnevnoj pristranosti", () => {
    const c = debiasDaily(days, { night: 5, day: 1.5 });
    expect(c[0]!.tMin).toBeCloseTo(23.3, 5); // 28.3 - 5
    expect(c[0]!.tMax).toBeCloseTo(33.2, 5); // 34.7 - 1.5
  });

  it("bez pristranosti vraća iste podatke", () => {
    expect(debiasDaily(days, { night: 0, day: 0 })).toBe(days);
  });

  it("ostala polja ostaju nepromijenjena", () => {
    const c = debiasDaily(days, { night: 3, day: 1 });
    expect(c[0]!.sunrise).toBe("2026-08-06T05:49");
    expect(c[0]!.precipProbMax).toBe(5);
  });
});
