import type { HourlyPoint } from "@/api/types";
import { buildDayParts } from "../dayParts";

const h = (
  time: string,
  temp: number,
  extra: Partial<HourlyPoint> = {},
): HourlyPoint => ({
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
  ...extra,
});

function fullDay(date: string): HourlyPoint[] {
  const hours: HourlyPoint[] = [];
  for (let i = 0; i < 24; i++) {
    const hh = String(i).padStart(2, "0");
    // Realna krivulja: minimum oko 5 h, maksimum oko 15 h.
    const temp = 22 + 10 * Math.sin(((i - 5) / 24) * Math.PI * 2);
    hours.push(h(`${date}T${hh}:00`, Math.round(temp * 10) / 10, { isDay: i >= 6 && i <= 20 }));
  }
  return hours;
}

describe("buildDayParts", () => {
  it("dijeli dan na 4 razdoblja", () => {
    const parts = buildDayParts(fullDay("2026-08-05"), "2026-08-05");
    expect(parts.map((p) => p.id)).toEqual([
      "morning",
      "afternoon",
      "evening",
      "night",
    ]);
  });

  it("noć prikazuje minimum, ostala razdoblja maksimum", () => {
    const parts = buildDayParts(fullDay("2026-08-05"), "2026-08-05");
    const night = parts.find((p) => p.id === "night")!;
    const afternoon = parts.find((p) => p.id === "afternoon")!;
    const nightTemps = night.hours.map((x) => x.temp);
    const afternoonTemps = afternoon.hours.map((x) => x.temp);
    expect(night.temp).toBe(Math.min(...nightTemps));
    expect(afternoon.temp).toBe(Math.max(...afternoonTemps));
  });

  it("izostavlja razdoblja bez podataka (npr. prošli sati danas)", () => {
    // Samo večernji sati dostupni.
    const hours = [
      h("2026-08-05T19:00", 28),
      h("2026-08-05T20:00", 27),
      h("2026-08-05T21:00", 26),
    ];
    const parts = buildDayParts(hours, "2026-08-05");
    expect(parts).toHaveLength(1);
    expect(parts[0]!.id).toBe("evening");
  });

  it("uzima samo sate traženog datuma", () => {
    const hours = [
      ...fullDay("2026-08-05"),
      h("2026-08-06T14:00", 99),
    ];
    const parts = buildDayParts(hours, "2026-08-05");
    const allTemps = parts.flatMap((p) => p.hours.map((x) => x.temp));
    expect(allTemps).not.toContain(99);
  });

  it("vjerojatnost oborina je najveća u razdoblju, količina zbir", () => {
    const hours = [
      h("2026-08-05T12:00", 30, { precipProb: 10, precip: 0.5 }),
      h("2026-08-05T13:00", 31, { precipProb: 60, precip: 1.5 }),
      h("2026-08-05T14:00", 32, { precipProb: 30, precip: 0 }),
    ];
    const parts = buildDayParts(hours, "2026-08-05");
    expect(parts[0]!.precipProb).toBe(60);
    expect(parts[0]!.precipSum).toBe(2);
  });

  it("dominantni kod je najčešći, pri izjednačenju teži", () => {
    const hours = [
      h("2026-08-05T12:00", 30, { code: 3 }),
      h("2026-08-05T13:00", 30, { code: 61 }),
      h("2026-08-05T14:00", 30, { code: 61 }),
    ];
    expect(buildDayParts(hours, "2026-08-05")[0]!.code).toBe(61);

    const tied = [
      h("2026-08-05T12:00", 30, { code: 3 }),
      h("2026-08-05T13:00", 30, { code: 95 }),
    ];
    expect(buildDayParts(tied, "2026-08-05")[0]!.code).toBe(95);
  });

  it("udari vjetra su maksimum razdoblja", () => {
    const hours = [
      h("2026-08-05T12:00", 30, { windGusts: 20 }),
      h("2026-08-05T13:00", 30, { windGusts: 45 }),
    ];
    expect(buildDayParts(hours, "2026-08-05")[0]!.windGusts).toBe(45);
  });

  it("prazna prognoza daje prazan popis", () => {
    expect(buildDayParts([], "2026-08-05")).toEqual([]);
  });
});
