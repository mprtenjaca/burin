/**
 * SKUPLJANJE DATASETA za vlastiti model (11.9.2026., Markov zahtjev:
 * „da moramo napraviti ovako čak i svoj model koji će bit još točniji").
 *
 * Zašto ovo, a ne odmah ML: današnja mjerenja pokazala su tri problema
 * koje deterministički pragovi NE MOGU riješiti, jer traže da se nauči
 * veza radar→tlo, a ona ovisi o terenu:
 *
 *   1. Radar mjeri u ZRAKU, tlo je drugo. Split 11.9.: jezgra 49 dBZ nad
 *      Klisom i nad morem, a na Rivi ljudi bez kišobrana (Markov nalaz s
 *      kamere). Mosor (1300 m) sistematski daje jače odjeke od obale.
 *   2. Slaba kiša je NEVIDLJIVA: od 24 propuštene kiše u austrijskom
 *      replayu, 20 je imalo 0 dBZ. Rješenje nije prag nego drugi featurei
 *      (vlaga, temperatura, vjetar), a njihove težine treba NAUČITI.
 *   3. Orografski clutter po mjestu: Polača i Pridraga lažu sistematski.
 *      Model to može naučiti kao svojstvo LOKACIJE; prag ne može.
 *
 * Jedan trenutak nije dovoljan za trening. Ova skripta zato sprema
 * featurese + istinu u append-only JSONL, pa se kroz TJEDNE nakupi
 * dataset preko raznih vremenskih situacija.
 *
 * POKRETANJE (ručno ili iz zakazanog zadatka svakih 10 min):
 *   node scripts/collect-dataset.mjs
 *   node scripts/collect-dataset.mjs --out data/radar-dataset.jsonl
 *   node scripts/collect-dataset.mjs --region hr    # samo Hrvatska
 *   node scripts/collect-dataset.mjs --region at    # samo Austrija (mm!)
 *
 * ISTINA (ground truth), po kvaliteti:
 *   AT  GeoSphere `tawes-v1-10min`, RR = mm/10 min  → NAJBOLJE, brojka
 *   HR  DHMZ `hrvatska_n.xml`, tekst stanja, satno  → slabije, ali JEDINO
 *       za Dalmaciju i jedino gdje se vidi orografski clutter
 *
 * Dataset je JSONL (jedan red = jedno mjesto u jednom trenutku), pa se
 * lako čita u pandas/LightGBM i lako dopunjava bez ponovnog pisanja.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const OUT = arg('out', 'data/radar-dataset.jsonl');
const REGION = arg('region', 'both');
const AT_STATIONS = Number(arg('at-stations', 200));

const BUILD = [];
function build(name, src, transform = (s) => s) {
  const ts = `.ds-${name}.ts`;
  const mjs = `.ds-${name}.mjs`;
  writeFileSync(ts, transform(readFileSync(src, 'utf8')));
  execSync(`npx esbuild ${ts} --format=esm --outfile=${mjs} --log-level=error`, { stdio: 'inherit' });
  BUILD.push(ts, mjs);
  return pathToFileURL(resolve(mjs)).href;
}
process.on('exit', () => BUILD.forEach((f) => existsSync(f) && rmSync(f)));

const RS = await import(
  build('rs', 'src/api/radarSample.ts', (s) =>
    s.split('\n').filter((l) => !l.includes('./client')).join('\n')
      .replace(/export async function fetch[\s\S]*?\n}\n/g, ''))
);
const RF = await import(build('rf', 'src/utils/radarFeatures.ts', (s) => s.replace(/import type[^;]*;/, '')));
const wc = readFileSync('src/utils/weatherCodes.ts', 'utf8');
const wcStart = wc.indexOf('export function dhmzTextToCode');
const WC = await import(build('wc', 'src/utils/weatherCodes.ts', () => wc.slice(wcStart, wc.indexOf('\n}', wcStart) + 2)));

// ---- radar ----
const rv = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
const HOST = rv.host;
const FRAMES = rv.radar.past.slice(-6);
const getBytes = async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer());
const tileCache = new Map();
async function tile(path, tx, ty) {
  const k = `${path}/${tx}/${ty}`;
  if (!tileCache.has(k)) tileCache.set(k, RS.decodePng(await getBytes(RS.tileUrl(HOST, path, RS.RAINVIEWER_ZOOM, tx, ty, 2))));
  return tileCache.get(k);
}
async function sample(frame, lat, lon) {
  const z = RS.RAINVIEWER_ZOOM;
  const { gx, gy } = RS.pointToGlobalPixel(lat, lon, z);
  const rpx = RS.kmToPixels(RS.SAMPLE_RADIUS_KM, lat, z);
  const t = new Map();
  for (const q of RS.tilesCovering(gx, gy, rpx)) t.set(`${q.tx}/${q.ty}`, await tile(frame.path, q.tx, q.ty));
  return { ...RS.sampleStats(t, gx, gy, rpx, RS.dbzFromUniversalBlue, RS.kmPerPixel(lat, z)), frameTime: frame.time };
}
const covCache = new Map();
async function covered(lat, lon) {
  const z = RS.RAINVIEWER_ZOOM;
  const { gx, gy } = RS.pointToGlobalPixel(lat, lon, z);
  const c = RS.tileOf(gx, gy);
  const k = `${c.tx}/${c.ty}`;
  if (!covCache.has(k)) {
    try { covCache.set(k, RS.decodePng(await getBytes(RS.coverageTileUrl(HOST, c.tx, c.ty)))); }
    catch { covCache.set(k, null); }
  }
  const img = covCache.get(k);
  return img ? RS.isCoveredPixel(img, gx, gy) : false;
}

// ---- istina: Austrija (mm/10 min) ----
const GEO = 'https://dataset.api.hub.geosphere.at/v1/station/historical/tawes-v1-10min';
async function austria() {
  if (REGION === 'hr') return [];
  try {
    const md = await (await fetch(`${GEO}/metadata`)).json();
    const ids = md.stations.slice(0, AT_STATIONS).map((s) => s.id);
    const end = new Date(Date.now() - 20 * 60000).toISOString().slice(0, 16);
    const start = new Date(Date.now() - 80 * 60000).toISOString().slice(0, 16);
    const j = await (await fetch(`${GEO}?parameters=RR&station_ids=${ids.join(',')}&start=${start}&end=${end}&output_format=geojson`)).json();
    const out = [];
    for (const f of j.features || []) {
      const data = f.properties.parameters.RR?.data || [];
      const last = [...data].reverse().find((v) => v !== null);
      if (last === undefined) continue;
      out.push({
        id: `AT:${f.properties.station}`, country: 'AT',
        lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
        truth: { wet: last > 0, mmPer10: last, mmh: last * 6, kind: 'gauge' },
      });
    }
    return out;
  } catch { return []; }
}

// ---- istina: Hrvatska (DHMZ tekst) ----
async function croatia() {
  if (REGION === 'at') return [];
  try {
    const xml = await (await fetch('https://vrijeme.hr/hrvatska_n.xml')).text();
    const term = Number(xml.match(/<Termin>(.*?)<\/Termin>/)[1]);
    const tt = new Date(); tt.setHours(term, 0, 0, 0);
    const ageMin = (Date.now() - tt.getTime()) / 60000;
    const out = [];
    for (const m of xml.matchAll(/<Grad[^>]*>([\s\S]*?)<\/Grad>/g)) {
      const g = m[1];
      const name = g.match(/<GradIme>(.*?)<\/GradIme>/)[1].trim();
      const text = g.match(/<Vrijeme>(.*?)<\/Vrijeme>/)[1].trim();
      const code = WC.dhmzTextToCode(text);
      // Postaje koje o oborini ne govore ("lahor", "-") nisu istina ni u
      // jednu stranu — preskaču se, da se suho ne izmisli iz tišine.
      if (code === undefined) continue;
      const wet = (code >= 51 && code <= 67) || (code >= 71 && code <= 86) || (code >= 95 && code <= 99);
      out.push({
        id: `HR:${name}`, country: 'HR',
        lat: parseFloat(g.match(/<Lat>(.*?)<\/Lat>/)[1]),
        lon: parseFloat(g.match(/<Lon>(.*?)<\/Lon>/)[1]),
        truth: { wet, mmPer10: null, mmh: null, kind: 'text', text, code, ageMin },
        station: {
          temp: Number(g.match(/<Temp>(.*?)<\/Temp>/)[1]) || null,
          humidity: Number(g.match(/<Vlaga>(.*?)<\/Vlaga>/)[1]) || null,
          pressure: Number(g.match(/<Tlak>(.*?)<\/Tlak>/)[1]) || null,
          windSpeed: Number(g.match(/<VjetarBrzina>(.*?)<\/VjetarBrzina>/)[1]) || null,
        },
      });
    }
    return out;
  } catch { return []; }
}

const sites = [...(await austria()), ...(await croatia())];
console.log(`mjesta s istinom: ${sites.length} (AT ${sites.filter((s) => s.country === 'AT').length}, HR ${sites.filter((s) => s.country === 'HR').length})`);

// ---- model, u serijama od 50 ----
async function models(list) {
  const out = [];
  for (let i = 0; i < list.length; i += 50) {
    const b = list.slice(i, i + 50);
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${b.map((p) => p.lat).join(',')}` +
        `&longitude=${b.map((p) => p.lon).join(',')}` +
        `&current=weather_code,cloud_cover,temperature_2m,relative_humidity_2m,precipitation,` +
        `wind_speed_10m,wind_direction_10m,pressure_msl&models=ecmwf_ifs025`;
      const r = await (await fetch(u)).json();
      out.push(...(Array.isArray(r) ? r : [r]).map((e) => e.current));
    } catch { out.push(...b.map(() => null)); }
  }
  return out;
}
const mods = await models(sites);

// ---- složi redove ----
const nowIso = new Date().toISOString();
const rows = [];
let skipped = 0;

for (let i = 0; i < sites.length; i++) {
  const s = sites[i];
  const cur = mods[i];
  if (!cur) { skipped++; continue; }
  const cov = await covered(s.lat, s.lon);
  if (!cov) { skipped++; continue; }

  const series = [];
  for (const f of FRAMES) series.push(await sample(f, s.lat, s.lon));
  const newest = series.at(-1);
  const temporal = RF.radarTemporal(series, series.map((x) => x.centroid));
  const clutter = RF.clutterScore(newest, temporal);

  rows.push({
    // ---- identitet ----
    collectedAt: nowIso,
    frameTime: newest.frameTime,
    siteId: s.id,
    country: s.country,
    lat: s.lat,
    lon: s.lon,
    // ---- radar: prostorni featurei ----
    radar_max: newest.maxDbz,
    radar_mean: newest.meanDbz,
    radar_median: newest.medianDbz,
    radar_p75: newest.p75Dbz,
    radar_p90: newest.p90Dbz,
    radar_p95: newest.p95Dbz,
    radar_wmean: newest.weightedMeanDbz,
    radar_coverage20: newest.coverage20,
    radar_coverage28: newest.coverage28,
    radar_coverage40: newest.coverage40,
    radar_coverage55: newest.coverage55,
    radar_wcoverage20: newest.weightedCoverage20,
    radar_cover_px: newest.coverPixels,
    radar_echo_px: newest.echoPixels,
    radar_centroid_x_km: newest.centroid?.xKm ?? null,
    radar_centroid_y_km: newest.centroid?.yKm ?? null,
    // ---- radar: temporalni featurei ----
    radar_persistence: temporal.persistence,
    radar_echo_age_min: temporal.echoAgeMin,
    radar_trend_dbz_h: temporal.trendDbzPerHour,
    radar_jitter: temporal.jitterDbz,
    radar_speed_kmh: temporal.speedKmh,
    radar_from_dir_deg: temporal.fromDirDeg,
    radar_motion_conf: temporal.motionConfidence,
    radar_clutter_score: clutter,
    radar_frames: temporal.frames,
    // ---- postaja (samo HR; AT nema tekst) ----
    station_temp: s.station?.temp ?? null,
    station_humidity: s.station?.humidity ?? null,
    station_pressure: s.station?.pressure ?? null,
    station_wind: s.station?.windSpeed ?? null,
    station_code: s.truth.code ?? null,
    station_age_min: s.truth.ageMin ?? null,
    // ---- model ----
    model_code: cur.weather_code ?? null,
    model_cloud_cover: cur.cloud_cover ?? null,
    model_temp: cur.temperature_2m ?? null,
    model_humidity: cur.relative_humidity_2m ?? null,
    model_precip: cur.precipitation ?? null,
    model_wind: cur.wind_speed_10m ?? null,
    model_wind_dir: cur.wind_direction_10m ?? null,
    model_pressure: cur.pressure_msl ?? null,
    // ---- ISTINA ----
    truth_wet: s.truth.wet,
    truth_mm_per_10min: s.truth.mmPer10,
    truth_mmh: s.truth.mmh,
    truth_kind: s.truth.kind,
    truth_text: s.truth.text ?? null,
  });
}

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
appendFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

const wet = rows.filter((r) => r.truth_wet).length;
console.log(`zapisano ${rows.length} redaka (mokrih ${wet}, suhih ${rows.length - wet}); preskoceno ${skipped} (bez radara/modela)`);
console.log(`-> ${OUT}`);

// Kratak pregled: ukupno u datasetu do sada
try {
  const all = readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean);
  const times = new Set(all.map((l) => JSON.parse(l).collectedAt));
  const w = all.filter((l) => JSON.parse(l).truth_wet).length;
  console.log(`\ndataset ukupno: ${all.length} redaka, ${times.size} trenutaka, ${w} mokrih (${Math.round((100 * w) / all.length)}%)`);
  console.log('za trening treba nekoliko TJEDANA i vise vremenskih situacija — jedan dan nije dovoljan');
} catch {}
