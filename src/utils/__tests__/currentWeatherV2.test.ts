import type { RadarStats } from "@/api/radarSample";
import type { V2Input } from "@/utils/currentWeatherV2";
import {
  CONFIDENCE_WET,
  SKY_FRESH_MIN,
  SKY_STALE_MIN,
  ageDecay,
  intensityDbz,
  intensityFrom,
  judgeCurrentCodeV2,
  modelAgeMinutes,
  precipitationConfidence,
  typeFrom,
} from "@/utils/currentWeatherV2";
import { radarTemporal, type FrameSample } from "@/utils/radarFeatures";

/**
 * V2 sudac — slučajevi su STVARNI, iz mjerenja 11.9.2026. protiv
 * mjerenja na tlu (GeoSphere Austria, mm/10 min) i Markovih nalaza s
 * prozora i s kamera (Zadar, Split, Metković, Korenica).
 */

const T0 = Math.floor(new Date(2026, 8, 11, 10, 0).getTime() / 1000);
const NOW = (T0 + 180) * 1000; // 3 min nakon zadnjeg okvira

const stats = (over: Partial<RadarStats> = {}): RadarStats => ({
  maxDbz: null, meanDbz: null, medianDbz: null, p75Dbz: null, p90Dbz: null,
  p95Dbz: null, weightedMeanDbz: null, coverage20: 0, coverage28: 0,
  coverage40: 0, coverage55: 0, weightedCoverage20: 0, coverPixels: 49,
  echoPixels: 0, ...over,
});

/** Uniforman odjek: sve brojke na istoj jačini, zadana pokrivenost. */
const uniform = (dbz: number, cov = 1): RadarStats =>
  stats({
    maxDbz: dbz, meanDbz: dbz, medianDbz: dbz, p75Dbz: dbz, p90Dbz: dbz,
    p95Dbz: dbz, weightedMeanDbz: dbz * cov,
    coverage20: dbz >= 20 ? cov : 0,
    coverage28: dbz >= 28 ? cov : 0,
    coverage40: dbz >= 40 ? cov : 0,
    coverage55: dbz >= 55 ? cov : 0,
    weightedCoverage20: dbz >= 20 ? cov : 0,
    echoPixels: Math.round(49 * cov),
  });

const frames = (dbzs: (number | null)[], cov = 1): FrameSample[] =>
  dbzs.map((d, i) => ({
    ...(d === null ? stats() : uniform(d, cov)),
    frameTime: T0 - (dbzs.length - 1 - i) * 600,
  }));

const input = (over: Partial<V2Input> = {}): V2Input => ({
  model: { code: 3, cloudCover: 100, ageMin: 120 },
  temp: 15,
  nowMs: NOW,
  ...over,
});

describe("ageDecay — glatki pad, bez skoka", () => {
  it("1 do `fresh`, 0 na `stale`, monotono između", () => {
    expect(ageDecay(0, 15, 75)).toBe(1);
    expect(ageDecay(15, 15, 75)).toBe(1);
    expect(ageDecay(75, 15, 75)).toBe(0);
    expect(ageDecay(100, 15, 75)).toBe(0);
    const a = ageDecay(30, 15, 75);
    const b = ageDecay(50, 15, 75);
    expect(a).toBeGreaterThan(b);
    expect(a).toBeLessThan(1);
    expect(b).toBeGreaterThan(0);
  });

  it("Infinity (nepoznata dob) = bez težine", () => {
    expect(ageDecay(Infinity, 15, 75)).toBe(0);
  });
});

describe("jacina se cita iz MEDIANA, ne iz p90 (Split 11.9.)", () => {
  /*
   * Izmjereno nad splitskom Rivom, ISTI okvir, samo drugi polumjer:
   *   1 km:  max 39  p90 38  median 38  ->  8.9 mm/h
   *   3 km:  max 50  p90 47  median 38  -> 31.6 mm/h (p90) / 6.7 (median)
   * Markov nalaz s kamere: ljudi šetaju bez kišobrana. Median je 38 na
   * SVAKOM polumjeru; p90 ovisi o tome koliki krug gledamo.
   */
  it("median je izvor jacine", () => {
    const s = stats({ maxDbz: 50, p90Dbz: 47, medianDbz: 38, weightedMeanDbz: 36 });
    expect(intensityDbz(s)).toBe(38);
  });

  it("bez mediana pada na weightedMean, pa na max", () => {
    expect(intensityDbz(stats({ maxDbz: 50, weightedMeanDbz: 30 }))).toBe(30);
    expect(intensityDbz(stats({ maxDbz: 50 }))).toBe(50);
  });

  it("uska jaka jezgra NE daje jaku kisu — median je nizak", () => {
    // p90 47 (jezgra 3 km dalje), median 38 (kod tebe)
    const s = stats({ maxDbz: 50, p90Dbz: 47, medianDbz: 38, coverage20: 0.9 });
    expect(intensityFrom(s)).toBe("moderate");
  });

  it("ali KONVEKTIVNO se cita iz jezgre, ne iz tocke", () => {
    const s = stats({ maxDbz: 58, p90Dbz: 56, medianDbz: 30, coverage20: 0.9 });
    expect(intensityFrom(s)).toBe("convective");
  });

  it("cijela ljestvica", () => {
    expect(intensityFrom(uniform(15))).toBe("none");
    expect(intensityFrom(uniform(22))).toBe("light");
    expect(intensityFrom(uniform(30))).toBe("moderate");
    expect(intensityFrom(uniform(45))).toBe("heavy");
  });
});

describe("precipitationConfidence — postojanost nosi (izmjereno)", () => {
  /*
   * Replay protiv mjerenja na tlu, 240 postaja (11.9.2026.):
   *   persistence >= 25 %  ->  mokro 55 %, suho 94 %, F1 0.583  (najbolje)
   *   maxDbz >= 20 (V1)    ->  mokro 37 %, suho 94 %, F1 0.431
   * Pretraga 216 kombinacija tezina NIJE presla postojanost samu.
   */
  it("postojan odjek preko cijelog kruga = visoka pouzdanost", () => {
    const t = radarTemporal(frames([30, 33, 35, 34]));
    expect(precipitationConfidence(uniform(34), t, 0)).toBeGreaterThan(CONFIDENCE_WET);
  });

  it("bez odjeka = nula", () => {
    const t = radarTemporal(frames([null, null, null]));
    expect(precipitationConfidence(stats(), t, 0)).toBe(0);
  });

  it("clutter SNIZAVA, ne obara (jaka kisa moze izgledati stacionarno)", () => {
    const t = radarTemporal(frames([30, 33, 35, 34]));
    const bez = precipitationConfidence(uniform(34), t, 0);
    const uz = precipitationConfidence(uniform(34), t, 1);
    expect(uz).toBeLessThan(bez);
    expect(uz).toBeGreaterThan(0);
  });

  it("nikad izvan 0..1", () => {
    const t = radarTemporal(frames([60, 60, 60, 60]));
    const c = precipitationConfidence(uniform(60), t, 0);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });
});

describe("typeFrom — vrstu zna POSTAJA, radar ne", () => {
  it("postaja odlucuje kad je ima", () => {
    expect(typeFrom(66, 2)).toBe("freezing_rain");
    expect(typeFrom(73, 2)).toBe("snow");
    expect(typeFrom(53, 10)).toBe("drizzle");
    expect(typeFrom(63, 10)).toBe("rain");
    expect(typeFrom(96, 15)).toBe("hail");
  });

  it("bez postaje se pogada iz temperature", () => {
    expect(typeFrom(undefined, -3)).toBe("snow");
    expect(typeFrom(undefined, 1.5)).toBe("sleet");
    expect(typeFrom(undefined, 15)).toBe("rain");
  });
});

describe("judgeCurrentCodeV2 — redoslijed izvora", () => {
  it("radar bez odjeka: NE tvrdi kisu, pise nebo, zastavica bez odjeka", () => {
    const t = radarTemporal(frames([null, null, null]));
    const r = judgeCurrentCodeV2(input({
      radar: { stats: stats(), temporal: t, clutterScore: 0, frameTime: T0 },
      covered: true,
      station: { code: 3.5, ageMin: 10, distanceKm: 2 },
    }));
    expect(r.precipitation).toBe(false);
    expect(r.code).toBe(3.5);
    expect(r.precipitationType).toBeNull();
  });

  it("NEMA radara: nikad 'nema radara = nema kise' -> postaja, pa model", () => {
    const r = judgeCurrentCodeV2(input({
      station: { code: 63, ageMin: 10, distanceKm: 3 },
    }));
    expect(r.precipitation).toBe(true);
    expect(r.source).toBe("station");
    expect(r.diagnostics.flags).toContain("RADAR_UNAVAILABLE");
  });

  it("nepokriveno: model preuzima, uz zastavicu", () => {
    const r = judgeCurrentCodeV2(input({
      radar: { stats: uniform(40), temporal: radarTemporal(frames([40])), clutterScore: 0, frameTime: T0 },
      covered: false,
      model: { code: 61, cloudCover: 90, ageMin: 30 },
    }));
    expect(r.source).toBe("model");
    expect(r.diagnostics.flags).toContain("RADAR_UNCOVERED");
  });

  it("star okvir (> 20 min) se ne uzima", () => {
    const old = T0 - 30 * 60;
    const r = judgeCurrentCodeV2(input({
      radar: { stats: uniform(40), temporal: radarTemporal(frames([40])), clutterScore: 0, frameTime: old },
      covered: true,
      station: { code: 3, ageMin: 10, distanceKm: 2 },
    }));
    expect(r.diagnostics.flags).toContain("RADAR_STALE");
    expect(r.precipitation).toBe(false);
  });

  it("model NE smije nadglasati svjez radar (Korcula: model 96, radar prazan)", () => {
    const t = radarTemporal(frames([null, null, null]));
    const r = judgeCurrentCodeV2(input({
      radar: { stats: stats(), temporal: t, clutterScore: 0, frameTime: T0 },
      covered: true,
      model: { code: 96, cloudCover: 80, ageMin: 120 },
    }));
    expect(r.precipitation).toBe(false);
    expect(r.code).not.toBe(96);
  });

  it("STARI model dobiva zastavicu i nisku pouzdanost", () => {
    const r = judgeCurrentCodeV2(input({ model: { code: 3, cloudCover: 100, ageMin: 150 } }));
    expect(r.diagnostics.flags).toContain("MODEL_STALE");
    expect(r.evidence.model.confidence).toBeLessThan(0.3);
  });

  it("grmljavina samo uz potvrdu ILI konvektivnu jezgru", () => {
    const t = radarTemporal(frames([45, 48, 50, 49]));
    // bez potvrde: jaka kisa, ne grmljavina
    const bez = judgeCurrentCodeV2(input({
      radar: { stats: uniform(49), temporal: t, clutterScore: 0, frameTime: T0 },
      covered: true,
    }));
    expect(bez.code).not.toBe(95);
    // uz postaju koja svjedoci
    const uz = judgeCurrentCodeV2(input({
      radar: { stats: uniform(49), temporal: t, clutterScore: 0, frameTime: T0 },
      covered: true,
      station: { code: 95, ageMin: 10, distanceKm: 2 },
    }));
    expect(uz.code).toBe(95);
  });

  it("dijagnostika uvijek nosi razlog", () => {
    const r = judgeCurrentCodeV2(input());
    expect(r.diagnostics.reason.length).toBeGreaterThan(0);
    expect(Array.isArray(r.diagnostics.flags)).toBe(true);
  });

  it("evidence nosi sve tri skupine, i kad izvora nema", () => {
    const r = judgeCurrentCodeV2(input());
    expect(r.evidence.radar.available).toBe(false);
    expect(r.evidence.station.available).toBe(false);
    expect(r.evidence.model.available).toBe(true);
  });
});

describe("naoblaka ima VLASTITI age decay (Markov nalaz: Zadar oblacno, vani vedro)", () => {
  it("svjeza postaja vodi", () => {
    const r = judgeCurrentCodeV2(input({
      station: { code: 3.5, ageMin: 5, distanceKm: 2 },
      model: { code: 1, cloudCover: 20, ageMin: 120 },
    }));
    expect(r.sky.code).toBe(3.5);
    expect(r.sky.source).toBe("station");
    expect(r.sky.confidence).toBe(1);
  });

  it("STARA postaja gubi tezinu i model preuzima", () => {
    const r = judgeCurrentCodeV2(input({
      station: { code: 3.5, ageMin: 70, distanceKm: 2 },
      model: { code: 1, cloudCover: 20, ageMin: 20 },
    }));
    expect(r.sky.confidence).toBeLessThan(0.5);
  });

  it("granice decaya su dokumentirane brojke", () => {
    expect(SKY_FRESH_MIN).toBe(15);
    expect(SKY_STALE_MIN).toBe(75);
  });

  /*
   * ODSUTNOST ODJEKA NIJE VEDRO. Radar ne vidi oblake; suh oblacan dan je
   * najcesce stanje zime. Ovdje se namjerno RAZILAZIMO s predlozenim
   * dizajnom koji je trazio da stanje "postupno prelazi prema vedrom"
   * kad nema odjeka — to bi svaki oblacan dan pretvorilo u vedar.
   */
  it("radar bez odjeka NE pretvara oblacno u vedro", () => {
    const t = radarTemporal(frames([null, null, null]));
    const r = judgeCurrentCodeV2(input({
      radar: { stats: stats(), temporal: t, clutterScore: 0, frameTime: T0 },
      covered: true,
      station: { code: 3, ageMin: 10, distanceKm: 2 },
      model: { code: 3, cloudCover: 100, ageMin: 60 },
    }));
    expect(r.sky.code).toBe(3);
    expect(r.sky.condition).toBe("overcast");
  });

  it("ali OBORINA koja pada JEST dokaz oblaka — jedini smjer u kojem radar govori o nebu", () => {
    const t = radarTemporal(frames([30, 33, 35, 34]));
    const r = judgeCurrentCodeV2(input({
      radar: { stats: uniform(34), temporal: t, clutterScore: 0, frameTime: T0 },
      covered: true,
      // postaja tvrdi VEDRO, a pada
      station: { code: 0, ageMin: 10, distanceKm: 2 },
    }));
    expect(r.sky.code).toBe(3);
  });

  it("bez ijednog izvora neba: unknown, pouzdanost 0", () => {
    const r = judgeCurrentCodeV2(input({ model: { code: 3, cloudCover: 100, ageMin: 500 } }));
    expect(r.sky.condition).toBe("unknown");
    expect(r.sky.confidence).toBe(0);
  });
});

describe("modelAgeMinutes — model tvrdi svoje 'sada', i ono zna biti staro", () => {
  const now = new Date(2026, 8, 11, 9, 18).getTime();

  it("izmjereni slucaj 11.9.2026.: model kaze 07:15 u 09:18 = 123 min", () => {
    expect(modelAgeMinutes("2026-09-11T07:15", now)).toBeCloseTo(123, 0);
  });

  it("svjez model je svjez", () => {
    expect(modelAgeMinutes("2026-09-11T09:15", now)).toBeCloseTo(3, 0);
  });

  it("nepoznat oblik pretpostavlja 2 h — na strani NEPOVJERENJA, ne nule", () => {
    expect(modelAgeMinutes(undefined, now)).toBe(120);
    expect(modelAgeMinutes("", now)).toBe(120);
    expect(modelAgeMinutes("jucer", now)).toBe(120);
  });

  it("model iz buducnosti (zona, zaokruzivanje) je svjez, ne negativan", () => {
    expect(modelAgeMinutes("2026-09-11T09:30", now)).toBe(0);
  });

  it("starost se PRETACE u pouzdanost koja pada", () => {
    const svjez = ageDecay(modelAgeMinutes("2026-09-11T09:15", now), 30, 240);
    const star = ageDecay(modelAgeMinutes("2026-09-11T07:15", now), 30, 240);
    expect(svjez).toBe(1);
    expect(star).toBeLessThan(svjez);
    expect(star).toBeGreaterThan(0);
  });
});
