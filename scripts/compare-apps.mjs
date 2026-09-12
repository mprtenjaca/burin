/**
 * NAŠA APP PROTIV DRUGIH — na MJERENJU S TLA (12.9.2026., Markov zahtjev:
 * „testiraj neke okolo gradove sa drugim aplikacijama i našom").
 *
 * PRAVILO SUĐENJA, da se ne bira mjera koja nam odgovara: sudi METAR —
 * opažanje na aerodromu (čovjek ili automatska postaja), s pojavom
 * (RA/DZ/SHRA/TSRA) i naoblakom u oktama. Tuđa aplikacija NIJE dokaz
 * točnosti (vidi odluku „tuđa aplikacija nije ground truth"): na Splitu
 * smo se 11.9. složili s vrijemeradar.hr i OBOJE bili u krivu.
 *
 * Usporedba ide na dvije stvari koje METAR stvarno mjeri:
 *   1. PADA LI (pojava u METAR-u)
 *   2. NAOBLAKA (okte → postotak)
 *
 * Sudionici:
 *   NAŠA APP    radarski sudac (`judgeCurrentCode`) + ECMWF naoblaka
 *   WeatherAPI  `current.condition` + `current.cloud`
 *   yr.no       simbol + `cloud_area_fraction`
 *   ECMWF sam   model bez sudca — pokazuje što sudac DODAJE
 *
 * POKRETANJE:
 *   node scripts/compare-apps.mjs
 *   node scripts/compare-apps.mjs --max 30
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const MAX = Number(arg('max', 24));

const BUILD = [];
function build(n, src, tr = (s) => s) {
  const ts = `src/api/.apps-${n}.ts`, mjs = `.apps-${n}.mjs`;
  writeFileSync(ts, tr(readFileSync(src, 'utf8')));
  execSync(`npx esbuild ${ts} --format=esm --outfile=${mjs} --log-level=error`, { stdio: 'inherit' });
  BUILD.push(ts, mjs);
  return pathToFileURL(resolve(mjs)).href;
}
process.on('exit', () => BUILD.forEach((f) => existsSync(f) && rmSync(f)));
const withFetch = (s) =>
  'const fetchBytes = async (u) => { const r = await fetch(u);'
  + ' if (!r.ok) throw new Error("HTTP " + r.status);'
  + ' return new Uint8Array(await r.arrayBuffer()); };\n'
  + s.split('\n').filter((l) => !l.includes('./client')).join('\n');
const RS = await import(build('rs', 'src/api/radarSample.ts', withFetch));
const RJ = await import(build('rj', 'src/utils/radarJudge.ts', (s) => s.replace(/import type[^;]*;/, '')));

const KEY = (readFileSync('.env', 'utf8').match(/EXPO_WEATHER_API_KEY=(.+)/) || [])[1]?.trim();
const UA = { headers: { 'User-Agent': 'burin-weather/1.0 github.com/mprtenjaca/burin' } };
const isWet = (wx) => /(^|\s)(-|\+)?(SH|TS|FZ)?(RA|DZ|SN|GR|GS|PL|SG)/.test(String(wx || ''));

// ---- METAR: istina ----
const mr = await fetch('https://aviationweather.gov/api/data/metar?bbox=36,-12,62,30&format=json&hours=1');
const metars = await mr.json();
const seen = new Map();
for (const m of metars) if (!seen.has(m.icaoId)) seen.set(m.icaoId, m);
const all = [...seen.values()].filter((m) => /OVC|BKN|SCT|FEW|SKC|CLR|NCD|CAVOK/.test(String(m.rawOb || '')));
// pola mokrih, pola suhih — inače uzorak povuče prema suhom
const wetSt = all.filter((m) => isWet(m.wxString)).slice(0, Math.ceil(MAX / 2));
const drySt = all.filter((m) => !m.wxString).slice(0, Math.floor(MAX / 2));
const sample = [...wetSt, ...drySt];
console.log(`METAR postaja: ${all.length}   uzorak: ${wetSt.length} mokrih + ${drySt.length} suhih`);

// ---- radar okviri ----
const maps = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
const past = maps.radar?.past || [];
const frame = past[past.length - 1], prev = past[past.length - 2];
const HOST = 'https://tilecache.rainviewer.com';
console.log(`radarski okvir: ${new Date(frame.time * 1000).toISOString().slice(11, 16)} UTC`);

// ---- ECMWF za sve točke ----
const lats = sample.map((m) => m.lat).join(','), lons = sample.map((m) => m.lon).join(',');
const om = await (await fetch(
  `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}`
  + `&current=weather_code,cloud_cover,precipitation,temperature_2m&timezone=UTC`
  + `&models=ecmwf_ifs025`)).json();
const omList = Array.isArray(om) ? om : [om];

const octa = (raw) => {
  if (/OVC/.test(raw)) return 100;
  if (/BKN/.test(raw)) return 75;
  if (/SCT/.test(raw)) return 45;
  if (/FEW/.test(raw)) return 20;
  return 0;
};

const score = { app: { wet: 0, dry: 0, cloud: 0, n: 0 }, wapi: { wet: 0, dry: 0, cloud: 0, n: 0 },
  yr: { wet: 0, dry: 0, cloud: 0, n: 0 }, ecmwf: { wet: 0, dry: 0, cloud: 0, n: 0 } };
const rows = [];

for (let i = 0; i < sample.length; i++) {
  const m = sample[i];
  const truthWet = isWet(m.wxString);
  const truthCloud = octa(String(m.rawOb || ''));
  const cur = omList[i]?.current;
  if (!cur) continue;

  // NAŠA APP: radarski sudac
  const covered = await RS.fetchRadarCoverage(HOST, m.lat, m.lon).catch(() => undefined);
  const echo = await RS.fetchRadarEcho(HOST, frame, m.lat, m.lon).catch(() => undefined);
  const prevEcho = prev ? await RS.fetchRadarEcho(HOST, prev, m.lat, m.lon).catch(() => undefined) : undefined;
  const judged = RJ.judgeCurrentCode({
    stationCode: undefined, stationAgeMin: undefined, stationDistanceKm: undefined,
    modelCode: cur.weather_code, cloudCover: cur.cloud_cover, temp: cur.temperature_2m,
    echo, prevEcho, covered: covered !== false, nowMs: Date.now(),
  });
  const appWet = RJ.isPrecip(judged.code);

  // WeatherAPI
  let wapiWet = null, wapiCloud = null;
  if (KEY) {
    try {
      const w = await (await fetch(`https://api.weatherapi.com/v1/current.json?key=${KEY}&q=${m.lat},${m.lon}`)).json();
      wapiWet = /rain|drizzle|snow|sleet|thunder|shower/i.test(w.current?.condition?.text || '');
      wapiCloud = w.current?.cloud;
    } catch { /* preskoči */ }
  }

  // yr.no
  let yrWet = null, yrCloud = null;
  try {
    const y = await (await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${m.lat}&lon=${m.lon}`, UA)).json();
    const d = y.properties.timeseries[0].data;
    yrCloud = d.instant.details.cloud_area_fraction;
    yrWet = (d.next_1_hours?.details?.precipitation_amount ?? 0) > 0;
  } catch { /* preskoči */ }

  const ecWet = RJ.isPrecip(cur.weather_code);

  const add = (k, wet, cloud) => {
    if (wet === null) return;
    score[k].n++;
    if (wet === truthWet) { if (truthWet) score[k].wet++; else score[k].dry++; }
    if (cloud !== null && cloud !== undefined) score[k].cloud += Math.abs(cloud - truthCloud);
  };
  add('app', appWet, cur.cloud_cover);
  add('wapi', wapiWet, wapiCloud);
  add('yr', yrWet, yrCloud);
  add('ecmwf', ecWet, cur.cloud_cover);

  rows.push({ id: m.icaoId, wx: m.wxString || 'suho', truthWet, truthCloud,
    appWet, wapiWet, yrWet, ecWet, dbz: echo?.maxDbz ?? null, src: judged.source });
}

console.log();
console.log('postaja  mjereno      | NAŠA  WAPI   yr  ECMWF | radar');
for (const r of rows) {
  const mark = (v) => (v === null ? ' ?  ' : v === r.truthWet ? ' ok ' : ' NE ');
  console.log(
    `${r.id.padEnd(8)} ${String(r.wx).padEnd(12)} |${mark(r.appWet)}${mark(r.wapiWet)}${mark(r.yrWet)}${mark(r.ecWet)} | `
    + `${String(r.dbz ?? '-').padStart(3)} dBZ ${r.src}`,
  );
}

const nWet = rows.filter((r) => r.truthWet).length, nDry = rows.length - nWet;
console.log();
console.log(`=== PADA LI — protiv METAR opažanja (${nWet} mokrih, ${nDry} suhih) ===`);
for (const [k, label] of [['app', 'NAŠA APP  '], ['wapi', 'WeatherAPI'], ['yr', 'yr.no     '], ['ecmwf', 'ECMWF sam ']]) {
  const s = score[k];
  if (!s.n) { console.log(`  ${label} (nema podataka)`); continue; }
  const hit = s.wet + s.dry;
  console.log(`  ${label} točno ${String(hit).padStart(2)}/${s.n}  (${Math.round((100 * hit) / s.n)} %)`
    + `   uhvaćena kiša ${s.wet}/${nWet}   suho ${s.dry}/${nDry}`);
}
console.log();
console.log('=== NAOBLAKA — srednja greška prema METAR oktama ===');
for (const [k, label] of [['app', 'NAŠA (ECMWF)'], ['wapi', 'WeatherAPI  '], ['yr', 'yr.no       ']]) {
  const s = score[k];
  if (s.n) console.log(`  ${label} ${(s.cloud / s.n).toFixed(1)} %`);
}
