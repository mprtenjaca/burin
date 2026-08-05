import { buildTimelineHours, nowIndex } from "../useTimelineHours";

const raw = {
  hourly: {
    time: ["2026-08-05T12:00", "2026-08-05T13:00", "2026-08-05T14:00"],
    temperature_2m: [29.4, 31.2, null],
    cloud_cover: [10, 40, 65],
    wind_speed_10m: [12.3, 18.9, 22.1],
  },
};

describe("buildTimelineHours", () => {
  const now = new Date(2026, 7, 5, 13, 42);

  it("gradi korak po satu", () => {
    expect(buildTimelineHours(raw, now)).toHaveLength(3);
  });

  it("označava tekući sat (puni sat, ne minute)", () => {
    const hours = buildTimelineHours(raw, now);
    expect(hours.map((h) => h.isNow)).toEqual([false, true, false]);
  });

  it("null vrijednost postaje undefined, ne 0", () => {
    const hours = buildTimelineHours(raw, now);
    expect(hours[2]!.temp).toBeUndefined();
    // Ostala polja tog sata ostaju čitljiva.
    expect(hours[2]!.cloudCover).toBe(65);
  });

  it("prazan odgovor daje prazan niz, ne baca", () => {
    expect(buildTimelineHours({}, now)).toEqual([]);
    expect(buildTimelineHours({ hourly: { time: [] } }, now)).toEqual([]);
  });

  it("nedostupna polja ne ruše gradnju", () => {
    const hours = buildTimelineHours({ hourly: { time: ["2026-08-05T13:00"] } }, now);
    expect(hours[0]!.temp).toBeUndefined();
    expect(hours[0]!.isNow).toBe(true);
  });
});

describe("nowIndex", () => {
  it("nalazi tekući sat", () => {
    const hours = buildTimelineHours(raw, new Date(2026, 7, 5, 13, 5));
    expect(nowIndex(hours)).toBe(1);
  });

  it("vraća -1 kad tekućeg sata nema u nizu", () => {
    const hours = buildTimelineHours(raw, new Date(2026, 7, 9, 3, 0));
    expect(nowIndex(hours)).toBe(-1);
  });
});
