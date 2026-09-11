import { unzlibSync } from "fflate";

import { fetchBytes } from "./client";

/**
 * RADAR KAO SUDAC ZA OBORINU — uzorak radarskog odjeka nad točkom
 * (10.9.2026.).
 *
 * ZAŠTO: heroj je crtao „grmljavinsko nevrijeme" sat i pol nakon što je
 * prošlo. DHMZ tekst je snimka TERMINA (satni, objavljen 30–70 min
 * kasnije), a model (Open-Meteo) za kišu koja pada — ili ne pada — ne zna
 * (Crikvenica: kod 61 uz 0 mm i prazan radar; Verona: kod 61 „rosulja" uz
 * 47 dBZ). Jedini izvor koji zna pada li SADA je radar, osvježen svakih
 * 10 min. Postoji samo kao slika — pa se slika čita.
 *
 * KOJI RADAR: **RainViewer**, ne LibreWXR. Izmjereno 10.9.2026. na 290
 * postaja s mjerenjem na tlu (Austrija mm/10 min + Slovenija pojava):
 * LibreWXR je na istim točkama 10–25 dBZ JAČI (javna instanca sirovih
 * OPERA podataka bez filtriranja), s pet puta više lažnih „pada" na istom
 * pragu i s odjekom koji je nad Dalmacijom stajao nepomičan na 100 %
 * pokrivenosti — zemljani odjek, ne kiša (Polača 42 dBZ uz suho; RV 17).
 * RainViewer nijednu suhu postaju nije prešao 37 dBZ. LibreWXR ostaje sloj
 * na karti (ima z=11 i nowcast); za SUD se čita RainViewer.
 *
 * KAKO SE ČITA: RainViewer NEMA sivu dBZ shemu (njegova „0" je R kanal
 * palete, ne skala), pa se čitaju BOJE sheme 2 („Universal Blue") kroz
 * kontinuirani dekoder — paleta je gradijent po ~1 dBZ. Sidra dekodera su
 * IZMJERENA na LibreWXR-u, koji istu paletu kvantizira uz sivu dBZ skalu:
 * (136,221,238)=12 · (0,153,204)=17 · (0,119,170)=22 · (0,85,136)=27 ·
 * (255,238,0)≈32 · (255,170,0)≈37 · (255,119,0)≈42 · (255,68,0)≈47 ·
 * (253,61,0)≈50. RainViewer ima podatke SAMO do z=7 — z=8 vraća pločicu
 * s tekstom „Zoom Level Not Supported" (izmjereno: ista za Zadar, Tokyo i
 * Kairo). Zato je zoom 7, a nepoznate boje (bijeli tekst, sive) daju
 * `null`, ne broj.
 *
 * POKRIVENOST: RainViewer `/v2/coverage/` pločica, dokumentirano
 * „prozirno = radar postoji, crno = ne postoji". Bez toga bi prazna
 * pločica nad Kijevom ili Ankarom značila „ne pada" — a znači „ne znamo".
 *
 * PNG se dekodira ČISTIM JS-om (`fflate` + PNG unfilter ovdje), bez
 * nativnog modula. Podržane sve dubine i tipovi koje su pružatelji
 * emitirali (izmjereno: 1/2/4/8-bit paleta, 8-bit RGBA). Sve drugo baca,
 * a pozivatelj to tretira kao „radar nedostupan".
 */

/** RainViewer: podaci staju na z=7 (dokumentirano i izmjereno). */
export const RAINVIEWER_ZOOM = 7;

/**
 * Radijus uzorka u km oko točke.
 *
 * 11.9.2026. sa 5 na 3 km (Markov nalaz: „nakon što je kiša stala nama
 * piše da još pada"). Uzorak uzima NAJJAČI odjek u krugu, pa je s 5 km
 * kiša u Bibinjama ili na Zemuniku postajala „kiša u Zadru" — izmjereno
 * istog jutra: dok je nad Poluotokom prestajalo, Zemunik (10 km) je
 * skočio s 22 na 35 dBZ, a krug ih je oba obuhvaćao.
 *
 * Zašto ne još uže: na z=7 je jedan piksel ~1.2 km na 44° N, pa je 3 km
 * krug od ~5×5 piksela. Ispod toga uzorak postaje osjetljiv na jedan
 * piksel šuma i na to koliko je GPS točan.
 */
export const SAMPLE_RADIUS_KM = 3;

const TILE = 256;

export type RadarEcho = {
  /** Najveći odjek u krugu, dBZ; `null` = ni jedan piksel s oborinom. */
  maxDbz: number | null;
  /** Vrijeme okvira (epoch s) — po njemu se računa starost. */
  frameTime: number;
  radiusKm: number;
  /**
   * Koliko je piksela u krugu UKUPNO pregledano. S `echoPixels` daje
   * POKRIVENOST — mjeru koja razlikuje jezgru u oblaku od kišnog polja
   * (11.9.2026., Metković: 49 dBZ na 18 % kruga uz suho tlo; Korenica:
   * 37 dBZ na 100 % kruga uz kišu).
   */
  coverPixels: number;
  /** Koliko je piksela u krugu imalo prepoznat odjek — za dijagnostiku. */
  echoPixels: number;
};

export type Rgba = { width: number; height: number; rgba: Uint8Array };

/** Boja piksela → dBZ, ili `null` kad piksel nije oborina. */
export type PixelDecoder = (r: number, g: number, b: number, a: number) => number | null;

// ---- Web Mercator ----

/** Globalne piksel-koordinate točke na zadanom zoomu (pločica 256 px). */
export function pointToGlobalPixel(lat: number, lon: number, z: number): { gx: number; gy: number } {
  const n = 2 ** z;
  const xf = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { gx: Math.floor(xf * TILE), gy: Math.floor(yf * TILE) };
}

/** Koliko piksela na zadanom zoomu i širini stane u `km`. */
export function kmToPixels(km: number, lat: number, z: number): number {
  const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
  return Math.max(1, Math.round((km * 1000) / metersPerPixel));
}

/** Pločica u kojoj leži globalni piksel. */
export function tileOf(gx: number, gy: number): { tx: number; ty: number } {
  return { tx: Math.floor(gx / TILE), ty: Math.floor(gy / TILE) };
}

/** Sve pločice koje prozor ±radiusPx oko točke dodiruje (1 do 4). */
export function tilesCovering(gx: number, gy: number, radiusPx: number): { tx: number; ty: number }[] {
  const a = tileOf(Math.max(0, gx - radiusPx), Math.max(0, gy - radiusPx));
  const b = tileOf(gx + radiusPx, gy + radiusPx);
  const out: { tx: number; ty: number }[] = [];
  for (let tx = a.tx; tx <= b.tx; tx += 1) for (let ty = a.ty; ty <= b.ty; ty += 1) out.push({ tx, ty });
  return out;
}

// ---- dekoderi boja ----

/** LibreWXR shema 0: siva = dBZ + 32 (izmjereno protiv sheme 2). */
export const dbzFromGrey: PixelDecoder = (r, g, b, a) => {
  if (a === 0 || r !== g || g !== b) return null;
  return r - 32;
};

/**
 * RainViewer shema 2 („Universal Blue"), KONTINUIRANA paleta. Po
 * obitelji boje, pa po položaju unutar nje — sidra iz LibreWXR-a (vidi
 * zaglavlje). Tolerancija ±3 dBZ je dovoljna: pragovi sudca su 20 i 42.
 */
export const dbzFromUniversalBlue: PixelDecoder = (r, g, b, a) => {
  if (a === 0) return null;
  // Bijeli/sivi tekst placeholdera („Zoom Level Not Supported"): nije boja.
  if (r === g && g === b) return null;
  // Magenta/ružičasto: tuča, 60+.
  if (r === 255 && b === 255 && g < 200) return 60;
  // Žuto → narančasto (R=255, B=0): 30 → 45. Sidra: G 238→30, 170→35, 119→40, 68→45.
  if (r === 255 && b === 0 && g >= 68) {
    if (g >= 170) return 30 + ((238 - g) / 68) * 5;
    return 35 + ((170 - g) / 102) * 10;
  }
  // Crveno (B=0, G<68): 45 → 58. Sidra: (255,68,0)=45, (193,0,0)=50, (93,0,0)=58.
  if (b === 0 && g < 68 && r >= 93) {
    if (r >= 193) return 45 + ((255 - r) / 62) * 5;
    return 50 + ((193 - r) / 100) * 8;
  }
  // Plavo (B najviši): 10 → 29 po svjetlini plavog kanala. Sidra: B 238→10, 136→27, 104→29.
  if (b > g && b > r && b >= 100 && r <= 140) {
    return 10 + ((238 - b) / 134) * 19;
  }
  /*
   * BEŽ/PIJESAK NIJE OBORINA — to je OBALA (10.9.2026.).
   *
   * Prva verzija je imala granu „bež → smeđe = snijeg/susnježica" i ona
   * je Zadru dala 29 dBZ NAD PRAZNIM RADAROM, pa je sudac pustio postaji
   * „slaba kiša" da stoji (Markov nalaz: „radar je prazan iznad Zadra").
   * Ta je grana bila NAGAĐANA — jedina u dekoderu bez izmjerenog sidra.
   *
   * Što su ti pikseli stvarno, izmjereno na pločici 69/46 (z=7):
   *  - 12 378 od 65 536 piksela (19 %) su bež, a žutih i crvenih 29;
   *  - BAJT PO BAJT su IDENTIČNI u shemi 2 i u shemi 0 — pravi dBZ bi
   *    druga paleta prebojila, ovdje se ne mijenja ni jedan kanal;
   *  - jedan jedini pješčani ton kojemu svjetlina prati alfu linearno
   *    (r ~ 1.01*alfa + 48, najveće odstupanje 6.5/255) — dakle ZAGLAĐEN
   *    RUB, ne ljestvica jačine;
   *  - broj bež piksela je ISTI u 0_0 (bez snijega) i 0_1 (sa snijegom) —
   *    da je snijeg, ne bi bio.
   *
   * Zato te grane nema. Nepoznata boja vraća null, kako i treba.
   */
  return null;
};

// ---- PNG ----

function readU32(b: Uint8Array, p: number): number {
  return ((b[p]! << 24) | (b[p + 1]! << 16) | (b[p + 2]! << 8) | b[p + 3]!) >>> 0;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Dekodira PNG u RGBA. Podržano: dubine 1, 2, 4, 8 i 16 bita, bez
 * interlacea, tipovi boje 0 (siva), 2 (RGB), 3 (paleta + tRNS), 4
 * (siva+alfa), 6 (RGBA). Ostalo baca — pozivatelj to prevodi u „radar
 * nedostupan".
 *
 * ZAŠTO SVE DUBINE (izmjereno 10.9.2026.): pružatelji ne šalju uvijek
 * 8-bit RGBA — gotovo prazne pločice dolaze kao 1-bitna, a pločice s malo
 * boja kao 2/4/8-bitna PALETA (libpng bira najmanji zapis). Prva verzija
 * je podržavala samo 8 bita i na pola Europe bacala „bit depth 4 nije
 * podržan". Fixturei za svako kodiranje stoje uz test, sharp im je sudac.
 */
export function decodePng(bytes: Uint8Array): Rgba {
  const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i += 1) if (bytes[i] !== SIG[i]) throw new Error("PNG: nije PNG");

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  const idat: Uint8Array[] = [];
  let idatLen = 0;

  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = readU32(bytes, p);
    const type = String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!);
    const data = bytes.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      width = readU32(data, 0);
      height = readU32(data, 4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      interlace = data[12]!;
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      trns = data;
    } else if (type === "IDAT") {
      idat.push(data);
      idatLen += data.length;
    } else if (type === "IEND") {
      break;
    }
    p += 12 + len;
  }
  if (!width || !height) throw new Error("PNG: nema IHDR");
  if (![1, 2, 4, 8, 16].includes(bitDepth)) throw new Error(`PNG: bit depth ${bitDepth} nije podržan`);
  if (interlace !== 0) throw new Error("PNG: interlace nije podržan");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`PNG: tip boje ${colorType} nije podržan`);
  if (bitDepth < 8 && colorType !== 0 && colorType !== 3) throw new Error("PNG: dubina < 8 samo za sivu i paletu");

  const zipped = new Uint8Array(idatLen);
  let off = 0;
  for (const c of idat) {
    zipped.set(c, off);
    off += c.length;
  }
  const raw = unzlibSync(zipped);

  // Unfilter po redovima: bajt filtera pa `stride` bajtova. Za dubine < 8
  // filter radi nad cijelim bajtovima (bpp = 1), kako PNG i propisuje.
  const bitsPerPixel = channels * bitDepth;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const out = new Uint8Array(height * stride);
  if (raw.length < height * (stride + 1)) throw new Error("PNG: prekratak podatak");
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const prev = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? out[dst + x - bpp]! : 0;
      const b = y > 0 ? out[prev + x]! : 0;
      const c = y > 0 && x >= bpp ? out[prev + x - bpp]! : 0;
      const v = raw[src + x]!;
      let r: number;
      switch (filter) {
        case 0: r = v; break;
        case 1: r = v + a; break;
        case 2: r = v + b; break;
        case 3: r = v + ((a + b) >> 1); break;
        case 4: r = v + paeth(a, b, c); break;
        default: throw new Error(`PNG: filter ${filter}`);
      }
      out[dst + x] = r & 255;
    }
  }

  const maxVal = (1 << bitDepth) - 1;
  const sample = (row: number, index: number): number => {
    if (bitDepth === 8) return out[row * stride + index]!;
    if (bitDepth === 16) return out[row * stride + index * 2]!;
    const bit = index * bitDepth;
    const byte = out[row * stride + (bit >> 3)]!;
    const shift = 8 - bitDepth - (bit & 7);
    return (byte >> shift) & maxVal;
  };
  const grey = (v: number) => (bitDepth === 8 || bitDepth === 16 ? v : Math.round((v * 255) / maxVal));

  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      switch (colorType) {
        case 6: {
          const i = x * 4;
          rgba[o] = sample(y, i); rgba[o + 1] = sample(y, i + 1); rgba[o + 2] = sample(y, i + 2); rgba[o + 3] = sample(y, i + 3);
          break;
        }
        case 2: {
          const i = x * 3;
          rgba[o] = sample(y, i); rgba[o + 1] = sample(y, i + 1); rgba[o + 2] = sample(y, i + 2); rgba[o + 3] = 255;
          break;
        }
        case 0: {
          const g = grey(sample(y, x));
          rgba[o] = rgba[o + 1] = rgba[o + 2] = g; rgba[o + 3] = 255;
          break;
        }
        case 4: {
          const g = grey(sample(y, x * 2));
          rgba[o] = rgba[o + 1] = rgba[o + 2] = g; rgba[o + 3] = grey(sample(y, x * 2 + 1));
          break;
        }
        case 3: {
          const idx = sample(y, x);
          rgba[o] = palette?.[idx * 3] ?? 0;
          rgba[o + 1] = palette?.[idx * 3 + 1] ?? 0;
          rgba[o + 2] = palette?.[idx * 3 + 2] ?? 0;
          rgba[o + 3] = trns && idx < trns.length ? trns[idx]! : 255;
          break;
        }
        default:
          throw new Error("PNG: tip boje");
      }
    }
  }
  return { width, height, rgba };
}

// ---- uzorak ----

/**
 * Najveći dBZ u kvadratu ±`radiusPx` oko globalnog piksela, kroz zadani
 * dekoder boje. `tiles` su dekodirane pločice po ključu "tx/ty"; pločica
 * koje nema se preskače.
 */
export function sampleMaxDbz(
  tiles: Map<string, Rgba>,
  gx: number,
  gy: number,
  radiusPx: number,
  decode: PixelDecoder,
): { maxDbz: number | null; echoPixels: number; coverPixels: number } {
  let max = -Infinity;
  let echoPixels = 0;
  let coverPixels = 0;
  for (let dy = -radiusPx; dy <= radiusPx; dy += 1) {
    for (let dx = -radiusPx; dx <= radiusPx; dx += 1) {
      const X = gx + dx;
      const Y = gy + dy;
      if (X < 0 || Y < 0) continue;
      const { tx, ty } = tileOf(X, Y);
      const t = tiles.get(`${tx}/${ty}`);
      if (!t) continue;
      // Piksel je PREGLEDAN i kad na njemu nema odjeka — inače se
      // pokrivenost ne može izračunati (dijelilo bi se samo s onima koji
      // odjek imaju, pa bi svaka jezgra bila „100 %").
      coverPixels += 1;
      const i = ((Y % TILE) * t.width + (X % TILE)) * 4;
      const dbz = decode(t.rgba[i]!, t.rgba[i + 1]!, t.rgba[i + 2]!, t.rgba[i + 3]!);
      if (dbz === null) continue;
      echoPixels += 1;
      if (dbz > max) max = dbz;
    }
  }
  return { maxDbz: echoPixels ? Math.round(max) : null, echoPixels, coverPixels };
}

/** URL pločice: `{host}{path}/256/{z}/{x}/{y}/{shema}/{glačanje}_{snijeg}.png`. */
export function tileUrl(host: string, framePath: string, z: number, tx: number, ty: number, scheme: number): string {
  return `${host}${framePath}/${TILE}/${z}/${tx}/${ty}/${scheme}/0_0.png`;
}

/**
 * Dohvati i uzorkuj RainViewer odjek nad točkom za zadani okvir. Baca kad
 * ijedna pločica ne dođe ili se ne da dekodirati — pozivatelj
 * (react-query) to vidi kao grešku upita, a sudac tada radar ignorira.
 */
export async function fetchRadarEcho(
  host: string,
  frame: { time: number; path: string },
  lat: number,
  lon: number,
  radiusKm = SAMPLE_RADIUS_KM,
): Promise<RadarEcho> {
  const z = RAINVIEWER_ZOOM;
  const { gx, gy } = pointToGlobalPixel(lat, lon, z);
  const radiusPx = kmToPixels(radiusKm, lat, z);
  const needed = tilesCovering(gx, gy, radiusPx);
  const tiles = new Map<string, Rgba>();
  await Promise.all(
    needed.map(async ({ tx, ty }) => {
      const bytes = await fetchBytes(tileUrl(host, frame.path, z, tx, ty, 2));
      tiles.set(`${tx}/${ty}`, decodePng(bytes));
    }),
  );
  const { maxDbz, echoPixels, coverPixels } = sampleMaxDbz(tiles, gx, gy, radiusPx, dbzFromUniversalBlue);
  return { maxDbz, frameTime: frame.time, radiusKm, echoPixels, coverPixels };
}

/** Coverage pločica RainViewera za točku (z7): prozirno = pokriveno. */
export function coverageTileUrl(host: string, tx: number, ty: number): string {
  return `${host}/v2/coverage/0/${TILE}/${RAINVIEWER_ZOOM}/${tx}/${ty}/0/0_0.png`;
}

/** Je li piksel pločice pokrivenosti „pokriven" — dokumentirano: prozirno = da. */
export function isCoveredPixel(img: Rgba, gx: number, gy: number): boolean {
  const i = ((gy % TILE) * img.width + (gx % TILE)) * 4;
  return img.rgba[i + 3] === 0;
}

/**
 * Ima li RainViewer radar nad točkom. Baca na mrežnu grešku — pozivatelj
 * tada radar ne pita (nepoznata pokrivenost = nema suda).
 */
export async function fetchRadarCoverage(host: string, lat: number, lon: number): Promise<boolean> {
  const { gx, gy } = pointToGlobalPixel(lat, lon, RAINVIEWER_ZOOM);
  const { tx, ty } = tileOf(gx, gy);
  const img = decodePng(await fetchBytes(coverageTileUrl(host, tx, ty)));
  return isCoveredPixel(img, gx, gy);
}
