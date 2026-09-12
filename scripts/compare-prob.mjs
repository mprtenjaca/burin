/**
 * KOJI MODEL DAJE BOLJU VJEROJATNOST OBORINE — ECMWF ili best_match?
 * (12.9.2026., Markov nalaz: „jako puno se razlikujemo od ostatka
 * aplikacija i to za 10ke posto".)
 *
 * Izmjereno na Danilovgradu: ECMWF 96/100/100/98 % za 14-17 h, dok
 * AccuWeather daje 43/47/51/52, vrijemeradar 80/50/50/40, WeatherAPI
 * 37/39/8/36. ECMWF je JEDINI koji ide na 100 %.
 *
 * DVIJE MJERE, jer mjere različite stvari:
 *
 *  1. SLAGANJE S DRUGIMA — koliko smo daleko od onoga što korisnik vidi
 *     u drugim aplikacijama. Referenca: WeatherAPI (`chance_of_rain`),
 *     jedini od njih s javnim API-jem. NIJE dokaz točnosti (vidi odluku
 *     „tuđa aplikacija nije ground truth").
 *
 *  2. TOČNOST — pogađa li model SATE u kojima stvarno pada. Referenca:
 *     yr.no `precipitation_amount` (mm/h) kao neovisan model, i RADAR za
 *     prošle sate (jedino pravo mjerenje). Vjerojatnost se ne može
 *     izravno provjeriti jednim danom, pa se mjeri Brier score nad
 *     prošlim satima gdje radar zna istinu.
 *
 * POKRETANJE:
 *   node scripts/compare-prob.mjs
 *   node scripts/compare-prob.mjs --hours 12
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const HOURS = Number(arg('hours', 10));

const PLACES = [
  ['Zadar', 44.119, 15.231], ['Split', 43.508, 16.440], ['Zagreb', 45.815, 15.982],
  ['Rijeka', 45.327, 14.442], ['Dubrovnik', 42.650, 18.094], ['Osijek', 45.555, 18.695],
  ['Danilovgrad', 42.554, 19.106], ['Budva', 42.286, 18.840], ['Gospic', 44.546, 15.374],
  ['Knin', 44.041, 16.197], ['Pula', 44.867, 13.849], ['Sarajevo', 43.856, 18.413],
  ['Podgorica', 42.359, 19.252], ['Mostar', 43.343, 17.808], ['Varazdin', 46.306, 16.338],
  ['Slavonski Brod', 45.160, 18.016],
];

// ---- radar (istina za PROŠLE sate) ----
const BUILD = [];
function build(n, src, tr = (s) => s) {
  const ts = `src/api/.prob-${n}.ts`, mjs = `.prob-${n}.mjs`;
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

// ---- dohvat ----
const lats = PLACES.map((p) => p[1]).join(','), lons = PLACES.map((p) => p[2]).join(',');
const omUrl = (model) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}`
  + `&hourly=precipitation_probability,precipitation&forecast_days=1&past_days=1&timezone=UTC`
  + (model ? `&models=${model}` : '');
const ecm = await (await fetch(omUrl('ecmwf_ifs025'))).json();
const bm = await (await fetch(omUrl(null))).json();

const nowMs = Date.now();
const isoUtc = (ms) => new Date(ms).toISOString().slice(0, 13) + ':00';

// radarski okviri za prošle sate
const maps = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
const frames = (maps.radar?.past || []);

console.log(`mjesta: ${PLACES.length}   radarskih okvira: ${frames.length}`);
console.log(`sada (UTC): ${isoUtc(nowMs)}`);

let agreeEc = 0, agreeBm = 0, agreeWa = 0, nAgree = 0;
let brierEc = 0, brierBm = 0, nBrier = 0;
let hitEc = 0, hitBm = 0, nWet = 0;
const lines = [];

for (let i = 0; i < PLACES.length; i++) {
  const [name, la, lo] = PLACES[i];
  const he = ecm[i].hourly, hb = bm[i].hourly;

  // --- 1. slaganje s WeatherAPI na BUDUĆIM satima ---
  let wa = null;
  if (KEY) {
    try {
      const w = await (await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${KEY}&q=${la},${lo}&days=2`)).json();
      wa = {};
      for (const d of w.forecast.forecastday) for (const x of d.hour) {
        wa[new Date(x.time_epoch * 1000).toISOString().slice(0, 13) + ':00'] = x.chance_of_rain;
      }
    } catch { /* bez ključa ili kvota — mjera 1 se preskače */ }
  }

  // --- 2. yr kao neovisan model (mm/h) ---
  let yr = null;
  try {
    const y = await (await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${la}&lon=${lo}`, UA)).json();
    yr = {};
    for (const t of y.properties.timeseries) {
      const mm = t.data.next_1_hours?.details?.precipitation_amount;
      if (mm !== undefined) yr[t.time.slice(0, 13) + ':00'] = mm;
    }
  } catch { /* preskoči */ }

  // --- 3. radar: je li u PROŠLIM satima stvarno padalo ---
  const wetByHour = new Map();
  for (const f of frames) {
    try {
      const e = await RS.fetchRadarEcho('https://tilecache.rainviewer.com', f, la, lo);
      if (!e || e.maxDbz === null) continue;
      const iso = new Date(f.time * 1000).toISOString().slice(0, 13) + ':00';
      const wet = e.maxDbz >= RJ.DBZ_DRY && (e.medianDbz ?? 0) >= RJ.MEDIAN_WET_DBZ;
      wetByHour.set(iso, (wetByHour.get(iso) || false) || wet);
    } catch { /* preskoči okvir */ }
  }

  for (let k = 0; k < he.time.length; k++) {
    const t = he.time[k];
    const pe = he.precipitation_probability[k], pb = hb.precipitation_probability[k];
    if (pe === null || pb === null) continue;
    const future = new Date(t + 'Z').getTime() > nowMs;

    if (future && wa && wa[t] !== undefined) {
      agreeEc += Math.abs(pe - wa[t]); agreeBm += Math.abs(pb - wa[t]); nAgree++;
    }
    if (!future && wetByHour.has(t)) {
      const truth = wetByHour.get(t) ? 1 : 0;
      brierEc += (pe / 100 - truth) ** 2; brierBm += (pb / 100 - truth) ** 2; nBrier++;
      if (truth) { nWet++; if (pe >= 50) hitEc++; if (pb >= 50) hitBm++; }
    }
    if (future && yr && yr[t] !== undefined && lines.length < HOURS * 3) {
      lines.push(`${name.padEnd(15)}${t.slice(5, 16)}  ECMWF ${String(pe).padStart(3)}%  best ${String(pb).padStart(3)}%  `
        + `WAPI ${String(wa?.[t] ?? '-').padStart(3)}%  yr ${yr[t]} mm`);
    }
  }
}

console.log();
console.log('--- uzorak sati (buduci) ---');
for (const l of lines.slice(0, 24)) console.log('  ' + l);

console.log();
console.log('=== 1. SLAGANJE s WeatherAPI (buduci sati, manje = slicnije) ===');
if (nAgree) {
  console.log(`  ECMWF      ${(agreeEc / nAgree).toFixed(1)} postotnih bodova`);
  console.log(`  best_match ${(agreeBm / nAgree).toFixed(1)} postotnih bodova   (n=${nAgree})`);
} else console.log('  (nema WeatherAPI ključa ili podataka)');

console.log();
console.log('=== 2. TOCNOST na PROSLIM satima, istina = RADAR (Brier, manje = bolje) ===');
if (nBrier) {
  console.log(`  ECMWF      ${(brierEc / nBrier).toFixed(4)}`);
  console.log(`  best_match ${(brierBm / nBrier).toFixed(4)}   (n=${nBrier}, mokrih ${nWet})`);
  if (nWet) console.log(`  uhvaceno mokrih uz >=50%:  ECMWF ${hitEc}/${nWet}   best_match ${hitBm}/${nWet}`);
} else console.log('  (nema preklapanja radara i prošlih sati)');
