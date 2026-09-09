import { fetchJson } from "./client";
import type { RadarFrame } from "./types";

/**
 * LibreWXR — radar s BUDUĆNOŠĆU, kao test-sloj uz RainViewer (9.9.2026.).
 *
 * Zašto uopće drugi radar: RainViewer je **1.1.2026. ukinuo nowcast**
 * (buduće okvire), satelit, sve sheme boja osim Universal Blue, i spustio
 * zoom na z=7 — vidi njihov transition FAQ. Pretplata koja to vrati NE
 * postoji: RainViewer više ne prodaje API pristup (ono što se plaća je
 * njihova mobilna aplikacija). Zato `radar.nowcast` u `rainviewer.ts` stoji
 * prazan — polje je ostatak strukture starog API-ja, ne nešto što se može
 * uključiti.
 *
 * LibreWXR je otvorena zamjena (AGPL kod, podaci CC-BY-4.0) s **istim
 * oblikom API-ja**, pa je ovaj klijent gotovo blizanac `rainviewer.ts`.
 * Izmjereno živo 9.9.2026. nad Zadrom i Zagrebom:
 *
 * | | RainViewer | LibreWXR |
 * |---|---|---|
 * | prošli okviri | 13 (−2 h / 10 min) | 12 (−2 h / 10 min) |
 * | **budući okviri** | **0 (ukinuto)** | **6 (+60 min / 10 min)** |
 * | podaci do zooma | z=7 | **z=11** |
 * | alfa pločice | 76/255 (traži `doubleUp`) | **255** |
 * | sheme boja | 1 (spojene) | 15 |
 * | satelit | ukinuto | 12 okvira |
 *
 * Europa ide preko EUMETNET OPERA mreže (~155 radara, 24 zemlje), pa je
 * Hrvatska pokrivena — provjereno dekodiranjem piksela: 28 % pločice nad
 * Zadrom nosi oborinu, a nowcast okvir 27 % (dakle prava prognoza, ne
 * prazan omot).
 *
 * PRAVNO: podaci su CC-BY-4.0 — slobodni uz atribuciju, koja ide kroz
 * `attribution` na sloju u `mapLayers.ts`. Bitno drukčije od Plive (vidi
 * `stampar.ts`): ovdje ponovna uporaba nije ograničena, pa sloj NE treba
 * biti iza `__DEV__`. Iznimka koja nas ne dira: pločice s talijanskim DPC
 * podacima nose CC-BY-SA (share-alike) — to je regija ITCOMP.
 *
 * OPREZ: javna instanca je besplatna i bez SLA ni rate-limit zaglavlja.
 * Zato duži `staleTime` u `useLibreFrames` i, ako padne, sloj je prazan a
 * postojeći Radar radi neovisno.
 */

const API_URL = "https://api.librewxr.net/public/weather-maps.json";

type LwFrame = { time: number; path: string };
type LwResponse = {
  host: string;
  radar?: { past?: LwFrame[]; nowcast?: LwFrame[] };
};

export type LibreFrames = { frames: RadarFrame[]; host: string };

/**
 * Shema boja u URL-u pločice.
 *
 * 1 = "Rainviewer Original" — namjerno, da test-sloj izgleda što bliže
 * radaru na koji je Marko navikao (od 15 shema koje LibreWXR nudi). Sheme
 * se stvarno razlikuju: provjereno da 1/2/10/14 vraćaju različite slike
 * (drugi md5), dakle broj nije dekoracija.
 */
const COLOR_SCHEME = 1;

/**
 * Zadnji dio URL-a: `<glačanje>_<snijeg>`, isto što koristi radarski sloj
 * u `mapLayers.ts`.
 *
 * Izmjereno 9.9.2026. na istoj pločici (z=7 nad Zadrom):
 *
 * - PRVI broj je glačanje i stvarno radi: `1_*` daje 41 kB, `0_*` samo
 *   5 kB — dakle bez glačanja izlaze gruba stepenasta polja.
 * - DRUGI broj (snijeg) na ovoj pločici NE mijenja ništa: `1_1` i `1_0`
 *   su BAJT-IDENTIČNI (isti md5). Očekivano — 9. rujna nad Dalmacijom
 *   nema snijega. Ostaje 1 jer je tako i na radarskom sloju, pa se zimi
 *   snijeg razlikuje bojom bez ikakve izmjene.
 */
const SMOOTHING = "1_1";

/**
 * Putanja pločice za dani okvir — sastavlja se OVDJE, uz sam klijent, da
 * shema boja i glačanje stoje na jednom mjestu s brojkama iz mjerenja.
 *
 * `{z}/{x}/{y}` ostaju MapLibre predlošci: URL se ne interpolira u JS-u
 * nego ga rasterski izvor puni sam, kao i kod RainViewera.
 */
export function libreTileUrl(host: string, path: string, size: 256 | 512): string {
  return `${host}${path}/${size}/{z}/{x}/{y}/${COLOR_SCHEME}/${SMOOTHING}.png`;
}

/**
 * Dohvaća listu radarskih okvira (prošla 2 h + nowcast do +60 min).
 *
 * Oblik izlaza je NAMJERNO identičan `fetchRadarFrames` — isti `RadarFrame`
 * s `isNowcast`, pa vremenska crta (`MapTimeline`) i `map.tsx` rade bez
 * ijedne izmjene: oznaka "prognoza" na budućim koracima i sidro "sada" na
 * zadnjem izmjerenom već postoje.
 *
 * Za razliku od RainViewera, ovdje `nowcast` NIJE prazan — to je cijela
 * svrha sloja. Ipak se čita obrambeno: instanca bez nowcasta smije vratiti
 * samo prošlost, i player s tim radi.
 */
export async function fetchLibreFrames(): Promise<LibreFrames> {
  const res = await fetchJson<LwResponse>(API_URL);
  const past = res.radar?.past ?? [];
  const nowcast = res.radar?.nowcast ?? [];
  return {
    host: res.host,
    frames: [
      ...past.map((f) => ({ time: f.time, path: f.path, isNowcast: false })),
      ...nowcast.map((f) => ({ time: f.time, path: f.path, isNowcast: true })),
    ],
  };
}
