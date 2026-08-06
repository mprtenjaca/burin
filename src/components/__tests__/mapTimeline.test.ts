import { mapLayerById } from "@/api/mapLayers";
import type { RadarFrame } from "@/api/types";
import type { TimelineHour } from "@/hooks/useTimelineHours";

import { nowStepIndex, timelineSteps } from "../MapTimeline";

const frames: RadarFrame[] = [
  { time: 1785882000, path: "/p1", isNowcast: false },
  { time: 1785883800, path: "/p2", isNowcast: false },
  { time: 1785885600, path: "/p3", isNowcast: true },
];

const hours: TimelineHour[] = [
  { time: "2026-08-05T12:00", temp: 29.4, cloudCover: 10, windSpeed: 12.3, isNow: false },
  { time: "2026-08-05T13:00", temp: 31.2, cloudCover: 40, windSpeed: 18.9, isNow: true },
  { time: "2026-08-05T14:00", temp: 30.8, cloudCover: 65, windSpeed: 22.1, isNow: false },
];

describe("timelineSteps — radar (okviri)", () => {
  const radar = mapLayerById("radar");

  it("daje jedan korak po okviru", () => {
    expect(timelineSteps(radar, frames, [])).toHaveLength(3);
  });

  it("nowcast okviri nose oznaku prognoze, izmjereni ne", () => {
    const steps = timelineSteps(radar, frames, []);
    expect(steps[0]!.note).toBeUndefined();
    expect(steps[2]!.note).toBe("prognoza");
  });

  it('zadnji izmjereni okvir je "sada", ne nowcast', () => {
    const steps = timelineSteps(radar, frames, []);
    expect(steps.map((s) => s.isNow)).toEqual([false, true, false]);
  });

  it("radi i kad nowcasta nema (izmjereno: RainViewer ga zna imati 0)", () => {
    const onlyPast = frames.filter((f) => !f.isNowcast);
    const steps = timelineSteps(radar, onlyPast, []);
    expect(steps).toHaveLength(2);
    expect(steps[1]!.isNow).toBe(true);
    expect(steps.every((s) => s.note === undefined)).toBe(true);
  });
});

describe("timelineSteps — OWM slojevi (sati)", () => {
  it("temperatura prikazuje stupnjeve za centar karte", () => {
    const steps = timelineSteps(mapLayerById("temp_new"), [], hours);
    expect(steps.map((s) => s.note)).toEqual(["29°", "31°", "31°"]);
  });

  it("naoblaka prikazuje postotak", () => {
    const steps = timelineSteps(mapLayerById("clouds_new"), [], hours);
    expect(steps[2]!.note).toBe("65 %");
  });

  it("vjetar prikazuje brzinu u zadanoj jedinici (m/s)", () => {
    const steps = timelineSteps(mapLayerById("wind_new"), [], hours);
    // 18.9 km/h / 3.6 = 5.25 m/s
    expect(steps[1]!.note).toBe("5 m/s");
  });

  /*
   * Jedinice iz postavki MORAJU stići do crte (popravak 6.8.2026.): prije
   * su ovdje išli sirovi °C i tvrdo upisan "km/h", pa je karta pokazivala
   * druge brojeve od ostatka aplikacije kad je odabran °F ili m/s.
   */
  it("poštuje odabrane jedinice", () => {
    const f = timelineSteps(mapLayerById("temp_new"), [], hours, {
      tempUnit: "F",
      windUnit: "kmh",
    });
    // 29.4 °C = 84.9 °F — i oznaka MORA reći da su Fahrenheiti.
    expect(f[0]!.note).toBe("85°F");

    const kmh = timelineSteps(mapLayerById("wind_new"), [], hours, {
      tempUnit: "C",
      windUnit: "kmh",
    });
    expect(kmh[1]!.note).toBe("19 km/h");
  });

  it("Celzijus ostaje bez slova, samo stupnjevi", () => {
    const steps = timelineSteps(mapLayerById("temp_new"), [], hours, {
      tempUnit: "C",
      windUnit: "ms",
    });
    expect(steps[0]!.note).toBe("29°");
  });

  it("sat se označava 24-satno, tekući je označen", () => {
    const steps = timelineSteps(mapLayerById("temp_new"), [], hours);
    expect(steps.map((s) => s.label)).toEqual(["12:00", "13:00", "14:00"]);
    expect(steps.map((s) => s.isNow)).toEqual([false, true, false]);
  });

  it("nedostupna vrijednost ne ruši korak", () => {
    const partial: TimelineHour[] = [{ time: "2026-08-05T12:00", isNow: false }];
    const steps = timelineSteps(mapLayerById("temp_new"), [], partial);
    expect(steps[0]!.label).toBe("12:00");
    expect(steps[0]!.note).toBeUndefined();
  });
});

/**
 * Tvrdi zahtjev: crta postoji na SVAKOM sloju. Ovo hvata regresiju u kojoj
 * bi novi sloj dobio praznu crtu jer mu vrsta nije pokrivena.
 */
describe("crta je prisutna na svim slojevima", () => {
  it("svaki sloj daje korake iz svog izvora", () => {
    for (const layer of ["radar", "temp_new", "clouds_new", "wind_new"] as const) {
      const steps = timelineSteps(mapLayerById(layer), frames, hours);
      expect(steps.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Sidro "Sada" (dorada 6.8.2026.): crta ide od prošlosti preko sada u
 * budućnost, pa play mora krenuti odavde, a ne s kraja niza.
 */
describe("nowStepIndex", () => {
  it("nalazi 'sada' u sredini niza sati", () => {
    const steps = timelineSteps(mapLayerById("temp_new"), [], hours);
    expect(nowStepIndex(steps)).toBe(1);
  });

  it("na radaru je 'sada' zadnji IZMJERENI okvir, prije nowcasta", () => {
    const steps = timelineSteps(mapLayerById("radar"), frames, []);
    expect(nowStepIndex(steps)).toBe(1);
  });

  it("bez 'sada' vraća -1 (crta se tada vrti cijela)", () => {
    const noNow: TimelineHour[] = hours.map((h) => ({ ...h, isNow: false }));
    expect(nowStepIndex(timelineSteps(mapLayerById("temp_new"), [], noNow))).toBe(-1);
    expect(nowStepIndex([])).toBe(-1);
  });
});
