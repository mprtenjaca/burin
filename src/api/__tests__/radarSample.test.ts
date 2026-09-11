import fs from "node:fs";
import path from "node:path";

import {
  RAINVIEWER_ZOOM,
  dbzFromGrey,
  dbzFromUniversalBlue,
  decodePng,
  isCoveredPixel,
  kmToPixels,
  pointToGlobalPixel,
  distanceWeight,
  kmPerPixel,
  percentile,
  sampleMaxDbz,
  sampleStats,
  tileOf,
  tilesCovering,
  type Rgba,
} from "../radarSample";

/**
 * DEKODER SE MJERI PROTIV SHARPA, NE PROTIV SEBE (10.9.2026.).
 *
 * `__fixtures__/radar/*.png` su PRAVE pločice (LibreWXR shema 0 i
 * RainViewer shema 2 + coverage, sva kodiranja koja su pružatelji poslali:
 * 1/2/4/8-bit paleta, 8-bit RGBA), a `expected.json` je što je `sharp`
 * (libpng) izvukao iz njih. Naš čisti-JS dekoder mora dati ISTO — inače
 * čita krive dBZ i sudac laže.
 */

type Expected = {
  tiles: Record<string, { bytes: number; width: number; height: number; fnv: number; samples: Record<string, number[]>; maxGrey: number; opaque: number }>;
};

const DIR = path.join(__dirname, "..", "__fixtures__", "radar");
const expected = JSON.parse(fs.readFileSync(path.join(DIR, "expected.json"), "utf8")) as Expected;
const load = (name: string): Uint8Array => new Uint8Array(fs.readFileSync(path.join(DIR, `${name}.png`)));

/** Isti FNV-1a kao u skripti koja je napravila `expected.json`. */
function fnv(u8: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < u8.length; i += 1) {
    h ^= u8[i]!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

describe("decodePng — protiv sharpa, svako kodiranje koje su pružatelji poslali", () => {
  for (const [name, exp] of Object.entries(expected.tiles)) {
    it(`${name}: dimenzije, hash, pikseli, prozirnost`, () => {
      const bytes = load(name);
      expect(bytes.length).toBe(exp.bytes);
      const img = decodePng(bytes);
      expect(img.width).toBe(exp.width);
      expect(img.height).toBe(exp.height);
      expect(fnv(img.rgba)).toBe(exp.fnv);
      for (const [label, rgba] of Object.entries(exp.samples)) {
        const [px, py] = label === "zadar" ? [208, 245] : label === "mid" ? [128, 128] : label === "corner" ? [0, 0] : [60, 200];
        const i = (py * img.width + px) * 4;
        expect([img.rgba[i], img.rgba[i + 1], img.rgba[i + 2], img.rgba[i + 3]]).toEqual(rgba);
      }
      let opaque = 0;
      let maxGrey = -1;
      for (let i = 0; i < img.rgba.length; i += 4) {
        if (img.rgba[i + 3] === 0) continue;
        opaque += 1;
        if (img.rgba[i]! > maxGrey) maxGrey = img.rgba[i]!;
      }
      expect(opaque).toBe(exp.opaque);
      expect(maxGrey).toBe(exp.maxGrey);
    });
  }

  it("odbija ono što nije PNG — sudac tada radar preskoči, ne ruši", () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow(/PNG/);
  });
});

describe("Web Mercator", () => {
  it("Zadar pada u pločicu 138/92 na z8 (piksel 208,245) i 69/46 na z7", () => {
    const p8 = pointToGlobalPixel(44.13, 15.206, 8);
    expect(tileOf(p8.gx, p8.gy)).toEqual({ tx: 138, ty: 92 });
    expect([p8.gx % 256, p8.gy % 256]).toEqual([208, 245]);
    const p7 = pointToGlobalPixel(44.13, 15.206, RAINVIEWER_ZOOM);
    expect(tileOf(p7.gx, p7.gy)).toEqual({ tx: 69, ty: 46 });
  });

  it("5 km na 44° N: ~11 px na z8, ~6 px na z7", () => {
    expect(kmToPixels(5, 44.13, 8)).toBe(11);
    expect(kmToPixels(5, 44.13, 7)).toBe(6);
  });

  it("prozor unutar pločice traži jednu; na rubu dvije ili četiri", () => {
    expect(tilesCovering(138 * 256 + 128, 92 * 256 + 128, 11)).toHaveLength(1);
    expect(tilesCovering(138 * 256 + 3, 92 * 256 + 128, 11)).toHaveLength(2);
    expect(tilesCovering(138 * 256 + 3, 92 * 256 + 2, 11)).toHaveLength(4);
  });
});

describe("dbzFromUniversalBlue — kontinuirana paleta RainViewera, sidra iz LibreWXR-a", () => {
  /*
   * LibreWXR istu paletu kvantizira uz sivu dBZ skalu; izmjereno 10.9.2026.
   * na istim pikselima (siva ↔ boja). Dekoder mora pogoditi ta sidra na ±3.
   */
  const anchors: [number, number, number, number][] = [
    [136, 221, 238, 12], [0, 153, 204, 17], [0, 119, 170, 22], [0, 85, 136, 27],
    [255, 238, 0, 32], [255, 170, 0, 37], [255, 119, 0, 42], [255, 68, 0, 47], [253, 61, 0, 50],
  ];
  it("pogađa izmjerena sidra na ±3 dBZ (crveni pojas ±5 — LibreWXR ondje kvantizira na 50+)", () => {
    for (const [r, g, b, dbz] of anchors) {
      const got = dbzFromUniversalBlue(r, g, b, 255);
      expect(got).not.toBeNull();
      expect(Math.abs(got! - dbz)).toBeLessThanOrEqual(dbz >= 47 ? 5 : 3);
    }
  });

  it("raste monotono niz gradijent: svjetloplavo < tamnoplavo < žuto < narančasto < crveno", () => {
    const path: [number, number, number][] = [[136, 221, 238], [54, 186, 229], [0, 136, 191], [0, 85, 136], [0, 71, 104], [255, 238, 0], [255, 197, 0], [255, 159, 0], [255, 129, 0], [255, 68, 0], [230, 40, 0], [193, 0, 0], [143, 0, 0], [93, 0, 0]];
    const vals = path.map(([r, g, b]) => dbzFromUniversalBlue(r, g, b, 255)!);
    for (let i = 1; i < vals.length; i += 1) expect(vals[i]).toBeGreaterThan(vals[i - 1]!);
  });

  it("pragovi sudca padaju gdje treba: plavo je uvijek < 20 ili u sredini, crveno je uvijek ≥ 42", () => {
    expect(dbzFromUniversalBlue(136, 221, 238, 255)!).toBeLessThan(20);
    expect(dbzFromUniversalBlue(0, 71, 104, 255)!).toBeLessThan(42);
    expect(dbzFromUniversalBlue(255, 68, 0, 255)!).toBeGreaterThanOrEqual(42);
    expect(dbzFromUniversalBlue(193, 0, 0, 255)!).toBeGreaterThanOrEqual(42);
  });

  it("boje placeholdera 'Zoom Level Not Supported' (bijelo, sive, crno) NISU oborina", () => {
    for (const [r, g, b, a] of [[255, 255, 255, 200], [38, 38, 38, 149], [75, 75, 75, 255], [242, 242, 242, 255], [0, 0, 0, 140]]) {
      expect(dbzFromUniversalBlue(r!, g!, b!, a!)).toBeNull();
    }
    expect(dbzFromUniversalBlue(0, 119, 170, 0)).toBeNull();
  });

  /*
   * REGRESIJA 10.9.2026. — Zadar je pisao „slaba kiša" uz PRAZAN radar.
   *
   * Dekoder je imao granu „bež → smeđe = snijeg/susnježica" i ona je nad
   * Zadrom vratila 29 dBZ, pa je sudac (< 20 obara) mislio da radar
   * POTVRĐUJE postajinu kišu i pustio ju je na heroja.
   *
   * Zašto bež ne smije biti oborina — izmjereno na 66 DHMZ postaja u
   * istom trenutku (okvir 14:50, uzorak 5 km):
   *   Zadar-aerodrom  „pretežno oblačno"  bež=121  plavo=21
   *   RC Gorice       „potpuno oblačno"   bež=122  plavo=12
   *   Daruvar         „potpuno oblačno"   bež=113  plavo=56
   *   Zadar           „slaba kiša"        bež=0    plavo=0
   * Bež je jednako obilan nad suhim kao nad mokrim postajama (prosjek
   * 12.5 suhi / 37.0 mokri, uz pojedinačne suhe iznad 100) — ne razlikuje
   * kišu, pa nema pravo obarati ni potvrđivati. Plavo razlikuje
   * (6.2 suhi / 38.0 mokri) i ostaje.
   */
  it("bež/pješčane boje (obala) NISU oborina — inače Zadar dobije 29 dBZ nad praznim radarom", () => {
    const bez: [number, number, number, number][] = [
      [139, 130, 109, 89],
      [146, 136, 113, 100],
      [158, 147, 117, 110],
      [170, 158, 121, 120],
      [182, 169, 126, 130],
      [194, 180, 130, 140],
      [206, 192, 135, 150],
      [210, 196, 139, 160],
      [214, 200, 143, 170],
    ];
    for (const [r, g, b, a] of bez) {
      expect(dbzFromUniversalBlue(r, g, b, a)).toBeNull();
    }
  });

  it("dbzFromGrey (LibreWXR shema 0): siva − 32, samo za sive piksele", () => {
    expect(dbzFromGrey(62, 62, 62, 255)).toBe(30);
    expect(dbzFromGrey(62, 62, 62, 0)).toBeNull();
    expect(dbzFromGrey(255, 238, 0, 255)).toBeNull();
  });
});

describe("sampleMaxDbz na pravim pločicama", () => {
  it("LibreWXR Zadar 12:00 (siva): 56 dBZ u ±5 km — isto što je izmjereno sharpom u baždarenju", () => {
    const tiles = new Map<string, Rgba>([["138/92", decodePng(load("zadar-z8-138-92"))]]);
    const { gx, gy } = pointToGlobalPixel(44.13, 15.206, 8);
    const { maxDbz, echoPixels } = sampleMaxDbz(tiles, gx, gy, kmToPixels(5, 44.13, 8), dbzFromGrey);
    expect(maxDbz).toBe(56);
    expect(echoPixels).toBeGreaterThan(0);
  });

  it("RainViewer Verona 14:10 (boje): jaka jezgra ≥ 42 dBZ u ±5 km — što je Marko vidio kao 'jaka kiša'", () => {
    const tiles = new Map<string, Rgba>([["67/45", decodePng(load("rv-z7-verona-scheme2"))]]);
    const { gx, gy } = pointToGlobalPixel(45.438, 10.993, RAINVIEWER_ZOOM);
    expect(tileOf(gx, gy)).toEqual({ tx: 67, ty: 45 });
    const { maxDbz } = sampleMaxDbz(tiles, gx, gy, kmToPixels(5, 45.438, RAINVIEWER_ZOOM), dbzFromUniversalBlue);
    expect(maxDbz).not.toBeNull();
    expect(maxDbz!).toBeGreaterThanOrEqual(42);
  });

  it("RainViewer z8 = placeholder s tekstom → NULL, ne broj (inače bi bijeli tekst bio 'tuča')", () => {
    const tiles = new Map<string, Rgba>([["138/92", decodePng(load("rv-z8-unsupported"))]]);
    const { gx, gy } = pointToGlobalPixel(44.13, 15.206, 8);
    expect(sampleMaxDbz(tiles, gx, gy, 11, dbzFromUniversalBlue)).toMatchObject({ maxDbz: null, echoPixels: 0 });
  });

  it("prazna pločica (Kairo) daje null, ne nulu; pločica koje nema se preskače", () => {
    const empty = new Map<string, Rgba>([["150/105", decodePng(load("kairo-z8-150-105"))]]);
    const p = pointToGlobalPixel(30.04, 31.24, 8);
    // Pokrivenost je > 0 jer su pikseli PREGLEDANI (samo nemaju odjek).
    expect(sampleMaxDbz(empty, p.gx, p.gy, 11, dbzFromGrey)).toMatchObject({ maxDbz: null, echoPixels: 0 });
    // Pločice koje nema se preskaču, pa nema ni pregledanih piksela.
    expect(sampleMaxDbz(new Map(), p.gx, p.gy, 5, dbzFromGrey)).toEqual({ maxDbz: null, echoPixels: 0, coverPixels: 0 });
  });
});

describe("pokrivenost (RainViewer coverage, z7): prozirno = pokriveno, crno = ne", () => {
  it("Zadar je pokriven, Kijev nije", () => {
    const zadar = pointToGlobalPixel(44.13, 15.206, RAINVIEWER_ZOOM);
    expect(isCoveredPixel(decodePng(load("coverage-z7-zadar")), zadar.gx, zadar.gy)).toBe(true);
    const kyiv = pointToGlobalPixel(50.45, 30.52, RAINVIEWER_ZOOM);
    expect(tileOf(kyiv.gx, kyiv.gy)).toEqual({ tx: 74, ty: 43 });
    expect(isCoveredPixel(decodePng(load("coverage-z7-kyiv")), kyiv.gx, kyiv.gy)).toBe(false);
  });
});

/*
 * PROSTORNE STATISTIKE (11.9.2026.) — zamjena za golu brojku `maxDbz`.
 *
 * Povod: `maxDbz` je maksimum preko ~49 piksela, pa JEDAN piksel diktira
 * cijelu tvrdnju. Nad Metkovićem je tako 45 dBZ na 18 % kruga dalo lažnu
 * jaku kišu, a nad splitskom Rivom je isti okvir davao 8.9 ili 31.6 mm/h
 * ovisno SAMO o polumjeru uzorka (Markov nalaz s kamere: ljudi bez
 * kišobrana). Median je bio 38 dBZ na svakom polumjeru.
 */
describe("sampleStats — percentili, pokrivenost, tezine", () => {
  it("percentile: granice i interpolacija", () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([10], 0.9)).toBe(10);
    expect(percentile([10, 20], 0.5)).toBe(15);
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([10, 20, 30, 40], 0)).toBe(10);
    expect(percentile([10, 20, 30, 40], 1)).toBe(40);
  });

  it("distanceWeight: sredina 1, rub prakticno 0, monotono pada", () => {
    expect(distanceWeight(0, 3)).toBe(1);
    expect(distanceWeight(3, 3)).toBeCloseTo(Math.exp(-4), 4);
    expect(distanceWeight(1, 3)).toBeGreaterThan(distanceWeight(2, 3));
    // nikad nula — informacija se ne gubi
    expect(distanceWeight(10, 3)).toBeGreaterThan(0);
  });

  it("kmPerPixel: na z=7 i 44° je ~0.88 km (1.2 km vrijedi na ekvatoru)", () => {
    // Mercator steze prema polovima: 1.2 km/px na ekvatoru je 0.88 na 44°.
    // Bitno za motion — pomak od JEDNOG piksela je ~0.9 km, dakle 5 km/h
    // kroz 10 min; zato je prag pouzdanosti pomaka 3 km/h.
    expect(kmPerPixel(44, 7)).toBeCloseTo(0.88, 2);
    expect(kmPerPixel(0, 7)).toBeCloseTo(1.22, 2);
    // obrat kmToPixels se poklapa
    expect(kmToPixels(3, 44, 7)).toBe(Math.max(1, Math.round(3 / kmPerPixel(44, 7))));
  });

  it("prazna plocica: sve null, pokrivenost 0, bez teziste", () => {
    const tiles = new Map<string, Rgba>([["150/105", decodePng(load("kairo-z8-150-105"))]]);
    const p = pointToGlobalPixel(30.04, 31.24, 8);
    const s = sampleStats(tiles, p.gx, p.gy, 5, dbzFromGrey, 1.2);
    expect(s.maxDbz).toBeNull();
    expect(s.medianDbz).toBeNull();
    expect(s.coverage20).toBe(0);
    expect(s.echoPixels).toBe(0);
    expect(s.coverPixels).toBeGreaterThan(0);
    expect(s.centroid).toBeUndefined();
  });

  it("Verona z7: median je NIZI od maxa (jedan piksel ne vuce sredinu)", () => {
    const tiles = new Map<string, Rgba>([["67/45", decodePng(load("rv-z7-verona-scheme2"))]]);
    const { gx, gy } = pointToGlobalPixel(45.438, 10.992, RAINVIEWER_ZOOM);
    const s = sampleStats(tiles, gx, gy, 3, dbzFromUniversalBlue, 1.2);
    expect(s.maxDbz).not.toBeNull();
    expect(s.medianDbz).not.toBeNull();
    expect(s.medianDbz!).toBeLessThanOrEqual(s.maxDbz!);
    expect(s.p90Dbz!).toBeLessThanOrEqual(s.maxDbz!);
    expect(s.medianDbz!).toBeLessThanOrEqual(s.p90Dbz!);
  });

  it("pokrivenost pada s pragom: cov20 >= cov28 >= cov40 >= cov55", () => {
    const tiles = new Map<string, Rgba>([["67/45", decodePng(load("rv-z7-verona-scheme2"))]]);
    const { gx, gy } = pointToGlobalPixel(45.438, 10.992, RAINVIEWER_ZOOM);
    const s = sampleStats(tiles, gx, gy, 5, dbzFromUniversalBlue, 1.2);
    expect(s.coverage20).toBeGreaterThanOrEqual(s.coverage28);
    expect(s.coverage28).toBeGreaterThanOrEqual(s.coverage40);
    expect(s.coverage40).toBeGreaterThanOrEqual(s.coverage55);
    expect(s.coverage20).toBeLessThanOrEqual(1);
  });

  it("maxDbz je ISTI kao u sampleMaxDbz — nova funkcija ne mijenja staru brojku", () => {
    const tiles = new Map<string, Rgba>([["67/45", decodePng(load("rv-z7-verona-scheme2"))]]);
    const { gx, gy } = pointToGlobalPixel(45.438, 10.992, RAINVIEWER_ZOOM);
    const a = sampleMaxDbz(tiles, gx, gy, 4, dbzFromUniversalBlue);
    const b = sampleStats(tiles, gx, gy, 4, dbzFromUniversalBlue);
    expect(b.maxDbz).toBe(a.maxDbz);
    expect(b.echoPixels).toBe(a.echoPixels);
    expect(b.coverPixels).toBe(a.coverPixels);
  });

  it("bez kmPerPx su tezinske vrijednosti jednake netezinskima", () => {
    const tiles = new Map<string, Rgba>([["67/45", decodePng(load("rv-z7-verona-scheme2"))]]);
    const { gx, gy } = pointToGlobalPixel(45.438, 10.992, RAINVIEWER_ZOOM);
    const s = sampleStats(tiles, gx, gy, 3, dbzFromUniversalBlue);
    expect(s.weightedMeanDbz).toBeCloseTo(
      // bez tezina je to obican prosjek preko SVIH pregledanih piksela
      (s.meanDbz ?? 0) * (s.echoPixels / s.coverPixels), 5,
    );
    expect(s.centroid).toBeUndefined();
  });

  it("teziste je unutar uzorka i u kilometrima", () => {
    const tiles = new Map<string, Rgba>([["67/45", decodePng(load("rv-z7-verona-scheme2"))]]);
    const { gx, gy } = pointToGlobalPixel(45.438, 10.992, RAINVIEWER_ZOOM);
    const s = sampleStats(tiles, gx, gy, 3, dbzFromUniversalBlue, 1.2);
    if (s.centroid) {
      expect(Math.abs(s.centroid.xKm)).toBeLessThanOrEqual(3 * 1.2 + 0.01);
      expect(Math.abs(s.centroid.yKm)).toBeLessThanOrEqual(3 * 1.2 + 0.01);
    }
  });
});
