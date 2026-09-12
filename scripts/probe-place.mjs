/**
 * SONDA ZA JEDNO MJESTO (12.9.2026., Markov nalaz Budva/Danilovgrad).
 *
 * Kad Marko javi „za X mi kažemo A, a vrijemeradar kaže B", ovo ispisuje
 * SVE što sudac vidi nad tom točkom: odjek kroz zadnjih ~40 min, sve
 * percentile, pokrivenost, postojanost, te presudu V1 — pa se vidi KOJA
 * grana je odlučila, a ne samo ishod.
 *
 * POKRETANJE:
 *   node scripts/probe-place.mjs 42.286,18.840 Budva
 *   node scripts/probe-place.mjs 42.554,19.106 Danilovgrad
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [coords, label = 'mjesto'] = process.argv.slice(2);
if (!coords) { console.error('uporaba: node scripts/probe-place.mjs <lat,lon> [ime]'); process.exit(1); }
const [LAT, LON] = coords.split(',').map(Number);

const BUILD = [];
function build(name, src, transform = (s) => s) {
  const ts = `.probe-${name}.ts`, mjs = `.probe-${name}.mjs`;
  writeFileSync(ts, transform(readFileSync(src, 'utf8')));
  execSync(`npx esbuild ${ts} --format=esm --outfile=${mjs} --log-level=error`, { stdio: 'inherit' });
  BUILD.push(ts, mjs);
  return pathToFileURL(resolve(mjs)).href;
}
process.on('exit', () => BUILD.forEach((f) => existsSync(f) && rmSync(f)));

const withFetch = (s) =>
  'const fetchBytes = async (u) => { const r = await fetch(u);' +
  ' if (!r.ok) throw new Error("HTTP " + r.status);' +
  ' return new Uint8Array(await r.arrayBuffer()); };\n' +
  s.split('\n').filter((l) => !l.includes('./client')).join('\n');

const RS = await import(build('rs', 'src/api/radarSample.ts', withFetch));
const RJ = await import(build('rj', 'src/utils/radarJudge.ts', (s) => s.replace(/import type[^;]*;/, '')));

const HOST = 'https://tilecache.rainviewer.com';
const maps = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
const past = (maps.radar?.past || []).slice(-5);

console.log(`\n=== ${label}  (${LAT}, ${LON}) ===`);
const covered = await RS.fetchRadarCoverage(HOST, LAT, LON).catch(() => undefined);
console.log(`radarska pokrivenost: ${covered}`);

const echoes = [];
for (const f of past) {
  const e = await RS.fetchRadarEcho(HOST, f, LAT, LON).catch(() => undefined);
  echoes.push(e);
  if (!e) { console.log(`  ${new Date(f.time * 1000).toISOString().slice(11, 16)}  (nema)`); continue; }
  const pct = e.coverPixels > 0 ? (100 * e.echoPixels) / e.coverPixels : 0;
  const rr = (d) => (d === null ? '-' : RJ.rainRateFromDbz(d).toFixed(2));
  console.log(
    `  ${new Date(f.time * 1000).toISOString().slice(11, 16)}  ` +
    `max ${String(e.maxDbz ?? '-').padStart(5)}  median ${String(e.medianDbz === null ? '-' : e.medianDbz.toFixed(1)).padStart(5)}  ` +
    `p90 ${String(e.p90Dbz === null ? '-' : e.p90Dbz.toFixed(1)).padStart(5)}  ` +
    `sirina ${pct.toFixed(0).padStart(3)}%   ${rr(e.medianDbz)} mm/h`,
  );
}

const echo = echoes[echoes.length - 1];
const prevEcho = echoes[echoes.length - 2];
if (!echo) { console.log('nema odjeka — sudac bi pao na postaju/model'); process.exit(0); }

const persistence = echoes.filter((e) => e && e.maxDbz !== null && e.maxDbz >= RJ.DBZ_DRY).length / echoes.length;
console.log(`\npostojanost kroz ${echoes.length} okvira: ${(100 * persistence).toFixed(0)} %  (prag ${100 * RJ.PERSISTENCE_WET} %)`);

for (const [name, model] of [['model: oblacno (2)', 2], ['model: grmljavina (95)', 95]]) {
  const j = RJ.judgeCurrentCode({
    stationCode: undefined, stationAgeMin: undefined, stationDistanceKm: undefined,
    modelCode: model, cloudCover: 70, temp: 22,
    echo, prevEcho, persistence, covered: covered !== false, nowMs: Date.now(),
  });
  console.log(`  presuda uz ${name.padEnd(24)} -> kod ${String(j.code).padStart(3)}  izvor ${j.source}`);
}
