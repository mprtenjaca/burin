import type { RadarEcho } from "@/api/radarSample";
import type { JudgeInput, Judged } from "@/utils/radarJudge";
import {
  DBZ_DRY,
  DBZ_HEAVY,
  DBZ_STORM,
  cloudCodeFromCover,
  judgeCurrentCode,
  stationAgeMinutes,
} from "@/utils/radarJudge";

/**
 * Sudac za `current.code` — slučajevi su STVARNI, s uređaja i iz mjerenja
 * 10.9.2026. (Zadar, Zagreb, Crikvenica, Polača, Verona). Kad se pragovi
 * mijenjaju, ovi slučajevi moraju i dalje davati ono što je izmjereno na
 * tlu.
 */

const NOW = new Date(2026, 8, 10, 13, 24).getTime(); // 10.9.2026. 13:24 lokalno
const echo = (maxDbz: number | null, ageMin = 4): RadarEcho => ({
  maxDbz,
  frameTime: NOW / 1000 - ageMin * 60,
  radiusKm: 5,
  echoPixels: maxDbz === null ? 0 : 100,
});
const base = { modelCode: 3, cloudCover: 100, temp: 23.9, nowMs: NOW, covered: true };

describe("pravilo 1 — OBARANJE (< 20 dBZ): tko god tvrdi oborinu, u krivu je", () => {
  it("Zadar 13:20: 12 dBZ, postaja iz 12:00 još kaže grmljavina → OBLAČNO (Marko: 'ne pada, oblačno')", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 80, echo: echo(12) })).toEqual({ code: 3, source: "radar" });
  });

  it("Crikvenica 13:30: postaja javlja samo vjetar, model kaže kiša (61) uz 0 mm, radar prazan → oblačno", () => {
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(null) })).toEqual({ code: 3, source: "radar" });
  });

  it("Polača 14:00: RainViewer 17 dBZ, model kaže kiša → oblačno (LibreWXR je tu lagao 42)", () => {
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(17) })).toEqual({ code: 3, source: "radar" });
  });

  it("Ogulin/Pazin: model halucinira grmljavinu s tučom (96), radar prazan, postaja 'oblačno' → oblačno s postaje", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 3, stationAgeMin: 50, modelCode: 96, echo: echo(null) })).toEqual({ code: 3, source: "station" });
  });

  it("nebo iz postaje kad ga postaja ima; iz modela (naoblaka %) kad postaja govori samo o oborini", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 3.5, stationAgeMin: 50, modelCode: 61, echo: echo(10) })).toEqual({ code: 3.5, source: "station" });
    expect(judgeCurrentCode({ ...base, stationCode: 63, stationAgeMin: 30, cloudCover: 50, echo: echo(10) })).toEqual({ code: 2, source: "radar" });
  });

  it("magla s postaje ostaje — radar je ne vidi", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 45, stationAgeMin: 100, echo: echo(null) })).toEqual({ code: 45, source: "station" });
  });

  it("bez tvrdnje o oborini se ništa ne mijenja (radar ne izmišlja ni suho)", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 1, stationAgeMin: 40, echo: echo(5) })).toEqual({ code: 1, source: "station" });
    expect(judgeCurrentCode({ ...base, modelCode: 2, echo: echo(null) })).toEqual({ code: 2, source: "model" });
  });
});

describe("pravilo 2 — PODIZANJE (≥ 42 dBZ): jaka jezgra je oborina", () => {
  it("Verona 14:10: model kaže 'rosulja' (61) uz 0 mm, oba radara 47 dBZ → JAKA KIŠA", () => {
    expect(judgeCurrentCode({ ...base, modelCode: 61, temp: 20.6, echo: echo(47) })).toEqual({ code: 65, source: "radar" });
  });

  it("Zadar 12:10: 53 dBZ + postaja javlja grmljavinu (10 min) → GRMLJAVINA", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 10, echo: echo(53) })).toEqual({ code: 95, source: "radar" });
  });

  it("grmljavina samo uz drugi izvor: model 95 → 95; nitko → jaka kiša (munje radar ne vidi)", () => {
    expect(judgeCurrentCode({ ...base, modelCode: 95, echo: echo(50) })).toEqual({ code: 95, source: "radar" });
    expect(judgeCurrentCode({ ...base, modelCode: 3, echo: echo(50) })).toEqual({ code: 65, source: "radar" });
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 120, echo: echo(50) })).toEqual({ code: 65, source: "radar" });
  });

  it("Quistello 14:40: 60 dBZ, model tvrdi 'slabu kišu' (61) → GRMLJAVINA (kišomjeri u okolici: 6.4 mm/10min)", () => {
    expect(judgeCurrentCode({ ...base, modelCode: 61, temp: 20.9, echo: echo(60) })).toEqual({ code: 95, source: "radar" });
  });

  it("Verona 14:40: 55 dBZ je granica grmljavine — 54 je još samo jaka kiša", () => {
    expect(DBZ_STORM).toBe(55);
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(55) })).toEqual({ code: 95, source: "radar" });
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(54) })).toEqual({ code: 65, source: "radar" });
  });

  it("konvektivna jezgra je grmljavina i kad postaja kaže samo 'oblačno'", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 3, stationAgeMin: 40, echo: echo(58) })).toEqual({ code: 95, source: "radar" });
  });

  it("Zagreb 13:20: 45 dBZ, postaja iz 12:00 kaže oblačno → JAKA KIŠA (radar vidi, postaja još ne)", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 3, stationAgeMin: 80, echo: echo(45) })).toEqual({ code: 65, source: "radar" });
  });

  it("ispod 1 °C jezgra je snijeg", () => {
    expect(judgeCurrentCode({ ...base, temp: 0, echo: echo(45) })).toEqual({ code: 75, source: "radar" });
  });
});

describe("pravilo 3 — IZMEĐU (20–42): radar ne zna, ne dira", () => {
  it("Sisak 13:00: 32 dBZ, postaja 'potpuno oblačno' → ostaje oblačno (radar ne izmišlja kišu)", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 3, stationAgeMin: 40, echo: echo(32) })).toEqual({ code: 3, source: "station" });
  });

  it("Zadar 12:30: 34 dBZ, postaja grmljavina (30 min) → ostaje grmljavina dok ne padne pod 20", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 30, echo: echo(34) })).toEqual({ code: 95, source: "station" });
  });

  it("model kaže kiša, radar 27 → kiša ostaje (može biti slaba kiša koju radar jedva vidi)", () => {
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(27) })).toEqual({ code: 61, source: "model" });
  });

  it("granice: 19 obara, 20 ne; 41 ne diže, 42 diže", () => {
    expect(DBZ_DRY).toBe(20);
    expect(DBZ_HEAVY).toBe(42);
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(19) }).code).toBe(3);
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(20) }).code).toBe(61);
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(41) }).code).toBe(61);
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(42) }).code).toBe(65);
  });
});

describe("kad radar šuti: nema okvira, star okvir, nepokriveno", () => {
  it("star okvir (> 20 min) → postaja kao do sada", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 30, echo: echo(10, 25) })).toEqual({ code: 95, source: "station" });
  });

  it("nepokriveno (Kijev, Ankara): prazna pločica NIJE 'ne pada' → model", () => {
    expect(judgeCurrentCode({ ...base, covered: false, modelCode: 61, echo: echo(null) })).toEqual({ code: 61, source: "model" });
    expect(judgeCurrentCode({ ...base, covered: undefined, modelCode: 61, echo: echo(null) })).toEqual({ code: 61, source: "model" });
  });

  it("oborina s postaje starija od 90 min bez radara pada na MODEL — grmljavina ne traje tri sata", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 91, modelCode: 3 })).toEqual({ code: 3, source: "model" });
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 89, modelCode: 3 })).toEqual({ code: 95, source: "station" });
  });

  it("naoblaka s postaje nema rok trajanja", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 3.5, stationAgeMin: 170 })).toEqual({ code: 3.5, source: "station" });
  });

  it("bez postaje i bez radara ostaje model", () => {
    expect(judgeCurrentCode({ ...base, covered: undefined, modelCode: 80 })).toEqual({ code: 80, source: "model" });
  });
});

describe("cloudCodeFromCover — pet razreda, uključivo 3.5", () => {
  it("granice", () => {
    expect([0, 12, 13, 37, 38, 62, 63, 87, 88, 100].map(cloudCodeFromCover)).toEqual([0, 0, 1, 1, 2, 2, 3.5, 3.5, 3, 3]);
  });
});

describe("stationAgeMinutes — DHMZ termin je LOKALNI sat", () => {
  it("'10.09.2026. 12:00' u 13:24 je 84 min", () => {
    expect(stationAgeMinutes("10.09.2026. 12:00", NOW)).toBe(84);
  });

  it("nepoznat oblik = beskonačno staro (radije model nego stara oborina)", () => {
    expect(stationAgeMinutes(undefined, NOW)).toBe(Infinity);
    expect(stationAgeMinutes("", NOW)).toBe(Infinity);
    expect(stationAgeMinutes("jučer", NOW)).toBe(Infinity);
  });
});

/*
 * HEROJ NE SMIJE ODSTUPATI OD MJERENJA (Markov zahtjev, 10.9.2026.:
 * „pazi da se to ubuduće ne događa, da ne odstupa od mjerenja i da ne
 * pokazuje krivo na heroju").
 *
 * Radar je 10.9. dobio pravo presuditi oborinu, i time je nastala nova
 * opasnost: da počne obarati i ono što postaja MJERI o nebu. Ove
 * provjere zaključavaju granicu — mjereno nebo najbliže postaje
 * pobjeđuje model u svakom stanju radara, a radar ga smije nadglasati
 * SAMO jakom jezgrom (>= 42 dBZ), koja je fizički oborina.
 */
describe("mjereno nebo se ne smije izgubiti ni u jednom stanju radara", () => {
  const nowMs = new Date(2026, 8, 10, 15, 15).getTime();
  const judge = (over: Partial<JudgeInput> = {}): Judged =>
    judgeCurrentCode({
      stationCode: 3.5,
      stationAgeMin: 15,
      modelCode: 3,
      cloudCover: 99,
      temp: 24.8,
      echo: { maxDbz: null, frameTime: nowMs / 1000 - 13 * 60, radiusKm: 5, echoPixels: 0 },
      covered: true,
      nowMs,
      ...over,
    });

  it("prazan radar ne dira mjereno pretezno oblacno (Zadar 10.9. 15:15)", () => {
    expect(judge()).toEqual({ code: 3.5, source: "station" });
  });

  it("slab odjek (20–42) ne dira mjereno nebo — tu radar ne zna", () => {
    expect(judge({ echo: { maxDbz: 30, frameTime: nowMs / 1000 - 5 * 60, radiusKm: 5, echoPixels: 40 } })).toEqual({
      code: 3.5,
      source: "station",
    });
  });

  it("nepokriveno i bez radara ostavljaju mjereno nebo", () => {
    expect(judge({ covered: false })).toEqual({ code: 3.5, source: "station" });
    expect(judge({ echo: undefined })).toEqual({ code: 3.5, source: "station" });
  });

  it("SAMO jaka jezgra (>= 42 dBZ) smije nadglasati mjereno nebo", () => {
    const j = judge({ echo: { maxDbz: 45, frameTime: nowMs / 1000 - 2 * 60, radiusKm: 5, echoPixels: 60 } });
    expect(j).toEqual({ code: 65, source: "radar" });
  });
});
