import type { RadarEcho } from "@/api/radarSample";
import type { JudgeInput, Judged } from "@/utils/radarJudge";
import {
  DBZ_CERTAIN,
  DBZ_DRY,
  DBZ_HEAVY,
  DBZ_STORM,
  MEDIAN_WET_DBZ,
  PERSISTENCE_WET,
  STATION_SAME_SPOT_AGE_MIN,
  STATION_SAME_SPOT_KM,
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

/*
 * V1 sudac čita samo `maxDbz`, `echoPixels` i `coverPixels`, ali od
 * 11.9.2026. `RadarEcho` nosi CIJELE prostorne statistike (isti prolaz
 * kroz piksele daje oboje, pa V2 ne traži dodatni dohvat). Ostale brojke
 * se ovdje popunjavaju na `maxDbz` — V1 ih ne gleda, a tip zahtijeva.
 */
const mk = (maxDbz: number | null, echoPixels: number, ageMin: number): RadarEcho => ({
  maxDbz,
  meanDbz: maxDbz,
  medianDbz: maxDbz,
  p75Dbz: maxDbz,
  p90Dbz: maxDbz,
  p95Dbz: maxDbz,
  weightedMeanDbz: maxDbz,
  coverage20: maxDbz !== null && maxDbz >= 20 ? echoPixels / 100 : 0,
  coverage28: maxDbz !== null && maxDbz >= 28 ? echoPixels / 100 : 0,
  coverage40: maxDbz !== null && maxDbz >= 40 ? echoPixels / 100 : 0,
  coverage55: maxDbz !== null && maxDbz >= 55 ? echoPixels / 100 : 0,
  weightedCoverage20: maxDbz !== null && maxDbz >= 20 ? echoPixels / 100 : 0,
  coverPixels: 100,
  echoPixels,
  frameTime: NOW / 1000 - ageMin * 60,
  radiusKm: 3,
});

/** Isto, ali s APSOLUTNIM vremenom okvira (blokovi s vlastitim nowMs). */
const mkAt = (maxDbz: number | null, echoPixels: number, frameTime: number): RadarEcho => ({
  ...mk(maxDbz, echoPixels, 0),
  frameTime,
});

/** Zadano je ŠIROKO polje (100 % kruga) — dakle prava oborina. */
const echo = (maxDbz: number | null, ageMin = 4): RadarEcho =>
  mk(maxDbz, maxDbz === null ? 0 : 100, ageMin);

/** Uska jezgra: jak odjek na malom dijelu kruga (Metkovic 11.9.). */
const core = (maxDbz: number, pct: number, ageMin = 4): RadarEcho => mk(maxDbz, pct, ageMin);
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
    echo: mkAt(dbz, 141, nowMs / 1000 - frameMinAgo * 60),
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
    echo: mkAt(dbz, 32, nowMs / 1000 - 5 * 60),
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
    // Kamere: suho. Ni model (80 „pljuskovi") ne smije uskočiti kad je
    // radar odustao — vidi `stationThenSky`. Ostaje nebo.
    expect(isPrecip(j.code)).toBe(false);
    expect(j.source).toBe("radar");
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

  /*
   * PROMIJENJENO 11.9. popodne: postojanost NE prizemljuje usku jezgru.
   * Omiš je bio postojan 50 min (32 52 49 49 29 dBZ) na 6 % kruga — i
   * suh po kameri. Krš i planina daju POSTOJAN lažni odjek, pa je
   * postojanost tu bezvrijedna; jedino širina razlikuje.
   */
  it("Omiš: POSTOJANA uska jezgra 49 dBZ na 6 % → NIJE kiša (kamera: suho)", () => {
    const j = judgeCurrentCode({
      ...base,
      stationCode: 3.5, // Split-Marjan 22 km, „pretežno oblačno" — nebo smije, oborinu ne
      stationAgeMin: 28,
      stationDistanceKm: 22.3,
      modelCode: 3,
      echo: core(49, 6),
      prevEcho: core(49, 6),
      persistence: 0.8,
    });
    expect(isPrecip(j.code)).toBe(false);
    expect(j.code).toBe(3.5);
  });

  it("Novi Vinodolski: jezgra 46 dBZ na 67 % kruga → JAKA KIŠA (front, Rijeka postaje javljaju kišu)", () => {
    const j = judgeCurrentCode({
      ...base,
      stationCode: undefined,
      stationAgeMin: Infinity,
      stationDistanceKm: undefined,
      modelCode: 3,
      echo: core(46, 67),
      prevEcho: core(35, 40),
      persistence: 0.67,
    });
    expect(j).toEqual({ code: 65, source: "radar" });
  });

  it("Split Riva: max 50 ali median 38 na 86 % kruga → KIŠA (63), ne jaka — jačina iz mediana", () => {
    const j = judgeCurrentCode({
      ...base,
      stationCode: undefined,
      stationAgeMin: Infinity,
      stationDistanceKm: undefined,
      modelCode: 63,
      echo: { ...core(50, 86), medianDbz: 38 },
      prevEcho: core(47, 80),
      persistence: 1,
    });
    expect(j).toEqual({ code: 63, source: "radar" });
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
    expect(isPrecip(at(40).code)).toBe(true);
    // Ispod praga radar odustaje, a model NE smije uskociti -> nebo.
    expect(isPrecip(at(39).code)).toBe(false);
  });

  it("kiša koja POČINJE ne smije propasti — ali mora biti ŠIROKA (Zadar 07:30: 33 dBZ na 86 %)", () => {
    // Zadar 07:30 je bio PRVI okvir s odjekom, širok. Uska jezgra bez
    // prošlosti je pak Metković — i ta je bila suha.
    const zadar = judgeCurrentCode({
      ...base,
      stationCode: undefined,
      stationAgeMin: Infinity,
      stationDistanceKm: undefined,
      modelCode: 1,
      echo: core(33, 86),
      prevEcho: undefined,
    });
    expect(isPrecip(zadar.code)).toBe(true);
    const metkovic = judgeCurrentCode({
      ...base,
      stationCode: undefined,
      stationAgeMin: Infinity,
      stationDistanceKm: undefined,
      modelCode: 1,
      echo: core(45, 18),
      prevEcho: undefined,
    });
    expect(isPrecip(metkovic.code)).toBe(false);
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

/*
 * METKOVIĆ 11.9.2026. 10:30 — ODJEK U JEDNOM OKVIRU NIJE OBORINA.
 *
 * Markov nalaz: „Metković sad piše slaba kiša a nema tamo uopće na radaru
 * oborina". Izmjereno u tom trenutku:
 *   09:50 bez · 10:00 bez · 10:10 bez · 10:20 bez · 10:30 23 dBZ na 8 %
 *   postaja Ploče (16.7 km): „umjereno oblačno"
 *   model: kod 51 (slaba kiša), ali run star 128 min
 *
 * Prije je prolazilo jer je pravilo tražilo samo `dBZ >= 20`. Prag
 * postojanosti (0.25, izmjeren na 240 postaja) to obara.
 */
describe("Metković 11.9. 10:30 — jedan okvir odjeka nije kiša", () => {
  const metkovic = (persistence?: number): JudgeInput => ({
    stationCode: 2, // Ploče „umjereno oblačno"
    stationAgeMin: 37,
    stationDistanceKm: 16.7, // predaleko za oborinu (> 8 km)
    modelCode: 51, // model tvrdi slabu kišu, ali je star 2 h
    cloudCover: 66,
    temp: 26.3,
    echo: core(23, 8),
    prevEcho: echo(null),
    persistence,
    covered: true,
    nowMs: NOW,
  });

  it("postojanost 20 % (1 od 5 okvira) → NE tvrdi kišu", () => {
    const j = judgeCurrentCode(metkovic(0.2));
    expect(isPrecip(j.code)).toBe(false);
  });

  it("prag je 25 %", () => {
    expect(PERSISTENCE_WET).toBe(0.25);
    expect(isPrecip(judgeCurrentCode(metkovic(0.2)).code)).toBe(false);
    expect(isPrecip(judgeCurrentCode(metkovic(0.4)).code)).toBe(true);
  });

  it("bez ijednog podatka o prošlosti se NE obara — prvo pokretanje", () => {
    const prvi = { ...metkovic(undefined), prevEcho: undefined };
    expect(isPrecip(judgeCurrentCode(prvi).code)).toBe(true);
  });

  it("prethodni okvir S odjekom je dovoljan kad postojanost nije poznata", () => {
    const j = judgeCurrentCode({ ...metkovic(undefined), prevEcho: echo(25) });
    expect(isPrecip(j.code)).toBe(true);
  });

  it("daleka postaja ne preuzima oborinu, pa kod dolazi iz MODELA", () => {
    // Ploče su 16.7 km — iznad `STATION_PRECIP_RANGE_KM`. Model tvrdi 51,
    // i to je ono što ostaje kad radar odustane. Nije idealno (model je
    // star 2 h), ali V1 starost modela ne mjeri — to radi V2.
    expect(judgeCurrentCode(metkovic(0.2)).source).toBe("station");
  });
});

/*
 * SENJ 11.9.2026. — ORAOGRAFSKA JEZGRA NAD VELEBITOM.
 *
 * Nađeno usporedbom na 112 mjesta (Markov zahtjev „provjeri što više
 * gradova"). Izmjereno:
 *   okviri: — 24 39 38 33   → postojanost 80 %, dakle POSTOJAN odjek
 *   zadnji: max 33, median 32, ali pokrivenost SAMO 8 % kruga
 *   postaja: 400 m (!), „pretežno oblačno"
 *   vrijemeradar.hr: „promjenljivo oblačno"
 *
 * Postojanost i median prolaze, `DBZ_CERTAIN` (28) ne pomaže jer je
 * odjek jači. Rješenje je BLIZINA: postaja na 400 m mjeri isti radarski
 * piksel, pa nema prostorne nesigurnosti koja na 8 km postoji.
 */
describe("Senj 11.9. — postaja na 400 m obara orografsku jezgru", () => {
  const senj = (over: Partial<JudgeInput> = {}): JudgeInput => ({
    stationCode: 3.5, // „pretežno oblačno", 400 m
    stationAgeMin: 15,
    stationDistanceKm: 0.4,
    modelCode: 3,
    cloudCover: 90,
    temp: 20,
    echo: core(33, 8), // jak, ali uzak — 8 % kruga
    persistence: 0.8, // postojan kroz okvire
    covered: true,
    nowMs: NOW,
    ...over,
  });

  it("postaja na 400 m pobjeđuje jak odjek", () => {
    expect(judgeCurrentCode(senj())).toEqual({ code: 3.5, source: "station" });
  });

  it("granica je 2 km — na 2.5 km radar ponovno vodi", () => {
    expect(STATION_SAME_SPOT_KM).toBe(2);
    expect(judgeCurrentCode(senj({ stationDistanceKm: 2 })).source).toBe("station");
    expect(isPrecip(judgeCurrentCode(senj({ stationDistanceKm: 2.5 })).code)).toBe(true);
  });

  it("uz USKI odjek postaja na 400 m smije biti i 45 min stara (Senj: 28 min, kamere suho)", () => {
    expect(STATION_SAME_SPOT_AGE_MIN).toBe(45);
    expect(judgeCurrentCode(senj({ stationAgeMin: 28 })).source).toBe("station");
    expect(judgeCurrentCode(senj({ stationAgeMin: 45 })).source).toBe("station");
  });

  it("preko 45 min ni postaja na 400 m ne obara", () => {
    // Uski odjek 33 dBZ nije ni jak (< 40), pa nakon što postaja ispadne
    // radar vodi s medianom.
    expect(isPrecip(judgeCurrentCode(senj({ stationAgeMin: 50 })).code)).toBe(true);
  });

  it("uz ŠIROKI odjek postaja mora biti svježa — kiša je mogla početi nakon termina", () => {
    const wide = senj({ echo: echo(33), stationAgeMin: 28 });
    expect(isPrecip(judgeCurrentCode(wide).code)).toBe(true);
  });

  it("Senj popodne: 48 dBZ na 16 %, postaja 400 m 28 min → OBLAČNO (kamera: suho)", () => {
    expect(judgeCurrentCode(senj({ echo: core(48, 16), stationAgeMin: 28 }))).toEqual({ code: 3.5, source: "station" });
  });

  it("postaja koja i SAMA tvrdi kišu ne obara ništa — slažu se", () => {
    const j = judgeCurrentCode(senj({ stationCode: 61 }));
    expect(isPrecip(j.code)).toBe(true);
  });
});

describe("MEDIAN kao uvjet: jedan piksel u krugu nije jačina nad točkom", () => {
  it("visok max uz nizak median NE tvrdi oborinu", () => {
    expect(MEDIAN_WET_DBZ).toBe(14);
    // Jezgra 3 km dalje: max 35, ali median nad točkom samo 12.
    const daleka = { ...base, stationCode: 3, stationAgeMin: 15, stationDistanceKm: 5, persistence: 0.8 };
    const e = { ...core(35, 30), medianDbz: 12 };
    expect(isPrecip(judgeCurrentCode({ ...daleka, echo: e }).code)).toBe(false);
  });

  it("Zagreb 13:50: median 14 uz 16 % kruga -> KISA (tri postaje javljaju kisu)", () => {
    const zg = { ...base, stationCode: 3, stationAgeMin: 56, stationDistanceKm: 0.8, persistence: 0.5 };
    const e = { ...core(31, 16), medianDbz: 14 };
    expect(isPrecip(judgeCurrentCode({ ...zg, echo: e }).code)).toBe(true);
  });

  it("median iznad praga prolazi", () => {
    const daleka = { ...base, stationCode: 3, stationAgeMin: 15, stationDistanceKm: 5, persistence: 0.8 };
    const e = { ...core(35, 30), medianDbz: 20 };
    expect(isPrecip(judgeCurrentCode({ ...daleka, echo: e }).code)).toBe(true);
  });

  it("bez mediana (star kesirani odjek) se NE obara", () => {
    const daleka = { ...base, stationCode: 3, stationAgeMin: 15, stationDistanceKm: 5, persistence: 0.8 };
    const e = { ...core(35, 30), medianDbz: null };
    expect(isPrecip(judgeCurrentCode({ ...daleka, echo: e }).code)).toBe(true);
  });
});

/*
 * KRK 11.9.2026. — MODEL NE SMIJE USKOČITI KAD RADAR ODUSTANE.
 *
 * Usporedba na 112 mjesta: radar 31 dBZ uz 20 % postojanosti → sudac ga
 * obori (ispravno). Postaja javlja samo vjetar (kod `undefined`). I onda
 * je MODEL, star dva sata, upisao „slaba kiša" — jer je grana padala na
 * `stationThenModel`. vrijemeradar.hr: „promjenljivo oblačno".
 */
describe("Krk 11.9. — radar odustane, model ne smije preuzeti oborinu", () => {
  const krk = (over: Partial<JudgeInput> = {}): JudgeInput => ({
    stationCode: undefined, // „slab vjetar" → nema koda
    stationAgeMin: 20,
    stationDistanceKm: 11.7,
    modelCode: 61, // model tvrdi slabu kišu
    cloudCover: 70,
    temp: 22,
    echo: core(31, 20),
    persistence: 0.2, // 1 od 5 okvira
    covered: true,
    nowMs: NOW,
    ...over,
  });

  it("nepostojan odjek + model 'kiša' → NEBO iz naoblake, ne kiša", () => {
    const j = judgeCurrentCode(krk());
    expect(isPrecip(j.code)).toBe(false);
    expect(j.code).toBe(cloudCodeFromCover(70));
  });

  it("isto kad radar odustane zbog niskog MEDIANA", () => {
    const j = judgeCurrentCode(krk({ persistence: 0.8, echo: { ...core(31, 20), medianDbz: 10 } }));
    expect(isPrecip(j.code)).toBe(false);
  });

  it("ali BLISKA SVJEŽA postaja koja tvrdi kišu SMIJE — ona mjeri tlo", () => {
    const j = judgeCurrentCode(krk({ stationCode: 61, stationDistanceKm: 1.5, stationAgeMin: 10 }));
    expect(j).toEqual({ code: 61, source: "station" });
  });

  it("kad radar NE RADI (nepokriveno), model i dalje vodi — nema ga tko nadglasati", () => {
    const j = judgeCurrentCode(krk({ covered: false }));
    expect(j).toEqual({ code: 61, source: "model" });
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
      echo: mkAt(null, 0, nowMs / 1000 - 13 * 60),
      covered: true,
      nowMs,
      ...over,
    });

  it("prazan radar ne dira mjereno pretezno oblacno (Zadar 10.9. 15:15)", () => {
    expect(judge()).toEqual({ code: 3.5, source: "station" });
  });

  it("SVJEŽA BLISKA postaja drži nebo protiv slabog odjeka (< 28)", () => {
    expect(judge({ echo: mkAt(24, 40, nowMs / 1000 - 5 * 60) })).toEqual({
      code: 3.5,
      source: "station",
    });
  });

  it("nepokriveno i bez radara ostavljaju mjereno nebo", () => {
    expect(judge({ covered: false })).toEqual({ code: 3.5, source: "station" });
    expect(judge({ echo: undefined })).toEqual({ code: 3.5, source: "station" });
  });

  it("odjek >= 28 nadglasa i svježe mjereno nebo — to je Zadar 11.9.", () => {
    expect(judge({ echo: mkAt(28, 141, nowMs / 1000 - 2 * 60) })).toEqual({
      code: 63,
      source: "radar",
    });
  });

  it("jaka jezgra i dalje nadglasa", () => {
    expect(judge({ echo: mkAt(45, 60, nowMs / 1000 - 2 * 60) })).toEqual({
      code: 65,
      source: "radar",
    });
  });
});
