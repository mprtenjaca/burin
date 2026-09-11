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
  sampleMaxDbz,
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
