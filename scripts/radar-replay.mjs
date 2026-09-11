/**
 * REPLAY / EVALUACIJA radarskog sudca (11.9.2026.).
 *
 * Vrti V1 i V2 na ISTIM ulazima protiv MJERENJA NA TLU i ispisuje tablicu
 * promašaja. Bez ovoga se ne smije tvrditi da je V2 bolji — pragovi su
 * 10.9. baždareni upravo na ovom izvoru, a 11.9. se pokazalo da su
 * baždareni samo u jednom smjeru (protiv lažne kiše, ne protiv propuštene).
 *
 * GROUND TRUTH: GeoSphere Austria, `tawes-v1-10min`, parametar `RR` —
 * milimetri u zadnjih 10 minuta, 288 postaja, isti ritam kao radarski
 * okviri. To je jedini otvoreni izvor koji stvarno mjeri PADA LI NA TLU:
 *   - DHMZ daje samo tekst, satno, 46 postaja (nema mm)
 *   - Open-Meteo je model, ne mjerenje
 * Austrija nije Dalmacija i to je poznato ograničenje — za dalmatinski
 * clutter služe ručni slučajevi u `radarJudge.test.ts` (Metković, Polača).
 *
 * POKRETANJE:
 *   node scripts/radar-replay.mjs              # zadnjih ~40 min
 *   node scripts/radar-replay.mjs --frames 6   # više okvira po postaji
 *   node scripts/radar-replay.mjs --stations 120
 *   node scripts/radar-replay.mjs --save out.json   # dataset za ML
 *
 * Skripta NE pipa aplikaciju — uvozi iste module koje app koristi,
 * prevedene esbuildom (React Native uvozi ne prolaze u čistom nodeu).
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const FRAMES = Number(arg('frames', 4));
const STATIONS = Number(arg('stations', 80));
const SAVE = arg('save', null);

// ---- prevedi module aplikacije za node ----
const BUILD = [];
function build(name, src, transform = (s) => s) {
  const ts = `.replay-${name}.ts`;
  const mjs = `.replay-${name}.mjs`;
  writeFileSync(ts, transform(readFileSync(src, 'utf8')));
  execSync(`npx esbuild ${ts} --format=esm --outfile=${mjs} --log-level=error`, { stdio: 'inherit' });
  BUILD.push(ts, mjs);
  // Apsolutni URL: skripta je u scripts/, a build ide u korijen repoa.
  return pathToFileURL(resolve(mjs)).href;
}
const cleanup = () => BUILD.forEach((f) => existsSync(f) && rmSync(f));
process.on('exit', cleanup);

const stripClient = (s) =>
  s.split('\n').filter((l) => !l.includes('./client')).join('\n')
    .replace(/export async function fetch[\s\S]*?\n}\n/g, '');

const RS = await import(build('rs', 'src/api/radarSample.ts', stripClient));
const RJ = await import(build('rj', 'src/utils/radarJudge.ts', (s) => s.replace(/import type[^;]*;/, '')));
const RF = await import(build('rf', 'src/utils/radarFeatures.ts', (s) => s.replace(/import type[^;]*;/, '')));
// V2 uvozi radarJudge; preusmjeri na već prevedeni modul u korijenu.
const V2 = await import(
  build('v2', 'src/utils/currentWeatherV2.ts', (src) =>
    src
      .split('\n')
      .filter((l) => !l.startsWith('import type'))
      .join('\n')
      .replace('@/utils/radarJudge', './.replay-rj.mjs'),
  )
);

// ---- ground truth: austrijske postaje, mm/10 min ----
const GEO = 'https://dataset.api.hub.geosphere.at/v1/station/historical/tawes-v1-10min';

async function groundTruth() {
  const md = await (await fetch(`${GEO}/metadata`)).json();
  const ids = md.stations.slice(0, STATIONS).map((s) => s.id);
  const end = new Date(Date.now() - 20 * 60000).toISOString().slice(0, 16);
  const start = new Date(Date.now() - (20 + FRAMES * 10) * 60000).toISOString().slice(0, 16);
  const u = `${GEO}?parameters=RR&station_ids=${ids.join(',')}&start=${start}&end=${end}&output_format=geojson`;
  const j = await (await fetch(u)).json();
  const times = (j.timestamps || []).map((t) => Math.floor(new Date(t).getTime() / 1000));
  const out = [];
  for (const f of j.features || []) {
    const data = f.properties.parameters.RR?.data || [];
    const last = [...data].reverse().find((v) => v !== null);
    if (last === undefined) continue;
    out.push({
      name: f.properties.station,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      // mm u zadnjih 10 min → mm/h
      mmPer10: last,
      mmh: last * 6,
      wet: last > 0,
    });
  }
  return { stations: out, times };
}

// ---- radar ----
const rv = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
const HOST = rv.host;
const frames = rv.radar.past.slice(-FRAMES);
const getBytes = async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer());

const tileCache = new Map();
async function tile(framePath, tx, ty) {
  const key = `${framePath}/${tx}/${ty}`;
  if (!tileCache.has(key)) {
    tileCache.set(key, RS.decodePng(await getBytes(RS.tileUrl(HOST, framePath, RS.RAINVIEWER_ZOOM, tx, ty, 2))));
  }
  return tileCache.get(key);
}

async function sampleFrame(frame, lat, lon) {
  const z = RS.RAINVIEWER_ZOOM;
  const { gx, gy } = RS.pointToGlobalPixel(lat, lon, z);
  const radiusPx = RS.kmToPixels(RS.SAMPLE_RADIUS_KM, lat, z);
  const tiles = new Map();
  for (const t of RS.tilesCovering(gx, gy, radiusPx)) {
    tiles.set(`${t.tx}/${t.ty}`, await tile(frame.path, t.tx, t.ty));
  }
  const stats = RS.sampleStats(tiles, gx, gy, radiusPx, RS.dbzFromUniversalBlue, RS.kmPerPixel(lat, z));
  return { ...stats, frameTime: frame.time };
}

const coverCache = new Map();
async function covered(lat, lon) {
  const z = RS.RAINVIEWER_ZOOM;
  const { gx, gy } = RS.pointToGlobalPixel(lat, lon, z);
  const c = RS.tileOf(gx, gy);
  const key = `${c.tx}/${c.ty}`;
  if (!coverCache.has(key)) {
    try {
      coverCache.set(key, RS.decodePng(await getBytes(RS.coverageTileUrl(HOST, c.tx, c.ty))));
    } catch { coverCache.set(key, null); }
  }
  const img = coverCache.get(key);
  return img ? RS.isCoveredPixel(img, gx, gy) : false;
}

// ---- pokreni ----
console.log('REPLAY radarskog sudca protiv MJERENJA NA TLU');
console.log(`ground truth: GeoSphere Austria tawes-v1-10min (RR, mm/10min)`);
console.log(`okviri: ${FRAMES} × 10 min, zadnji ${new Date(frames.at(-1).time * 1000).toISOString().slice(11, 16)} UTC`);

const gt = await groundTruth();
console.log(`postaja s mjerenjem: ${gt.stations.length} (mokrih: ${gt.stations.filter((s) => s.wet).length})\n`);

const nowMs = frames.at(-1).time * 1000 + 3 * 60000; // kao da je 3 min nakon okvira
const rows = [];

for (const st of gt.stations) {
  const cov = await covered(st.lat, st.lon);
  if (!cov) continue;

  const series = [];
  for (const f of frames) series.push(await sampleFrame(f, st.lat, st.lon));
  const newest = series.at(-1);
  const prev = series.at(-2);

  const temporal = RF.radarTemporal(series, series.map((s) => s.centroid));
  const clutter = RF.clutterScore(newest, temporal);

  // V1: odlučuje iz maxDbz + coverage + prethodni okvir, bez postaje
  // (austrijske postaje nisu u DHMZ feedu) i bez modela.
  const v1 = RJ.judgeCurrentCode({
    stationCode: undefined, stationAgeMin: Infinity, stationDistanceKm: undefined,
    modelCode: 3, cloudCover: 100, temp: 15,
    echo: { maxDbz: newest.maxDbz, frameTime: newest.frameTime, radiusKm: RS.SAMPLE_RADIUS_KM,
            echoPixels: newest.echoPixels, coverPixels: newest.coverPixels },
    prevEcho: prev && { maxDbz: prev.maxDbz, frameTime: prev.frameTime, radiusKm: RS.SAMPLE_RADIUS_KM,
                        echoPixels: prev.echoPixels, coverPixels: prev.coverPixels },
    covered: true, nowMs,
  });

  const v2 = V2.judgeCurrentCodeV2({
    radar: { stats: newest, temporal, clutterScore: clutter, frameTime: newest.frameTime },
    covered: true,
    station: undefined,
    model: { code: 3, cloudCover: 100, ageMin: 120 },
    temp: 15, nowMs,
  });

  rows.push({
    station: st.name, lat: st.lat, lon: st.lon,
    truth: { wet: st.wet, mmPer10: st.mmPer10, mmh: st.mmh },
    stats: newest, temporal, clutter,
    v1: { code: v1.code, precip: RJ.isPrecip(v1.code), source: v1.source },
    v2: { code: v2.code, precip: v2.precipitation, conf: v2.precipitationConfidence,
          source: v2.source, intensity: v2.precipitationIntensity,
          flags: v2.diagnostics.flags, reason: v2.diagnostics.reason },
  });
}

// ---- izvještaj ----
const p = (n) => String(n).padStart(3);
const pct = (x) => String(Math.round(100 * x)).padStart(3) + '%';

console.log('postaja           tlo mm/h  max  p90 cov20  pers  clut | V1    V2   conf');
for (const r of rows.slice(0, 40)) {
  console.log(
    r.station.slice(0, 20).padEnd(21),
    (r.truth.wet ? r.truth.mmh.toFixed(1) : '0').padStart(7),
    p(r.stats.maxDbz ?? 0),
    p(Math.round(r.stats.p90Dbz ?? 0)),
    pct(r.stats.coverage20),
    pct(r.temporal.persistence),
    pct(r.clutter),
    pct(r.temporal.motionConfidence),
    '|', (r.v1.precip ? 'PADA' : 'suho'),
    (r.v2.precip ? 'PADA' : 'suho'),
    r.v2.conf.toFixed(2),
    (r.truth.wet === r.v1.precip ? '  ' : ' V1x') + (r.truth.wet === r.v2.precip ? '' : ' V2x'),
  );
}

const tally = (pick) => ({
  tp: rows.filter((r) => r.truth.wet && pick(r)).length,
  tn: rows.filter((r) => !r.truth.wet && !pick(r)).length,
  fp: rows.filter((r) => !r.truth.wet && pick(r)).length,
  fn: rows.filter((r) => r.truth.wet && !pick(r)).length,
});

function report(name, t) {
  const rec = t.tp + t.fn ? t.tp / (t.tp + t.fn) : 0;
  const spec = t.tn + t.fp ? t.tn / (t.tn + t.fp) : 0;
  const prec = t.tp + t.fp ? t.tp / (t.tp + t.fp) : 0;
  const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  const pc = (x) => `${Math.round(100 * x)}%`.padStart(4);
  console.log(
    `  ${name.padEnd(3)} mokro ${pc(rec)}  suho ${pc(spec)}  tocnost ${pc(prec)}  F1 ${f1.toFixed(3)}` +
      `   TP ${String(t.tp).padStart(2)} TN ${String(t.tn).padStart(3)} FP ${String(t.fp).padStart(2)} FN ${String(t.fn).padStart(2)}`,
  );
}

console.log(`\n=== V1 vs V2 protiv MJERENJA NA TLU (${rows.length} postaja pod radarom) ===`);
report('V1', tally((r) => r.v1.precip));
report('V2', tally((r) => r.v2.precip));

const diff = rows.filter((r) => r.v1.precip !== r.v2.precip);
const v2wins = diff.filter((r) => r.truth.wet === r.v2.precip).length;
console.log(`\n  razlika V1/V2: ${diff.length} postaja  ->  V2 u pravu: ${v2wins}, V1 u pravu: ${diff.length - v2wins}`);
if (diff.length) {
  console.log('\n  gdje se razilaze:');
  console.log('  tlo mm/h  max  p90  cov20  pers  clut | V1    V2   conf  tko je u pravu');
  for (const r of diff.slice(0, 20)) {
    console.log(
      '   ',
      (r.truth.wet ? r.truth.mmh.toFixed(1) : '0').padStart(6),
      String(r.stats.maxDbz ?? 0).padStart(4),
      String(Math.round(r.stats.p90Dbz ?? 0)).padStart(4),
      `${Math.round(100 * r.stats.coverage20)}%`.padStart(5),
      `${Math.round(100 * r.temporal.persistence)}%`.padStart(5),
      `${Math.round(100 * r.clutter)}%`.padStart(5),
      '|', r.v1.precip ? 'PADA' : 'suho',
      r.v2.precip ? 'PADA' : 'suho',
      r.v2.conf.toFixed(2),
      ' ', r.truth.wet === r.v2.precip ? 'V2' : 'V1',
    );
  }
}

// Koje featurese razlikuju mokro od suhog — temelj za buduce pragove i ML.
const avg = (xs, f) => (xs.length ? xs.reduce((a, x) => a + (f(x) ?? 0), 0) / xs.length : 0);
const wetRows = rows.filter((r) => r.truth.wet);
const dryRows = rows.filter((r) => !r.truth.wet);
console.log(`\n=== Featurei: MOKRE (${wetRows.length}) vs SUHE (${dryRows.length}) postaje ===`);
console.log('feature            mokro    suho');
for (const [name, f] of [
  ['maxDbz', (r) => r.stats.maxDbz],
  ['p90Dbz', (r) => r.stats.p90Dbz],
  ['medianDbz', (r) => r.stats.medianDbz],
  ['weightedMean', (r) => r.stats.weightedMeanDbz],
  ['coverage20', (r) => 100 * r.stats.coverage20],
  ['coverage28', (r) => 100 * r.stats.coverage28],
  ['wCoverage20', (r) => 100 * r.stats.weightedCoverage20],
  ['persistence', (r) => 100 * r.temporal.persistence],
  ['echoAgeMin', (r) => r.temporal.echoAgeMin],
  ['jitterDbz', (r) => r.temporal.jitterDbz],
  ['clutterScore', (r) => 100 * r.clutter],
  ['motionConf', (r) => 100 * r.temporal.motionConfidence],
]) {
  console.log(name.padEnd(18), avg(wetRows, f).toFixed(1).padStart(6), avg(dryRows, f).toFixed(1).padStart(7));
}

if (SAVE) {
  writeFileSync(SAVE, JSON.stringify({ generatedAt: new Date().toISOString(), frames: frames.map((f) => f.time), rows }, null, 2));
  console.log(`\ndataset zapisan: ${SAVE} (${rows.length} redaka)`);
}
