/**
 * PROVJERA NA PRAVOJ KIŠI (12.9.2026., Markov zahtjev: „di danas pada
 * kiša nađi mi to i usporedi sa vrijeme i radar").
 *
 * `radar-replay.mjs` mjeri protiv austrijskih kišomjera — ali kad je nad
 * Austrijom suho (kao 12.9.), on dokazuje samo da app ne izmišlja kišu.
 * Ova skripta radi drugu polovicu: NAĐE gdje u Europi kiša stvarno pada
 * SADA, pa ondje pusti sudca i usporedi s mjerenjem na tlu.
 *
 * Ground truth po kvaliteti (isto kao u replayu):
 *   met.no `locationforecast` — model, SAMO za nalaženje kandidata
 *   GeoSphere AT `RR` mm/10 min — mjerenje, ali samo Austrija
 *   METAR (aviationweather.gov) — MJERENJE s aerodroma, cijela Europa
 *
 * METAR je ovdje glavni izvor: to je ljudsko/automatsko opažanje na tlu,
 * globalno, sa šifrom pojave (RA, SHRA, TSRA, DZ, SN) i vremenom.
 *
 * POKRETANJE:
 *   node scripts/rain-check.mjs
 *   node scripts/rain-check.mjs --max 40
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const MAX = Number(arg('max', 30));

// ---- prevedi module aplikacije za node (isti postupak kao radar-replay) ----
const BUILD = [];
function build(name, src, transform = (s) => s) {
  const ts = `.rain-${name}.ts`;
  const mjs = `.rain-${name}.mjs`;
  writeFileSync(ts, transform(readFileSync(src, 'utf8')));
  execSync(`npx esbuild ${ts} --format=esm --outfile=${mjs} --log-level=error`, { stdio: 'inherit' });
  BUILD.push(ts, mjs);
  return pathToFileURL(resolve(mjs)).href;
}
process.on('exit', () => BUILD.forEach((f) => existsSync(f) && rmSync(f)));

/*
 * `radarSample.ts` uvozi `./client` (React Native `fetchBytes`). U nodeu
 * se taj uvoz zamjenjuje običnim fetchom — za razliku od `radar-replay`,
 * koji `fetch*` funkcije BRIŠE i sam slaže pločice. Ovdje nam trebaju
 * baš one (`fetchRadarEcho`, `fetchRadarCoverage`), jer se mjeri ono što
 * aplikacija stvarno zove.
 */
const stripClient = (s) =>
  s.split('\n').filter((l) => !l.includes('./client')).join('\n')
    .replace(
      /^/,
      'const fetchBytes = async (u) => {\n' +
      '  const r = await fetch(u);\n' +
      '  if (!r.ok) throw new Error("HTTP " + r.status);\n' +
      '  return new Uint8Array(await r.arrayBuffer());\n' +
      '};\n',
    );

const RS = await import(build('rs', 'src/api/radarSample.ts', stripClient));
const RJ = await import(build('rj', 'src/utils/radarJudge.ts', (s) => s.replace(/import type[^;]*;/, '')));

// ---- 1. NAĐI KIŠU: METAR opažanja s europskih aerodroma ----
// aviationweather.gov daje sve METAR-e u bboxu, bez ključa.
const METAR = 'https://aviationweather.gov/api/data/metar';
const bbox = '35,-10,62,30'; // lat0,lon0,lat1,lon1 (Europa)
const mr = await fetch(`${METAR}?bbox=${bbox}&format=json&hours=1`);
if (!mr.ok) { console.error('METAR HTTP', mr.status); process.exit(1); }
const metars = await mr.json();

// šifre pojave koje znače OBORINU NA TLU
const isWet = (m) => {
  const w = `${m.wxString || ''}`;
  return /(^|\s)(-|\+)?(SH)?(RA|DZ|SN|TS|GR|GS|PL|SG)/.test(w);
};
const wet = metars.filter(isWet);
const dry = metars.filter((m) => !isWet(m) && m.wxString == null);

console.log(`METAR opažanja u Europi (zadnji sat): ${metars.length}`);
console.log(`  s OBORINOM: ${wet.length}   bez pojave: ${dry.length}`);

// ---- 2. RADAR nad tim točkama, pa SUDAC ----
const HOST = 'https://tilecache.rainviewer.com';
const fr = await fetch('https://api.rainviewer.com/public/weather-maps.json');
const maps = await fr.json();
const past = maps.radar?.past || [];
const frame = past[past.length - 1];
const prev = past[past.length - 2];
if (!frame) { console.error('nema radarskih okvira'); process.exit(1); }
console.log(`radarski okvir: ${new Date(frame.time * 1000).toISOString()} (star ${Math.round((Date.now() / 1000 - frame.time) / 60)} min)`);

async function judgeAt(lat, lon) {
  const covered = await RS.fetchRadarCoverage(HOST, lat, lon).catch(() => undefined);
  if (covered === false) return { skip: 'nema radara' };
  const echo = await RS.fetchRadarEcho(HOST, frame, lat, lon).catch(() => undefined);
  if (!echo) return { skip: 'echo fail' };
  const prevEcho = prev ? await RS.fetchRadarEcho(HOST, prev, lat, lon).catch(() => undefined) : undefined;
  return { echo, prevEcho, covered: covered !== false };
}

const sample = [...wet.slice(0, MAX), ...dry.slice(0, MAX)];
const rows = [];
for (const m of sample) {
  const r = await judgeAt(m.lat, m.lon);
  if (r.skip) { rows.push({ m, skip: r.skip }); continue; }
  const judged = RJ.judgeCurrentCode({
    stationCode: undefined,          // METAR se NE daje sudcu: on je ISTINA
    stationAgeMin: undefined,
    stationDistanceKm: undefined,
    modelCode: 2,                    // neutralan model (oblačno)
    cloudCover: 60,
    temp: m.temp ?? 15,
    echo: r.echo,
    prevEcho: r.prevEcho,
    covered: r.covered,
    nowMs: Date.now(),
  });
  rows.push({ m, judged, echo: r.echo, truth: isWet(m) });
}

// ---- 3. TABLICA ----
console.log();
console.log('postaja        mjereno(METAR)      app kaze            dBZ  med  %   izvor');
let TP = 0, FP = 0, TN = 0, FN = 0;
for (const r of rows) {
  if (r.skip) continue;
  const says = RJ.isPrecip(r.judged.code);
  const truth = r.truth;
  if (truth && says) TP++; else if (!truth && says) FP++;
  else if (!truth && !says) TN++; else FN++;
  const pct = r.echo.coverPixels > 0 ? Math.round((100 * r.echo.echoPixels) / r.echo.coverPixels) : 0;
  const mark = truth === says ? ' ' : (says ? 'LAZNA' : 'PROPUST');
  console.log(
    `${(r.m.icaoId || '').padEnd(6)} ${(truth ? (r.m.wxString || 'RA') : 'suho').padEnd(12)} ` +
    `${String(r.judged.code).padStart(4)} ${(says ? 'PADA' : 'suho').padEnd(6)} ` +
    `${String(r.echo.maxDbz ?? '-').padStart(4)} ${String(r.echo.medianDbz ?? '-').padStart(4)} ${String(pct).padStart(3)}% ` +
    `${(r.judged.source || '').padEnd(8)} ${mark}`,
  );
}
const n = TP + FP + TN + FN;
console.log();
console.log('=== SUDAC protiv METAR MJERENJA ===');
console.log(`  mokrih ${TP + FN}, suhih ${TN + FP}  (ukupno ${n})`);
console.log(`  uhvacena kisa : ${TP}/${TP + FN}  (${TP + FN ? Math.round((100 * TP) / (TP + FN)) : 0} %)`);
console.log(`  LAZNA kisa    : ${FP}/${TN + FP}  (${TN + FP ? Math.round((100 * FP) / (TN + FP)) : 0} %)`);
const prec = TP + FP ? TP / (TP + FP) : 0, rec = TP + FN ? TP / (TP + FN) : 0;
console.log(`  preciznost ${prec.toFixed(2)}  odziv ${rec.toFixed(2)}  F1 ${prec + rec ? (2 * prec * rec / (prec + rec)).toFixed(3) : '0.000'}`);
