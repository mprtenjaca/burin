import type { RadarStats } from "@/api/radarSample";
import type { FrameSample } from "@/utils/radarFeatures";
import { clutterScore, frameStrength, radarTemporal } from "@/utils/radarFeatures";

/**
 * Temporalni featurei radara — slučajevi su STVARNI, izmjereni 11.9.2026.
 * nad Metkovićem, Korenicom i Zadrom (vidi zaglavlje `radarFeatures.ts`).
 */

const T0 = Math.floor(new Date(2026, 8, 11, 9, 0).getTime() / 1000);

/** Okvir s zadanom jačinom; `pct` je pokrivenost kruga u postocima. */
const frame = (i: number, dbz: number | null, pct = 100): FrameSample => ({
  maxDbz: dbz,
  meanDbz: dbz,
  medianDbz: dbz,
  p75Dbz: dbz,
  p90Dbz: dbz,
  p95Dbz: dbz,
  weightedMeanDbz: dbz,
  coverage20: pct / 100,
  coverage28: dbz !== null && dbz >= 28 ? pct / 100 : 0,
  coverage40: dbz !== null && dbz >= 40 ? pct / 100 : 0,
  coverage55: 0,
  weightedCoverage20: pct / 100,
  coverPixels: 100,
  echoPixels: dbz === null ? 0 : pct,
  frameTime: T0 + i * 600,
});

describe("radarTemporal — postojanost i trend", () => {
  it("Korenica: 29-37 dBZ na 100 % kruga kroz pola sata → puna postojanost", () => {
    const t = radarTemporal([frame(0, 29), frame(1, 37), frame(2, 33), frame(3, 36)]);
    expect(t.persistence).toBe(1);
    expect(t.echoAgeMin).toBe(30);
    expect(t.jitterDbz).toBeGreaterThan(0);
    expect(t.frames).toBe(4);
  });

  it("Metković: jezgra treperi i NESTANE u zadnjem okviru → prekinut niz", () => {
    // 30 (8 %) → 45 (18 %) → 24 (6 %) → 49 (49 %) → 39 (71 %) → bez odjeka
    const t = radarTemporal([
      frame(0, 30, 8), frame(1, 45, 18), frame(2, 24, 6),
      frame(3, 49, 49), frame(4, 39, 71), frame(5, null, 0),
    ]);
    // Zadnji okvir nema odjeka → niz je prekinut, „traje 0 min".
    expect(t.echoAgeMin).toBe(0);
    expect(t.persistence).toBeCloseTo(5 / 6, 2);
    // Treperenje je veliko — to je potpis jezgre, ne kišnog polja.
    expect(t.jitterDbz).toBeGreaterThan(8);
  });

  it("Zadar 07:30-08:00: raste pa naglo padne → pozitivan pa negativan trend", () => {
    const rast = radarTemporal([frame(0, 33), frame(1, 39), frame(2, 37), frame(3, 38)]);
    expect(rast.trendDbzPerHour).toBeGreaterThan(0);
    const pad = radarTemporal([frame(0, 38), frame(1, 30), frame(2, 22)]);
    expect(pad.trendDbzPerHour).toBeLessThan(0);
  });

  it("prazan niz ne baca", () => {
    const t = radarTemporal([]);
    expect(t).toMatchObject({ persistence: 0, echoAgeMin: 0, frames: 0, speedKmh: null });
  });

  it("jedan okvir: nema ni trenda ni trajanja", () => {
    const t = radarTemporal([frame(0, 40)]);
    expect(t.echoAgeMin).toBe(0);
    expect(t.trendDbzPerHour).toBe(0);
    expect(t.persistence).toBe(1);
  });

  it("frameStrength uzima p90, pa median, pa max", () => {
    expect(frameStrength(frame(0, 35))).toBe(35);
    const noP90 = { ...frame(0, 35), p90Dbz: null, medianDbz: 22 };
    expect(frameStrength(noP90)).toBe(22);
  });
});

describe("radarTemporal — pomak (motion)", () => {
  const four = [frame(0, 35), frame(1, 35), frame(2, 35), frame(3, 35)];

  it("težište koje se dosljedno seli daje brzinu i smjer ODAKLE dolazi", () => {
    // seli se prema ISTOKU 3 km po okviru (10 min) = 18 km/h
    const c = [0, 1, 2, 3].map((i) => ({ xKm: -4.5 + i * 3, yKm: 0 }));
    const t = radarTemporal(four, c);
    expect(t.speedKmh).toBeCloseTo(18, 0);
    // ide na istok → dolazi sa ZAPADA = 270°
    expect(t.fromDirDeg).toBeCloseTo(270, 0);
    expect(t.motionConfidence).toBeGreaterThan(0.5);
  });

  it("NEPOMIČNO težište: brzina ~0, pouzdanost 0 (potpis zemljanog odjeka)", () => {
    const c = [0, 1, 2, 3].map(() => ({ xKm: 1, yKm: 1 }));
    const t = radarTemporal(four, c);
    expect(t.speedKmh).toBeCloseTo(0, 1);
    expect(t.motionConfidence).toBe(0);
  });

  it("težište koje skače naprijed-nazad je ŠUM, ne kretanje", () => {
    const c = [{ xKm: 0, yKm: 0 }, { xKm: 2, yKm: 0 }, { xKm: 0, yKm: 0 }, { xKm: 2, yKm: 0 }];
    const t = radarTemporal(four, c);
    // Nedosljedni koraci → niska pouzdanost iako brzina nije nula.
    expect(t.motionConfidence).toBeLessThan(0.3);
  });

  it("bez težišta se pomak NE izmišlja", () => {
    const t = radarTemporal(four);
    expect(t.speedKmh).toBeNull();
    expect(t.fromDirDeg).toBeNull();
    expect(t.motionConfidence).toBe(0);
  });

  it("pomak ispod ~3 km/h se ne vjeruje — to je pola piksela na z=7", () => {
    const c = [0, 1, 2, 3].map((i) => ({ xKm: i * 0.2, yKm: 0 })); // 1.2 km/h
    const t = radarTemporal(four, c);
    expect(t.motionConfidence).toBe(0);
  });
});

describe("clutterScore — 0..1, nikad odluka", () => {
  const stats = (over: Partial<RadarStats> = {}): RadarStats => ({
    ...frame(0, 45, 18),
    ...over,
  });

  it("nepomična, mirna, uska jezgra kroz pola sata → visok score (Polača)", () => {
    const t = radarTemporal(
      [frame(0, 45, 18), frame(1, 45, 18), frame(2, 45, 18), frame(3, 45, 18)],
      [0, 1, 2, 3].map(() => ({ xKm: 0.5, yKm: 0.5 })),
    );
    const c = clutterScore(stats({ coverage20: 0.18 }), t);
    expect(c).toBeGreaterThan(0.5);
  });

  it("široko polje koje se seli → nizak score (prava kiša)", () => {
    const t = radarTemporal(
      [frame(0, 30), frame(1, 34), frame(2, 37), frame(3, 33)],
      [0, 1, 2, 3].map((i) => ({ xKm: -4 + i * 3, yKm: 0 })),
    );
    const c = clutterScore(stats({ coverage20: 1, maxDbz: 37 }), t);
    expect(c).toBeLessThan(0.3);
  });

  it("bez odjeka nema cluttera", () => {
    const t = radarTemporal([frame(0, null, 0)]);
    expect(clutterScore(stats({ maxDbz: null }), t)).toBe(0);
  });

  it("NIKAD ne prelazi 1 ni ne pada pod 0", () => {
    const t = radarTemporal(
      [frame(0, 60, 5), frame(1, 60, 5), frame(2, 60, 5), frame(3, 60, 5), frame(4, 60, 5)],
      [0, 1, 2, 3, 4].map(() => ({ xKm: 0, yKm: 0 })),
    );
    const c = clutterScore(stats({ maxDbz: 60, coverage20: 0.05 }), t);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it("Korenica: 100 % kruga, stabilno pola sata — smije imati score, ali ne 1", () => {
    // Jaka kiša MOŽE izgledati stacionarno; zato clutter snizava
    // pouzdanost, a ne obara tvrdnju (vidi `currentWeatherV2`).
    const t = radarTemporal(
      [frame(0, 29), frame(1, 37), frame(2, 33), frame(3, 36)],
      [0, 1, 2, 3].map(() => ({ xKm: 0, yKm: 0 })),
    );
    const c = clutterScore(stats({ maxDbz: 37, coverage20: 1 }), t);
    expect(c).toBeLessThan(1);
  });
});
