import type { RadarEcho } from "@/api/radarSample";
import type { JudgeInput, Judged } from "@/utils/radarJudge";
import {
  DBZ_CERTAIN,
  DBZ_DRY,
  DBZ_HEAVY,
  DBZ_STORM,
  STATION_PRECIP_RANGE_KM,
  WIDE_ECHO_PCT,
  STATION_TRUSTED_AGE_MIN,
  cloudCodeFromCover,
  isPrecip,
  judgeCurrentCode,
  precipCodeFromDbz,
  rainRateFromDbz,
  stationAgeMinutes,
} from "@/utils/radarJudge";

/**
 * Sudac za `current.code` — slučajevi su STVARNI, s uređaja i iz mjerenja
 * (Zadar, Zagreb, Crikvenica, Polača, Verona, Quistello). Kad se pragovi
 * mijenjaju, ovi slučajevi moraju i dalje davati ono što je izmjereno na
 * tlu.
 */

const NOW = new Date(2026, 8, 10, 13, 24).getTime(); // 10.9.2026. 13:24 lokalno
// Zadano je ŠIROKO polje (100/100 = 100 % kruga) — dakle prava oborina.
// Uska jezgra se traži izricito preko .
const echo = (maxDbz: number | null, ageMin = 4): RadarEcho => ({
  maxDbz,
  frameTime: NOW / 1000 - ageMin * 60,
  radiusKm: 3,
  echoPixels: maxDbz === null ? 0 : 100,
  coverPixels: 100,
});

/** Uska jezgra: jak odjek na malom dijelu kruga (Metkovic 11.9.). */
const core = (maxDbz: number, pct: number, ageMin = 4): RadarEcho => ({
  maxDbz,
  frameTime: NOW / 1000 - ageMin * 60,
  radiusKm: 3,
  echoPixels: pct,
  coverPixels: 100,
});
const base = { modelCode: 3, cloudCover: 100, temp: 23.9, nowMs: NOW, covered: true, stationDistanceKm: 2.3 };

/*
 * ZADAR 11.9.2026. — KVAR ZBOG KOJEG JE SUDAC PREPISAN.
 *
 * Markov nalaz kroz prozor: „u Zadru u appu pokazuje oblačno, a vani kiša
 * lije". Izmjereno u tom trenutku (RainViewer, 5 km oko točke):
 *     07:30  33 dBZ,  07:40  39 dBZ,  07:50  37 dBZ
 * Postaja Zadar-aerodrom je 10.8 km u unutrašnjosti, termin 07:00 —
 * SNIMLJEN PRIJE PRVE KAPI — i javlja „pretežno oblačno" (3.5).
 * Model ECMWF: kod 1, 0 mm.
 *
 * Stari sudac je sva tri okvira bacio jer su pala u mrtvu zonu 20–42.
 */
describe("Zadar 11.9.2026. — obična kiša koju je stari sudac bacao", () => {
  const nowMs = new Date(2026, 8, 11, 7, 56).getTime();
  const zadar = (dbz: number, frameMinAgo: number): JudgeInput => ({
    stationCode: 3.5, // „pretežno oblačno" sa Zemunika
    stationAgeMin: 56, // termin 07:00
    modelCode: 1, // ECMWF „pretežno vedro", 0 mm
    cloudCover: 42,
    temp: 20.6,
    echo: { maxDbz: dbz, frameTime: nowMs / 1000 - frameMinAgo * 60, radiusKm: 5, echoPixels: 141, coverPixels: 100 },
    covered: true,
    nowMs,
  });

  // Okvir se gleda onako kako ga app vidi U TOM TRENUTKU: najsvježiji je
  // star ~6 min. Stariji okviri ovdje stoje s dobi kakvu su imali dok su
  // bili najsvježiji — inače bi ih `RADAR_MAX_AGE_MIN` (20) odbacio, što
  // je i sam test prvo pogrešno tvrdio.
  it("07:30 — 33 dBZ: KIŠA, ne oblačno", () => {
    expect(judgeCurrentCode(zadar(33, 6))).toEqual({ code: 63, source: "radar" });
  });

  it("07:40 — 39 dBZ: KIŠA", () => {
    expect(judgeCurrentCode(zadar(39, 6))).toEqual({ code: 63, source: "radar" });
  });

  it("08:00 — 38 dBZ i odjek RASTE (169 px): još pada", () => {
    expect(judgeCurrentCode(zadar(38, 6))).toEqual({ code: 63, source: "radar" });
  });

  it("okvir stariji od 20 min se ne uzima — radar tada šuti i vodi postaja", () => {
    expect(judgeCurrentCode(zadar(33, 26))).toEqual({ code: 3.5, source: "station" });
  });

  it("07:50 — 37 dBZ: KIŠA (prag sigurnosti; nijedna suha postaja nije prešla 37)", () => {
    expect(judgeCurrentCode(zadar(37, 6))).toEqual({ code: 63, source: "radar" });
  });

  it("jezgra nad Ugljanom (48 dBZ) je JAKA kiša", () => {
    expect(judgeCurrentCode(zadar(48, 6))).toEqual({ code: 65, source: "radar" });
  });

  it("Zemunik sam (22 dBZ) uz SVJEŽU postaju ostaje oblačno — clutter se ne proglašava kišom", () => {
    expect(judgeCurrentCode({ ...zadar(22, 6), stationAgeMin: 20 })).toEqual({ code: 3.5, source: "station" });
  });
});

/*
 * ZADAR 08:20 — KIŠA JE STALA, A POSTAJA JE JOŠ DRŽI.
 *
 * Drugi Markov nalaz istog jutra: „nakon što je kiša stala nama piše da
 * još pada". Izmjereno:
 *   postaja Zadar (Puntamika, 2.3 km), termin 08:00: „jaka kiša" (63)
 *   radar nad istom točkom:  08:00  38 dBZ → 08:10  17 → 08:20  17
 * Kiša je stala u ~08:05. Sa starim rokom od 90 min app bi tvrdila jaku
 * kišu do 09:30.
 */
describe("Zadar 11.9.2026. 08:20 — kiša je stala prije 15 min", () => {
  const nowMs = new Date(2026, 8, 11, 8, 25).getTime();
  const posteRain = (dbz: number, stationAgeMin: number): JudgeInput => ({
    stationCode: 63, // „jaka kiša" iz termina 08:00
    stationAgeMin,
    stationDistanceKm: 2.3, // postaja Zadar/Puntamika
    modelCode: 51,
    cloudCover: 46,
    temp: 22,
    echo: { maxDbz: dbz, frameTime: nowMs / 1000 - 5 * 60, radiusKm: 3, echoPixels: 32, coverPixels: 100 },
    covered: true,
    nowMs,
  });

  it("radar 17 dBZ obara postajinu 'jaku kišu' — ne pada više", () => {
    const j = judgeCurrentCode(posteRain(17, 25));
    expect(isPrecip(j.code)).toBe(false);
  });

  it("dok je kiša TRAJALA (38 dBZ) postaja i radar se slažu i vrsta ostaje postajina", () => {
    expect(judgeCurrentCode(posteRain(38, 10))).toEqual({ code: 63, source: "station" });
  });

  it("bez radara tvrdnja pada nakon 25 min, ne nakon 90", () => {
    const noRadar = { ...posteRain(17, 30), echo: undefined, covered: undefined };
    expect(judgeCurrentCode(noRadar).source).toBe("model");
  });
});

/*
 * DALEKA POSTAJA NE GOVORI O TVOJOJ KIŠI (11.9.2026.).
 *
 * U istom terminu 08:00: Zadar (2.3 km) „jaka kiša", Zadar-aerodrom
 * (10.8 km, Zemunik) „pretežno oblačno". Oba su točna — kiša je zakrpasta.
 */
describe("domet postaje za oborinu", () => {
  it("postaja na 10.8 km ne smije TVRDITI oborinu — vodi model", () => {
    const far = { ...base, stationCode: 63, stationAgeMin: 10, stationDistanceKm: 10.8, modelCode: 3, echo: undefined, covered: undefined };
    expect(judgeCurrentCode(far)).toEqual({ code: 3, source: "model" });
  });

  it("postaja na 10.8 km ne smije ni OBORITI radar koji vidi kišu", () => {
    const far = { ...base, stationCode: 3, stationAgeMin: 5, stationDistanceKm: 10.8, echo: echo(25) };
    expect(judgeCurrentCode(far)).toEqual({ code: 61, source: "radar" });
  });

  it("ali BLISKA postaja (2.3 km) i dalje smije oboje", () => {
    const near = { ...base, stationCode: 63, stationAgeMin: 10, stationDistanceKm: 2.3, echo: echo(30) };
    expect(judgeCurrentCode(near)).toEqual({ code: 63, source: "station" });
  });

  it("granica je 8 km", () => {
    expect(STATION_PRECIP_RANGE_KM).toBe(8);
    const at = (km: number) => judgeCurrentCode({ ...base, stationCode: 3, stationAgeMin: 5, stationDistanceKm: km, echo: echo(25) });
    expect(at(8)).toEqual({ code: 3, source: "station" });
    expect(at(8.1)).toEqual({ code: 61, source: "radar" });
  });

  it("nebo s daleke postaje i dalje vrijedi — samo oborina ima domet", () => {
    const far = { ...base, stationCode: 3.5, stationAgeMin: 10, stationDistanceKm: 10.8, echo: echo(null) };
    expect(judgeCurrentCode(far)).toEqual({ code: 3.5, source: "station" });
  });
});

/*
 * NEBO vs TLO (11.9.2026.) — Markov nalaz „po kamerama uživo kiše tamo
 * nema", a app je za Metković pisala JAKU KIŠU.
 *
 * Izmjereno nad Metkovićem kroz okvire (polumjer 3 km):
 *   08:20  30 dBZ ( 8 %)   08:30  45 (18 %)   08:40  24 ( 6 %)
 *   08:50  49 dBZ (49 %)   09:00  39 (71 %)   09:10  BEZ ODJEKA
 * Postaja Ploče (16.7 km) u isto vrijeme: „grmljavina BEZ OBORINA".
 *
 * Nad Korenicom u isto vrijeme (Marko: „Korenica još pada"):
 *   08:30–09:00  29–37 dBZ na 100 % kruga, stabilno pola sata.
 */
describe("jezgra u oblaku NIJE kiša na tlu", () => {
  it("Metković 08:30: 45 dBZ na 18 % kruga, prije bez odjeka → NE tvrdi jaku kišu", () => {
    const j = judgeCurrentCode({
      ...base,
      stationCode: undefined,
      stationAgeMin: Infinity,
      stationDistanceKm: undefined,
      modelCode: 80,
      temp: 25.9,
      echo: core(45, 18),
      prevEcho: echo(null),
    });
    expect(j.code).not.toBe(65);
    expect(j.source).toBe("model");
  });

  it("Metković: uz postaju koja svjedoči grmljavinu piše GRMLJAVINA, ne jaka kiša", () => {
    // DHMZ „grmljavina bez oborina" → kod 95. Postaja i radar se slažu da
    // je nad mjestom grmljavinski oblak, pa kod ostaje 95 — a NE 65
    // („jaka kiša"), što je bio kvar. Izvor je „radar" jer jaka jezgra uz
    // potvrdu postaje ide kroz grmljavinsko pravilo; kod je ono što
    // korisnik vidi i on je točan.
    const j = judgeCurrentCode({
      ...base,
      stationCode: 95,
      stationAgeMin: 15,
      stationDistanceKm: 6,
      modelCode: 80,
      echo: core(45, 18),
      prevEcho: echo(null),
    });
    expect(j.code).toBe(95);
    expect(j.code).not.toBe(65);
  });

  it("ŠIROKO polje prolazi i bez prethodnog okvira — Korenica (100 % kruga)", () => {
    const j = judgeCurrentCode({
      ...base,
      stationCode: undefined,
      stationAgeMin: Infinity,
      stationDistanceKm: undefined,
      modelCode: 51,
      temp: 13.4,
      echo: echo(41), // 100 % kruga
      prevEcho: echo(null),
    });
    expect(j).toEqual({ code: 65, source: "radar" });
  });

  it("POSTOJANA jezgra prolazi i kad je uska — bila je i prije 10 min", () => {
    const j = judgeCurrentCode({
      ...base,
      stationCode: undefined,
      stationAgeMin: Infinity,
      stationDistanceKm: undefined,
      modelCode: 3,
      echo: core(45, 18),
      prevEcho: core(38, 15),
    });
    expect(j).toEqual({ code: 65, source: "radar" });
  });

  it("granica pokrivenosti je 40 %", () => {
    expect(WIDE_ECHO_PCT).toBe(40);
    const at = (pct: number) =>
      judgeCurrentCode({
        ...base,
        stationCode: undefined,
        stationAgeMin: Infinity,
        stationDistanceKm: undefined,
        modelCode: 3,
        echo: core(45, pct),
        prevEcho: echo(null),
      });
    expect(at(40).source).toBe("radar");
    expect(at(39).source).toBe("model");
  });

  it("bez prethodnog okvira se postojanost NE traži — kiša koja počinje ne smije propasti", () => {
    // Zadar 07:30 je bio PRVI okvir s odjekom; da se tražila potvrda iz
    // prošlosti, app bi propustila početak kiše.
    const j = judgeCurrentCode({
      ...base,
      stationCode: undefined,
      stationAgeMin: Infinity,
      stationDistanceKm: undefined,
      modelCode: 1,
      echo: core(45, 18),
      prevEcho: undefined,
    });
    expect(j).toEqual({ code: 65, source: "radar" });
  });

  it("SLABA i umjerena oborina ne traže ništa od ovoga — prag je samo za JAKU", () => {
    const j = judgeCurrentCode({
      ...base,
      stationCode: undefined,
      stationAgeMin: Infinity,
      stationDistanceKm: undefined,
      modelCode: 1,
      echo: core(33, 8),
      prevEcho: echo(null),
    });
    expect(j).toEqual({ code: 63, source: "radar" });
  });

  it("konvektivna jezgra (>= 55) ostaje grmljavina bez obzira na pokrivenost", () => {
    const j = judgeCurrentCode({
      ...base,
      stationCode: undefined,
      stationAgeMin: Infinity,
      stationDistanceKm: undefined,
      modelCode: 3,
      echo: core(58, 10),
      prevEcho: echo(null),
    });
    expect(j).toEqual({ code: 95, source: "radar" });
  });
});

describe("SUHO (< 20 dBZ): tko god tvrdi oborinu, u krivu je", () => {
  it("Zadar 13:20: 12 dBZ, postaja iz 12:00 još kaže grmljavina → OBLAČNO", () => {
    // Tvrdnja o grmljavini je istekla (80 > 25 min) prije nego radar dodje
    // na red, pa kod dolazi iz modela — isti kod 3, posten izvor.
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 80, echo: echo(12), cloudCover: 100 })).toEqual({ code: 3, source: "model" });
  });

  it("Crikvenica 13:30: postaja javlja samo vjetar, model kaže kiša (61) uz 0 mm, radar prazan → oblačno", () => {
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(null) })).toEqual({ code: 3, source: "radar" });
  });

  it("Polača 14:00: RainViewer 17 dBZ, model kaže kiša → oblačno (LibreWXR je tu lagao 42)", () => {
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(17) })).toEqual({ code: 3, source: "radar" });
  });

  it("Ogulin/Pazin: model halucinira grmljavinu s tučom (96), radar prazan, postaja oblačno → oblačno s postaje", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 3, stationAgeMin: 50, modelCode: 96, echo: echo(null) })).toEqual({ code: 3, source: "station" });
  });

  it("nebo iz postaje kad ga postaja ima; iz modela (naoblaka %) kad postaja govori samo o oborini", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 3.5, stationAgeMin: 50, modelCode: 61, echo: echo(10) })).toEqual({ code: 3.5, source: "station" });
    // Postaja tvrdi kisu, ali joj je tvrdnja istekla (30 > 25) -> model (3).
    expect(judgeCurrentCode({ ...base, stationCode: 63, stationAgeMin: 30, cloudCover: 50, echo: echo(10) })).toEqual({ code: 3, source: "model" });
    // Dok je tvrdnja svjeza, radar je obara i nebo dolazi iz naoblake.
    expect(judgeCurrentCode({ ...base, stationCode: 63, stationAgeMin: 15, cloudCover: 50, echo: echo(10) })).toEqual({ code: 2, source: "radar" });
  });

  it("magla s postaje ostaje — radar je ne vidi", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 45, stationAgeMin: 100, echo: echo(null) })).toEqual({ code: 45, source: "station" });
  });

  it("bez tvrdnje o oborini se ništa ne mijenja (radar ne izmišlja ni suho)", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 1, stationAgeMin: 40, echo: echo(5) })).toEqual({ code: 1, source: "station" });
    expect(judgeCurrentCode({ ...base, modelCode: 2, echo: echo(null) })).toEqual({ code: 2, source: "model" });
  });
});

describe("OBORINA KROZ CIJELI RASPON — radar više nema mrtvu zonu", () => {
  it("svaka vrijednost od 20 naviše daje kod, kad postaja ne svjedoči protiv", () => {
    const stale = { ...base, stationAgeMin: 200 }; // postaja prestara da bi znala
    expect(judgeCurrentCode({ ...stale, echo: echo(20) })).toEqual({ code: 61, source: "radar" });
    expect(judgeCurrentCode({ ...stale, echo: echo(25) })).toEqual({ code: 61, source: "radar" });
    expect(judgeCurrentCode({ ...stale, echo: echo(28) })).toEqual({ code: 63, source: "radar" });
    expect(judgeCurrentCode({ ...stale, echo: echo(35) })).toEqual({ code: 63, source: "radar" });
    expect(judgeCurrentCode({ ...stale, echo: echo(40) })).toEqual({ code: 65, source: "radar" });
    expect(judgeCurrentCode({ ...stale, echo: echo(50) })).toEqual({ code: 65, source: "radar" });
  });

  it("SVJEŽA BLISKA postaja smije oboriti radar ISPOD praga sigurnosti (clutter)", () => {
    const fresh = { ...base, stationCode: 3, stationAgeMin: 15 };
    expect(judgeCurrentCode({ ...fresh, echo: echo(22) })).toEqual({ code: 3, source: "station" });
    expect(judgeCurrentCode({ ...fresh, echo: echo(27) })).toEqual({ code: 3, source: "station" });
  });

  it("iznad praga sigurnosti (28) radar vodi i protiv svježe postaje", () => {
    expect(DBZ_CERTAIN).toBe(28);
    const fresh = { ...base, stationCode: 3, stationAgeMin: 10 };
    expect(judgeCurrentCode({ ...fresh, echo: echo(28) })).toEqual({ code: 63, source: "radar" });
    expect(judgeCurrentCode({ ...fresh, echo: echo(27) })).toEqual({ code: 3, source: "station" });
  });

  it("STARA postaja ne smije oboriti radar ni ispod praga — nije mogla vidjeti tu kišu", () => {
    expect(STATION_TRUSTED_AGE_MIN).toBe(20);
    const s = (ageMin: number) => judgeCurrentCode({ ...base, stationCode: 3, stationAgeMin: ageMin, echo: echo(25) });
    expect(s(20)).toEqual({ code: 3, source: "station" });
    expect(s(21)).toEqual({ code: 61, source: "radar" });
  });

  it("kad se postaja i radar SLAŽU da pada, vrsta ostaje postajina (ona zna susnježicu i ledenu kišu)", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 66, stationAgeMin: 15, echo: echo(30) })).toEqual({ code: 66, source: "station" });
    expect(judgeCurrentCode({ ...base, stationCode: 85, stationAgeMin: 15, echo: echo(33) })).toEqual({ code: 85, source: "station" });
  });

  it("ali PRESTARA tvrdnja o oborini pada na radarov kod", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 26, echo: echo(30) })).toEqual({ code: 63, source: "radar" });
  });

  it("model se ne pita kad radar vidi oborinu, a postaje nema", () => {
    expect(judgeCurrentCode({ ...base, modelCode: 1, echo: echo(33) })).toEqual({ code: 63, source: "radar" });
  });
});

describe("PODIZANJE i grmljavina", () => {
  it("Verona 14:10: model kaže rosulju (61) uz 0 mm, oba radara 47 dBZ → JAKA KIŠA", () => {
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

  it("Quistello 14:40: 60 dBZ, model tvrdi slabu kišu (61) → GRMLJAVINA (kišomjeri: 6.4 mm/10min)", () => {
    expect(judgeCurrentCode({ ...base, modelCode: 61, temp: 20.9, echo: echo(60) })).toEqual({ code: 95, source: "radar" });
  });

  it("Verona 14:40: 55 dBZ je granica grmljavine — 54 je još samo jaka kiša", () => {
    expect(DBZ_STORM).toBe(55);
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(55) })).toEqual({ code: 95, source: "radar" });
    expect(judgeCurrentCode({ ...base, modelCode: 61, echo: echo(54) })).toEqual({ code: 65, source: "radar" });
  });

  it("konvektivna jezgra je grmljavina i kad postaja kaže samo oblačno", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 3, stationAgeMin: 40, echo: echo(58) })).toEqual({ code: 95, source: "radar" });
  });

  it("Zagreb 13:20: 45 dBZ, postaja iz 12:00 kaže oblačno → JAKA KIŠA (radar vidi, postaja još ne)", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 3, stationAgeMin: 80, echo: echo(45) })).toEqual({ code: 65, source: "radar" });
  });

  it("ispod 1 °C jezgra je snijeg, kroz sve jačine", () => {
    const cold = { ...base, temp: 0, stationAgeMin: 200 };
    expect(judgeCurrentCode({ ...cold, echo: echo(25) })).toEqual({ code: 71, source: "radar" });
    expect(judgeCurrentCode({ ...cold, echo: echo(33) })).toEqual({ code: 73, source: "radar" });
    expect(judgeCurrentCode({ ...cold, echo: echo(45) })).toEqual({ code: 75, source: "radar" });
  });
});

describe("granice pragova", () => {
  it("19 obara, 20 već govori; 40 je jaka", () => {
    expect(DBZ_DRY).toBe(20);
    expect(DBZ_HEAVY).toBe(40);
    const stale = { ...base, modelCode: 61, stationAgeMin: 200 };
    expect(judgeCurrentCode({ ...stale, echo: echo(19) }).code).toBe(3);
    expect(judgeCurrentCode({ ...stale, echo: echo(20) }).code).toBe(61);
    expect(judgeCurrentCode({ ...stale, echo: echo(39) }).code).toBe(63);
    expect(judgeCurrentCode({ ...stale, echo: echo(40) }).code).toBe(65);
  });
});

describe("kad radar šuti: nema okvira, star okvir, nepokriveno", () => {
  it("star okvir (> 20 min) → postaja kao do sada, dok joj tvrdnja nije istekla", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 20, echo: echo(10, 25) })).toEqual({ code: 95, source: "station" });
  });

  it("nepokriveno (Kijev, Ankara): prazna pločica NIJE ne pada → model", () => {
    expect(judgeCurrentCode({ ...base, covered: false, modelCode: 61, echo: echo(null) })).toEqual({ code: 61, source: "model" });
    expect(judgeCurrentCode({ ...base, covered: undefined, modelCode: 61, echo: echo(null) })).toEqual({ code: 61, source: "model" });
  });

  it("oborina s postaje starija od 25 min bez radara pada na MODEL — kisa ne traje sat i pol", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 26, modelCode: 3 })).toEqual({ code: 3, source: "model" });
    expect(judgeCurrentCode({ ...base, stationCode: 95, stationAgeMin: 24, modelCode: 3 })).toEqual({ code: 95, source: "station" });
  });

  it("naoblaka s postaje nema rok trajanja", () => {
    expect(judgeCurrentCode({ ...base, stationCode: 3.5, stationAgeMin: 170 })).toEqual({ code: 3.5, source: "station" });
  });

  it("bez postaje i bez radara ostaje model", () => {
    expect(judgeCurrentCode({ ...base, covered: undefined, modelCode: 80 })).toEqual({ code: 80, source: "model" });
  });
});

describe("Z–R relacija drži pragove (nitko da ih ne pomakne po osjećaju)", () => {
  it("Marshall-Palmer daje mm/h koji stoje uz pragove", () => {
    expect(rainRateFromDbz(DBZ_DRY)).toBeCloseTo(0.65, 1);
    expect(rainRateFromDbz(DBZ_CERTAIN)).toBeCloseTo(2.05, 1);
    expect(rainRateFromDbz(DBZ_HEAVY)).toBeCloseTo(11.53, 1);
    expect(rainRateFromDbz(DBZ_STORM)).toBeCloseTo(99.85, 0);
  });

  it("prag jake kiše je ondje gdje oborina prelazi 10 mm/h", () => {
    expect(rainRateFromDbz(DBZ_HEAVY - 1)).toBeLessThan(10);
    expect(rainRateFromDbz(DBZ_HEAVY)).toBeGreaterThan(10);
  });

  it("precipCodeFromDbz pokriva raspon bez rupe", () => {
    for (let d = DBZ_DRY; d <= 70; d += 1) {
      expect([61, 63, 65]).toContain(precipCodeFromDbz(d, 20));
      expect([71, 73, 75]).toContain(precipCodeFromDbz(d, 0));
    }
  });
});

describe("cloudCodeFromCover — pet razreda, uključivo 3.5", () => {
  it("granice", () => {
    expect([0, 12, 13, 37, 38, 62, 63, 87, 88, 100].map(cloudCodeFromCover)).toEqual([0, 0, 1, 1, 2, 2, 3.5, 3.5, 3, 3]);
  });
});

describe("stationAgeMinutes — DHMZ termin je LOKALNI sat", () => {
  it("10.09.2026. 12:00 u 13:24 je 84 min", () => {
    expect(stationAgeMinutes("10.09.2026. 12:00", NOW)).toBe(84);
  });

  it("nepoznat oblik = beskonačno staro (radije model nego stara oborina)", () => {
    expect(stationAgeMinutes(undefined, NOW)).toBe(Infinity);
    expect(stationAgeMinutes("", NOW)).toBe(Infinity);
    expect(stationAgeMinutes("jučer", NOW)).toBe(Infinity);
  });
});

/*
 * MJERENO NEBO SE NE SMIJE IZGUBITI (Markov zahtjev 10.9.2026.).
 *
 * Nakon prepisivanja 11.9. granica se pomaknula i to je NAMJERNO: radar
 * sad smije nadglasati mjereno nebo i običnom kišom — ali samo kad je
 * iznad praga sigurnosti (37) ili kad je postaja prestara da bi tu kišu
 * uopće vidjela. Svježa postaja u nesigurnom pojasu i dalje vodi.
 */
describe("mjereno nebo protiv radara — nova granica", () => {
  const nowMs = new Date(2026, 8, 10, 15, 15).getTime();
  const judge = (over: Partial<JudgeInput> = {}): Judged =>
    judgeCurrentCode({
      stationCode: 3.5,
      stationAgeMin: 15,
      modelCode: 3,
      cloudCover: 99,
      temp: 24.8,
      echo: { maxDbz: null, frameTime: nowMs / 1000 - 13 * 60, radiusKm: 5, echoPixels: 0, coverPixels: 100 },
      covered: true,
      nowMs,
      ...over,
    });

  it("prazan radar ne dira mjereno pretezno oblacno (Zadar 10.9. 15:15)", () => {
    expect(judge()).toEqual({ code: 3.5, source: "station" });
  });

  it("SVJEŽA BLISKA postaja drži nebo protiv slabog odjeka (< 28)", () => {
    expect(judge({ echo: { maxDbz: 24, frameTime: nowMs / 1000 - 5 * 60, radiusKm: 3, echoPixels: 40, coverPixels: 100 } })).toEqual({
      code: 3.5,
      source: "station",
    });
  });

  it("nepokriveno i bez radara ostavljaju mjereno nebo", () => {
    expect(judge({ covered: false })).toEqual({ code: 3.5, source: "station" });
    expect(judge({ echo: undefined })).toEqual({ code: 3.5, source: "station" });
  });

  it("odjek >= 28 nadglasa i svježe mjereno nebo — to je Zadar 11.9.", () => {
    expect(judge({ echo: { maxDbz: 28, frameTime: nowMs / 1000 - 2 * 60, radiusKm: 5, echoPixels: 141, coverPixels: 100 } })).toEqual({
      code: 63,
      source: "radar",
    });
  });

  it("jaka jezgra i dalje nadglasa", () => {
    expect(judge({ echo: { maxDbz: 45, frameTime: nowMs / 1000 - 2 * 60, radiusKm: 5, echoPixels: 60, coverPixels: 100 } })).toEqual({
      code: 65,
      source: "radar",
    });
  });
});
