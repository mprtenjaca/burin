/**
 * NAŠA APP U HRVATSKOJ — protiv DHMZ mjerenja (12.9.2026., Markov
 * prioritet: „bitnije je da naša app u Hrvatskoj bude najtočnija").
 *
 * Europski uzorak (`compare-apps.mjs`) nas je stavio na zadnje mjesto, ali
 * je bio sjeverna Europa i sama rosulja — ondje naš prag od 20 dBZ
 * namjerno šuti. Hrvatska je drugi problem: krš i planina, gdje radar
 * vidi BRDO i zove ga kišom (Polača, Omiš, Senj, Trilj, Malinska).
 *
 * ISTINA je DHMZ `hrvatska_n.xml` — 65 postaja, opis vremena i naoblake,
 * mjereno na tlu. Nije savršen (satni termin, objavljen 30-70 min
 * kasnije), ali je jedino mjerenje koje Hrvatska javno daje.
 *
 * Mjere se DVIJE stvari, odvojeno:
 *   1. PADA LI — naš sudac protiv DHMZ opisa oborine
 *   2. NAOBLAKA — model protiv DHMZ opisa neba (vedro → potpuno oblačno)
 *
 * Sudionici: NAŠA APP (radarski sudac), ECMWF sam (bez sudca — pokazuje
 * što sudac dodaje), yr.no, WeatherAPI.
 *
 * POKRETANJE:
 *   node scripts/compare-hr.mjs
 *   node scripts/compare-hr.mjs --max 40
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

const BUILD = [];
function build(n, src, tr = (s) => s) {
  const ts = `src/api/.hr-${n}.ts`, mjs = `.hr-${n}.mjs`;
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

// ---- DHMZ: istina ----
const xml = await (await fetch('https://vrijeme.hr/hrvatska_n.xml')).text();
const termin = (xml.match(/<Termin>([^<]*)/) || [])[1];
const stations = [...xml.matchAll(/<Grad[^>]*>([\s\S]*?)<\/Grad>/g)].map((m) => ({
  name: ((m[1].match(/<GradIme>([^<]*)/) || [])[1] || '').trim(),
  lat: parseFloat((m[1].match(/<Lat>([^<]*)/) || [])[1]),
  lon: parseFloat((m[1].match(/<Lon>([^<]*)/) || [])[1]),
  wx: ((m[1].match(/<Vrijeme>([^<]*)/) || [])[1] || '').trim(),
})).filter((s) => s.name && isFinite(s.lat) && s.wx && s.wx !== '-');

const isWet = (v) => /kiša|rosulja|pljusak|snijeg|susnjež|grmljav|tuč/i.test(v);
// DHMZ opis neba -> postotak (sredina razreda); opisi vjetra vraćaju null
const skyPct = (v) => {
  const s = v.toLowerCase();
  if (/^vedro/.test(s)) return 5;
  if (/pretežno vedro/.test(s)) return 20;
  if (/umjereno oblačno/.test(s)) return 45;
  if (/pretežno oblačno/.test(s)) return 75;
  if (/potpuno oblačno|oblačno$/.test(s)) return 95;
  return null;
};

const sample = stations.slice(0, MAX);
const nWet = sample.filter((s) => isWet(s.wx)).length;
console.log(`DHMZ termin ${termin}:00 lokalno — ${stations.length} postaja, uzorak ${sample.length} (${nWet} s oborinom)`);

// ---- radar ----
const maps = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
const past = maps.radar?.past || [];
const frame = past[past.length - 1], prev = past[past.length - 2];
const HOST = 'https://tilecache.rainviewer.com';
console.log(`radarski okvir: ${new Date(frame.time * 1000).toISOString().slice(11, 16)} UTC`);

// ---- ECMWF ----
const lats = sample.map((s) => s.lat).join(','), lons = sample.map((s) => s.lon).join(',');
const om = await (await fetch(
  `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}`
  + `&current=weather_code,cloud_cover,precipitation,temperature_2m&timezone=UTC&models=ecmwf_ifs025`)).json();
const omList = Array.isArray(om) ? om : [om];

const sc = {
  app: { hit: 0, n: 0, falseWet: 0, missWet: 0, cloud: 0, cn: 0 },
  ecmwf: { hit: 0, n: 0, falseWet: 0, missWet: 0, cloud: 0, cn: 0 },
  yr: { hit: 0, n: 0, falseWet: 0, missWet: 0, cloud: 0, cn: 0 },
  wapi: { hit: 0, n: 0, falseWet: 0, missWet: 0, cloud: 0, cn: 0 },
};
const rows = [];

for (let i = 0; i < sample.length; i++) {
  const s = sample[i];
  const cur = omList[i]?.current;
  if (!cur) continue;
  const truthWet = isWet(s.wx);
  const truthCloud = skyPct(s.wx);

  const covered = await RS.fetchRadarCoverage(HOST, s.lat, s.lon).catch(() => undefined);
  const echo = await RS.fetchRadarEcho(HOST, frame, s.lat, s.lon).catch(() => undefined);
  const prevEcho = prev ? await RS.fetchRadarEcho(HOST, prev, s.lat, s.lon).catch(() => undefined) : undefined;
  /*
   * Sudac se zove BEZ postaje: inače bi dobio DHMZ opis koji je ovdje
   * ISTINA, pa bi mjerili koliko dobro prepisuje odgovor.
   */
  const judged = RJ.judgeCurrentCode({
    stationCode: undefined, stationAgeMin: undefined, stationDistanceKm: undefined,
    modelCode: cur.weather_code, cloudCover: cur.cloud_cover, temp: cur.temperature_2m,
    echo, prevEcho, covered: covered !== false, nowMs: Date.now(),
  });

  let yrWet = null, yrCloud = null;
  try {
    const y = await (await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${s.lat}&lon=${s.lon}`, UA)).json();
    const d = y.properties.timeseries[0].data;
    yrCloud = d.instant.details.cloud_area_fraction;
    yrWet = (d.next_1_hours?.details?.precipitation_amount ?? 0) > 0;
  } catch { /* preskoči */ }

  let wapiWet = null, wapiCloud = null;
  if (KEY) {
    try {
      const w = await (await fetch(`https://api.weatherapi.com/v1/current.json?key=${KEY}&q=${s.lat},${s.lon}`)).json();
      wapiWet = /rain|drizzle|snow|sleet|thunder|shower/i.test(w.current?.condition?.text || '');
      wapiCloud = w.current?.cloud;
    } catch { /* preskoči */ }
  }

  const put = (k, wet, cloud) => {
    if (wet === null) return;
    sc[k].n++;
    if (wet === truthWet) sc[k].hit++;
    else if (wet && !truthWet) sc[k].falseWet++;
    else sc[k].missWet++;
    if (truthCloud !== null && cloud !== null && cloud !== undefined) {
      sc[k].cloud += Math.abs(cloud - truthCloud); sc[k].cn++;
    }
  };
  put('app', RJ.isPrecip(judged.code), cur.cloud_cover);
  put('ecmwf', RJ.isPrecip(cur.weather_code), cur.cloud_cover);
  put('yr', yrWet, yrCloud);
  put('wapi', wapiWet, wapiCloud);

  rows.push({ s, truthWet, truthCloud, app: RJ.isPrecip(judged.code), dbz: echo?.maxDbz ?? null, src: judged.source,
    appCloud: cur.cloud_cover, yrCloud, wapiCloud });
}

console.log();
console.log('postaja              DHMZ mjeri            | naša | radar     | nebo: DHMZ/naš/yr');
for (const r of rows) {
  const flag = r.app !== r.truthWet ? (r.app ? ' LAŽNA KIŠA' : ' PROPUST') : '';
  console.log(
    `${r.s.name.slice(0, 20).padEnd(21)}${r.s.wx.slice(0, 21).padEnd(22)}| ${(r.app ? 'PADA' : 'suho').padEnd(5)}| `
    + `${String(r.dbz ?? '-').padStart(3)} dBZ ${r.src.padEnd(7)} | `
    + `${String(r.truthCloud ?? '-').padStart(3)}/${String(r.appCloud).padStart(3)}/${String(r.yrCloud ?? '-').padStart(3)}${flag}`,
  );
}

console.log();
console.log(`=== PADA LI — protiv DHMZ (${rows.filter((r) => r.truthWet).length} mokrih, ${rows.filter((r) => !r.truthWet).length} suhih) ===`);
for (const [k, label] of [['app', 'NAŠA APP  '], ['ecmwf', 'ECMWF sam '], ['yr', 'yr.no     '], ['wapi', 'WeatherAPI']]) {
  const x = sc[k];
  if (!x.n) { console.log(`  ${label} (nema podataka)`); continue; }
  console.log(`  ${label} točno ${String(x.hit).padStart(2)}/${x.n} (${Math.round((100 * x.hit) / x.n)} %)`
    + `   LAŽNE kiše ${x.falseWet}   propušteno ${x.missWet}`);
}
console.log();
console.log('=== NAOBLAKA — srednja greška prema DHMZ opisu neba ===');
for (const [k, label] of [['app', 'NAŠA (ECMWF)'], ['yr', 'yr.no       '], ['wapi', 'WeatherAPI  ']]) {
  const x = sc[k];
  if (x.cn) console.log(`  ${label} ${(x.cloud / x.cn).toFixed(1)} %   (n=${x.cn})`);
}
