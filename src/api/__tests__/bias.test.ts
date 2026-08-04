import { NO_BIAS, biasSlotForHour, isZeroBias, shrunkBias } from "../bias";
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
  cloudCover: 10,
  pressure: 1013,
  uv: 3,
  visibility: 20000,
});

describe("biasSlotForHour", () => {
  it("04–08 h je jutarnji minimum (dawn)", () => {
    for (const hour of [4, 5, 6, 7, 8]) {
      expect(biasSlotForHour(hour)).toBe("dawn");
    }
  });

  it("22–03 h je rana noć", () => {
    for (const hour of [22, 23, 0, 1, 2, 3]) {
      expect(biasSlotForHour(hour)).toBe("earlyNight");
    }
  });

  it("09–21 h je dan", () => {
    for (const hour of [9, 12, 15, 18, 21]) {
      expect(biasSlotForHour(hour)).toBe("day");
    }
  });
});

describe("shrunkBias (prigušenje po dosljednosti)", () => {
  it("dosljedni promašaji se primjenjuju gotovo cijeli (Starigrad)", () => {
    // Stvarni promašaji minimuma, Starigrad 11.-30.7.2026.
    const starigrad = [2.1, -1.1, 1.8, 1.5, 1.6, 2.4, 4.5, 1.4, 4.3, 5.4, 0.8, 3.9, 3.0, 4.6, 2.8, 2.5, 3.0, 3.2, 2.8, 3.2];
    const applied = shrunkBias(starigrad);
    expect(applied).toBeGreaterThan(2.3); // gotovo puni prosjek (2.69)
    expect(applied).toBeLessThanOrEqual(2.69);
  });

  it("šum bez smjera se uguši prema nuli", () => {
    const noise = [2, -2, 1.5, -1.5, 1, -1, 2.2, -1.8];
    expect(Math.abs(shrunkBias(noise))).toBeLessThan(0.15);
  });

  it("savršeno dosljedan promašaj se primjenjuje cijeli", () => {
    expect(shrunkBias([2, 2, 2, 2])).toBeCloseTo(2, 5);
  });

  it("prazan popis daje nulu", () => {
    expect(shrunkBias([])).toBe(0);
  });

  it("negativan smjer radi jednako (model prehladan)", () => {
    expect(shrunkBias([-2, -2.2, -1.8, -2])).toBeCloseTo(-2, 1);
  });
});

describe("isZeroBias", () => {
  it("prepoznaje ništavnu pristranost po vrijednosti, ne referenci", () => {
    expect(isZeroBias(NO_BIAS)).toBe(true);
    expect(isZeroBias({ earlyNight: 0, dawn: 0, day: 0 })).toBe(true);
    expect(isZeroBias({ earlyNight: 0, dawn: 2, day: 0 })).toBe(false);
  });
});

describe("debiasHourly", () => {
  const hours = [
    h("2026-08-06T23:00", 27.8), // rana noć
    h("2026-08-06T05:00", 28.5), // jutarnji minimum
    h("2026-08-06T14:00", 34.2), // dan
  ];
  const bias = { earlyNight: 1, dawn: 3, day: 0.5 };

  it("bez pristranosti vraća iste podatke", () => {
    expect(debiasHourly(hours, NO_BIAS)).toBe(hours);
  });

  it("jutarnji minimum dobiva najveću korekciju (Starigrad slučaj)", () => {
    const c = debiasHourly(hours, bias);
    expect(c[1]!.temp).toBeCloseTo(25.5, 5); // 28.5 - 3
  });

  it("rana noć i dan dobivaju svoje vrijednosti", () => {
    const c = debiasHourly(hours, bias);
    expect(c[0]!.temp).toBeCloseTo(26.8, 5); // 27.8 - 1
    expect(c[2]!.temp).toBeCloseTo(33.7, 5); // 34.2 - 0.5
  });

  it("osjet se pomiče zajedno s temperaturom", () => {
    const c = debiasHourly(hours, bias);
    expect(c[1]!.feelsLike - c[1]!.temp).toBeCloseTo(2, 5);
  });

  it("negativna pristranost grije (model prehladan)", () => {
    const c = debiasHourly(hours, { earlyNight: 0, dawn: -2, day: 0 });
    expect(c[1]!.temp).toBeCloseTo(30.5, 5);
  });

  it("ostala polja ostaju nepromijenjena", () => {
    const c = debiasHourly(hours, bias);
    expect(c[1]!.precipProb).toBe(0);
    expect(c[1]!.time).toBe("2026-08-06T05:00");
    expect(c[1]!.humidity).toBe(55);
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

  it("minimum se ravna po jutarnjoj, maksimum po dnevnoj pristranosti", () => {
    const c = debiasDaily(days, { earlyNight: 1, dawn: 4, day: 1.5 });
    expect(c[0]!.tMin).toBeCloseTo(24.3, 5); // 28.3 - 4 (dawn, ne earlyNight)
    expect(c[0]!.tMax).toBeCloseTo(33.2, 5); // 34.7 - 1.5
  });

  it("bez pristranosti vraća iste podatke", () => {
    expect(debiasDaily(days, NO_BIAS)).toBe(days);
  });

  it("ostala polja ostaju nepromijenjena", () => {
    const c = debiasDaily(days, { earlyNight: 1, dawn: 3, day: 1 });
    expect(c[0]!.sunrise).toBe("2026-08-06T05:49");
    expect(c[0]!.precipProbMax).toBe(5);
  });
});
