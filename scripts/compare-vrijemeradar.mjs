/**
 * USPOREDBA s vrijemeradar.hr (11.9.2026., Markov predlog).
 *
 * Zašto ovaj izvor: današnje baždarenje je išlo na austrijskim postajama
 * (GeoSphere, mm/10 min) jer su jedine s pravim mjerenjem oborine na tlu.
 * Ali Austrija nema ono što nas najviše boli — ORAOGRAFSKI CLUTTER nad
 * Dalmacijom (Polača, Pridraga, Metković). `vrijemeradar.hr` pokriva
 * cijelu Hrvatsku i daje tekstualno stanje „sada", pa služi kao drugi
 * sudac ZA HRVATSKU.
 *
 * ŠTO OVAJ IZVOR JEST I NIJE:
 *   JEST  — neovisna procjena istog trenutka, za mjesta bez DHMZ postaje
 *   NIJE  — mjerenje na tlu. To je tuđa PROCJENA iz (vjerojatno) istog
 *           modela i radara koje i mi čitamo. Slaganje s njima NIJE dokaz
 *           točnosti; razilaženje je signal da nešto treba pogledati.
 *
 * Zato se rezultat čita kao „koliko smo blizu drugoj aplikaciji", ne kao
 * ocjena točnosti. Pravi ground truth za Dalmaciju ostaje Markov prozor.
 *
 *   node scripts/compare-vrijemeradar.mjs
 *   node scripts/compare-vrijemeradar.mjs --places zadar,split,knin
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const BUILD = [];
function build(name, src, transform = (s) => s) {
  const ts = `.cmp-${name}.ts`;
  const mjs = `.cmp-${name}.mjs`;
  writeFileSync(ts, transform(readFileSync(src, 'utf8')));
  execSync(`npx esbuild ${ts} --format=esm --outfile=${mjs} --log-level=error`, { stdio: 'inherit' });
  BUILD.push(ts, mjs);
  return pathToFileURL(resolve(mjs)).href;
}
process.on('exit', () => BUILD.forEach((f) => existsSync(f) && rmSync(f)));

const stripClient = (s) =>
  s.split('\n').filter((l) => !l.includes('./client')).join('\n')
    .replace(/export async function fetch[\s\S]*?\n}\n/g, '');

const RS = await import(build('rs', 'src/api/radarSample.ts', stripClient));
const RJ = await import(build('rj', 'src/utils/radarJudge.ts', (s) => s.replace(/import type[^;]*;/, '')));
const RF = await import(build('rf', 'src/utils/radarFeatures.ts', (s) => s.replace(/import type[^;]*;/, '')));
const V2 = await import(
  build('v2', 'src/utils/currentWeatherV2.ts', (src) =>
    src.split('\n').filter((l) => !l.startsWith('import type')).join('\n')
      .replace('@/utils/radarJudge', './.cmp-rj.mjs'))
);
// dhmzTextToCode bez i18n/lucide ovisnosti
const wc = readFileSync('src/utils/weatherCodes.ts', 'utf8');
const a = wc.indexOf('export function dhmzTextToCode');
const WC = await import(build('wc', 'src/utils/weatherCodes.ts', () => wc.slice(a, wc.indexOf('\n}', a) + 2)));

// ---- mjesta: slug za vrijemeradar + koordinate ----
const PLACES = [
  // ---- DALMACIJA: Zadar i okolica (mala naselja, tu su nalazi) ----
  ['zadar', 'Zadar', 44.1194, 15.2314],
  ['bibinje', 'Bibinje', 44.075, 15.28],
  ['sukosan', 'Sukosan', 44.043, 15.32],
  ['nin', 'Nin', 44.242, 15.181],
  ['privlaka', 'Privlaka', 44.267, 15.135],
  ['vir', 'Vir', 44.308, 15.2],
  ['posedarje', 'Posedarje', 44.22, 15.48],
  ['novigrad', 'Novigrad ZD', 44.181, 15.545],
  ['polaca', 'Polaca', 43.96, 15.51],
  ['pridraga', 'Pridraga', 44.15, 15.52],
  ['benkovac', 'Benkovac', 44.032, 15.612],
  ['obrovac', 'Obrovac', 44.203, 15.681],
  ['biograd-na-moru', 'Biograd n/m', 43.939, 15.442],
  ['pakostane', 'Pakostane', 43.907, 15.506],
  ['starigrad', 'Starigrad', 44.295, 15.44],
  ['sali', 'Sali', 43.937, 15.161],
  // ---- DALMACIJA: sjeverna i srednja ----
  ['sibenik', 'Sibenik', 43.726, 15.906],
  ['vodice', 'Vodice', 43.759, 15.777],
  ['primosten', 'Primosten', 43.587, 15.924],
  ['skradin', 'Skradin', 43.817, 15.922],
  ['knin', 'Knin', 44.041, 16.199],
  ['drnis', 'Drnis', 43.859, 16.156],
  ['split', 'Split', 43.508, 16.44],
  ['solin', 'Solin', 43.54, 16.49],
  ['trogir', 'Trogir', 43.515, 16.251],
  ['kastela', 'Kastela', 43.554, 16.348],
  ['sinj', 'Sinj', 43.704, 16.639],
  ['trilj', 'Trilj', 43.62, 16.725],
  ['omis', 'Omis', 43.445, 16.689],
  ['makarska', 'Makarska', 43.297, 17.017],
  ['imotski', 'Imotski', 43.447, 17.218],
  ['vrgorac', 'Vrgorac', 43.203, 17.369],
  // ---- DALMACIJA: juzna + otoci ----
  ['ploce', 'Ploce', 43.048, 17.443],
  ['metkovic', 'Metkovic', 43.054, 17.648],
  ['dubrovnik', 'Dubrovnik', 42.65, 18.094],
  ['cavtat', 'Cavtat', 42.582, 18.218],
  ['ston', 'Ston', 42.839, 17.699],
  ['korcula', 'Korcula', 42.96, 17.135],
  ['hvar', 'Hvar', 43.172, 16.442],
  ['supetar', 'Supetar', 43.384, 16.552],
  ['vis', 'Vis', 43.062, 16.183],
  ['lastovo', 'Lastovo', 42.768, 16.9],
  // ---- LIKA I GORSKI KOTAR ----
  ['gospic', 'Gospic', 44.546, 15.374],
  ['otocac', 'Otocac', 44.869, 15.237],
  ['korenica', 'Korenica', 44.748, 15.708],
  ['slunj', 'Slunj', 45.112, 15.585],
  ['ogulin', 'Ogulin', 45.263, 15.226],
  ['delnice', 'Delnice', 45.401, 14.799],
  ['senj', 'Senj', 44.99, 14.906],
  // ---- KVARNER I ISTRA ----
  ['rijeka', 'Rijeka', 45.327, 14.442],
  ['opatija', 'Opatija', 45.338, 14.308],
  ['crikvenica', 'Crikvenica', 45.173, 14.689],
  ['novi-vinodolski', 'Novi Vinodol.', 45.128, 14.79],
  ['krk', 'Krk', 45.027, 14.576],
  ['malinska', 'Malinska', 45.126, 14.527],
  ['rab', 'Rab', 44.756, 14.764],
  ['mali-losinj', 'Mali Losinj', 44.532, 14.469],
  ['cres', 'Cres', 44.961, 14.409],
  ['pula', 'Pula', 44.867, 13.85],
  ['rovinj', 'Rovinj', 45.081, 13.638],
  ['porec', 'Porec', 45.227, 13.594],
  ['umag', 'Umag', 45.435, 13.525],
  ['pazin', 'Pazin', 45.24, 13.937],
  ['labin', 'Labin', 45.085, 14.12],
  ['buzet', 'Buzet', 45.409, 13.968],
  // ---- ZAGREB I OKOLICA ----
  ['zagreb', 'Zagreb', 45.815, 15.982],
  ['velika-gorica', 'Velika Gorica', 45.713, 16.075],
  ['samobor', 'Samobor', 45.803, 15.711],
  ['zapresic', 'Zapresic', 45.856, 15.806],
  ['jastrebarsko', 'Jastrebarsko', 45.669, 15.647],
  ['karlovac', 'Karlovac', 45.487, 15.548],
  ['sisak', 'Sisak', 45.485, 16.373],
  ['kutina', 'Kutina', 45.477, 16.781],
  // ---- ZAGORJE, MEDIMURJE, PODRAVINA ----
  ['varazdin', 'Varazdin', 46.306, 16.338],
  ['cakovec', 'Cakovec', 46.384, 16.433],
  ['krapina', 'Krapina', 46.162, 15.87],
  ['zabok', 'Zabok', 46.029, 15.913],
  ['koprivnica', 'Koprivnica', 46.162, 16.828],
  ['krizevci', 'Krizevci', 46.029, 16.545],
  ['bjelovar', 'Bjelovar', 45.898, 16.842],
  ['daruvar', 'Daruvar', 45.59, 17.225],
  ['virovitica', 'Virovitica', 45.831, 17.384],
  ['slatina', 'Slatina', 45.706, 17.703],
  // ---- SLAVONIJA ----
  ['osijek', 'Osijek', 45.551, 18.694],
  ['vinkovci', 'Vinkovci', 45.288, 18.805],
  ['vukovar', 'Vukovar', 45.351, 19.001],
  ['dakovo', 'Dakovo', 45.308, 18.41],
  ['beli-manastir', 'Beli Manastir', 45.777, 18.607],
  ['zupanja', 'Zupanja', 45.077, 18.7],
  ['slavonski-brod', 'Slavonski Brod', 45.16, 18.015],
  ['pozega', 'Pozega', 45.34, 17.675],
  ['nova-gradiska', 'Nova Gradiska', 45.254, 17.384],
  ['pakrac', 'Pakrac', 45.44, 17.188],
  // ---- IZVAN HRVATSKE ----
  ['ljubljana', 'Ljubljana', 46.056, 14.506],
  ['maribor', 'Maribor', 46.555, 15.646],
  ['koper', 'Koper', 45.548, 13.73],
  ['sarajevo', 'Sarajevo', 43.856, 18.413],
  ['mostar', 'Mostar', 43.344, 17.808],
  ['banja-luka', 'Banja Luka', 44.772, 17.191],
  ['bihac', 'Bihac', 44.811, 15.87],
  ['beograd', 'Beograd', 44.787, 20.449],
  ['novi-sad', 'Novi Sad', 45.267, 19.834],
  ['trieste', 'Trst', 45.65, 13.777],
  ['venecija', 'Venecija', 45.441, 12.316],
  ['milano', 'Milano', 45.464, 9.19],
  ['graz', 'Graz', 47.071, 15.44],
  ['klagenfurt', 'Klagenfurt', 46.625, 14.305],
  ['bec', 'Bec', 48.208, 16.374],
  ['budimpesta', 'Budimpesta', 47.498, 19.04],
  ['munchen', 'Munchen', 48.135, 11.582],
  ['prag', 'Prag', 50.076, 14.438],
  ['podgorica', 'Podgorica', 42.43, 19.259],
  ['skopje', 'Skopje', 41.998, 21.425],
];
const only = arg('places', null)?.split(',');
const list = only ? PLACES.filter((p) => only.includes(p[0])) : PLACES;

// ---- vrijemeradar.hr ----
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/*
 * Parser njihove stranice. Oblik je „… sada 25° 13 m/s <nesto> 06:29 19:12",
 * gdje <nesto> nosi stanje — ali NE uvijek istim riječima:
 *
 *   Zadar:  "sada 24° 3 m/s 90 min. vrijeme promjenljivo oblačno 06:33 19:17"
 *   Split:  "sada 25° 13 m/s Upozor. na jaku grmlj. Grmljavinsko nevrijeme 06:29 19:12"
 *
 * Prva verzija je tražila doslovno „vrijeme " prije stanja i na Splitu je
 * zato uhvatila „06:29" — pa je ispalo da se ne slažemo, a slagali smo se
 * (Markov nalaz: „al i njima za Split pada kiša"). Sad se uzima SVE između
 * m/s i para vremena izlaska/zalaska, pa se odbacuju uvodi („90 min.
 * vrijeme", „Upozor. …") i zadrži zadnja rečenica = stanje.
 */
async function theirs(slug) {
  try {
    const r = await fetch(`https://www.vrijemeradar.hr/vrijeme/${slug}`, { headers: { 'User-Agent': UA } });
    const t = plain(await r.text());
    const m = t.match(/sada\s+(-?\d+)°\s+([\d.]+)\s*m\/s\s+(.+?)\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})/);
    if (!m) return null;
    let mid = m[3].trim();
    const warning = /upozor/i.test(mid) ? mid.match(/Upozor[^.]*\.[^.]*\./i)?.[0]?.trim() ?? null : null;
    // skini poznate uvode
    mid = mid
      .replace(/^\d+\s*min\.\s*vrijeme\s*/i, '')
      .replace(/Upozor[^.]*\.\s*(na[^.]*\.\s*)?/i, '')
      .trim();
    return { temp: Number(m[1]), wind: Number(m[2]), text: mid, warning };
  } catch { return null; }
}

/** Njihov tekst → pada li oborina. Njihov rječnik, ne DHMZ-ov. */
function theirWet(text) {
  const s = text.toLowerCase();
  // "pristižu", "uskoro", "mogući" = njihova PROGNOZA, ne stanje — još ne pada.
  if (/pristižu|pristizu|uskoro|moguć|mogu[cć]/.test(s)) return false;
  return /kiša|kisa|pljusk|rosulj|snijeg|susnjež|grmljavin|nevrijeme|oborin/.test(s);
}

// ---- naši izvori ----
const rv = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
const HOST = rv.host;
const FRAMES = rv.radar.past.slice(-5);
const getBytes = async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer());
const tiles = new Map();
async function tile(path, tx, ty) {
  const k = `${path}/${tx}/${ty}`;
  if (!tiles.has(k)) tiles.set(k, RS.decodePng(await getBytes(RS.tileUrl(HOST, path, RS.RAINVIEWER_ZOOM, tx, ty, 2))));
  return tiles.get(k);
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
  if (!covCache.has(`${c.tx}/${c.ty}`)) {
    try { covCache.set(`${c.tx}/${c.ty}`, RS.decodePng(await getBytes(RS.coverageTileUrl(HOST, c.tx, c.ty)))); }
    catch { covCache.set(`${c.tx}/${c.ty}`, null); }
  }
  const img = covCache.get(`${c.tx}/${c.ty}`);
  return img ? RS.isCoveredPixel(img, gx, gy) : false;
}

// DHMZ
const dhmzXml = await (await fetch('https://vrijeme.hr/hrvatska_n.xml')).text();
const term = Number(dhmzXml.match(/<Termin>(.*?)<\/Termin>/)[1]);
const tt = new Date(); tt.setHours(term, 0, 0, 0);
const stAge = (Date.now() - tt.getTime()) / 60000;
const stations = [...dhmzXml.matchAll(/<Grad[^>]*>([\s\S]*?)<\/Grad>/g)].map((m) => {
  const g = m[1];
  return {
    n: g.match(/<GradIme>(.*?)<\/GradIme>/)[1].trim(),
    la: parseFloat(g.match(/<Lat>(.*?)<\/Lat>/)[1]),
    lo: parseFloat(g.match(/<Lon>(.*?)<\/Lon>/)[1]),
    v: g.match(/<Vrijeme>(.*?)<\/Vrijeme>/)[1].trim(),
  };
});
const km = (a, b, c, d) => {
  const t = Math.PI / 180, R = 6371;
  const dl = (c - a) * t, dn = (d - b) * t;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// model, u seriji
const mUrl = `https://api.open-meteo.com/v1/forecast?latitude=${list.map((p) => p[2]).join(',')}` +
  `&longitude=${list.map((p) => p[3]).join(',')}` +
  `&current=weather_code,cloud_cover,temperature_2m,precipitation&models=ecmwf_ifs025`;
const mRes = await (await fetch(mUrl)).json();
const models = (Array.isArray(mRes) ? mRes : [mRes]).map((e) => e.current);

const KOD = { 0: 'vedro', 1: 'pretVedro', 2: 'djelOblacno', 3: 'oblacno', 3.5: 'pretOblacno', 45: 'magla',
  51: 'rosulja', 53: 'rosulja', 55: 'rosulja', 61: 'slabaKisa', 63: 'KISA', 65: 'JAKAKISA', 66: 'ledenaKisa',
  71: 'slabSnijeg', 73: 'snijeg', 75: 'jakSnijeg', 80: 'pljuskovi', 81: 'pljuskovi', 82: 'pljuskovi', 95: 'GRMLJAVINA' };
const nowMs = Date.now();

console.log('USPOREDBA: nasa app vs vrijemeradar.hr');
console.log(`okvir ${new Date(FRAMES.at(-1).time * 1000).toLocaleTimeString('hr-HR')}, DHMZ termin ${String(term).padStart(2, '0')}:00 (${Math.round(stAge)} min)\n`);
console.log('mjesto        dBZ pers | V1            V2         conf | vrijemeradar.hr        | pada?');

let agreeWet = 0, agreeDry = 0, weWet = 0, theyWet = 0, noData = 0;
const disagree = [];

for (let i = 0; i < list.length; i++) {
  const [slug, name, lat, lon] = list[i];
  const their = await theirs(slug);
  const cur = models[i];
  if (!their || !cur) { console.log(name.padEnd(13), '(bez podatka)'); noData++; continue; }

  const cov = await covered(lat, lon);
  const series = [];
  for (const f of FRAMES) series.push(await sample(f, lat, lon));
  const newest = series.at(-1), prev = series.at(-2);
  const temporal = RF.radarTemporal(series, series.map((s) => s.centroid));
  const clutter = RF.clutterScore(newest, temporal);

  const near = stations.map((s) => ({ ...s, d: km(lat, lon, s.la, s.lo) })).sort((x, y) => x.d - y.d)[0];
  const hasSt = near.d <= 25;
  const stCode = hasSt ? WC.dhmzTextToCode(near.v) : undefined;

  const echo = { maxDbz: newest.maxDbz, frameTime: newest.frameTime, radiusKm: RS.SAMPLE_RADIUS_KM,
    echoPixels: newest.echoPixels, coverPixels: newest.coverPixels };
  // Postojanost iz svih okvira — isto kao u app-u (PERSISTENCE_WET).
  const persistence = series.length >= 2
    ? series.filter((x) => x.maxDbz !== null && x.maxDbz >= 20).length / series.length
    : undefined;

  const v1 = RJ.judgeCurrentCode({
    stationCode: stCode, stationAgeMin: hasSt ? stAge : Infinity, stationDistanceKm: hasSt ? near.d : undefined,
    modelCode: cur.weather_code, cloudCover: cur.cloud_cover, temp: cur.temperature_2m,
    echo, prevEcho: prev && { ...echo, maxDbz: prev.maxDbz, frameTime: prev.frameTime,
      echoPixels: prev.echoPixels, coverPixels: prev.coverPixels }, persistence, covered: cov, nowMs,
  });
  const v2 = V2.judgeCurrentCodeV2({
    radar: { stats: newest, temporal, clutterScore: clutter, frameTime: newest.frameTime },
    covered: cov,
    station: hasSt ? { code: stCode, ageMin: stAge, distanceKm: near.d } : undefined,
    model: { code: cur.weather_code, cloudCover: cur.cloud_cover, precipitation: cur.precipitation, ageMin: 120 },
    temp: cur.temperature_2m, nowMs,
  });

  const tw = theirWet(their.text);
  // APP pokazuje V1 (V2 je shadow) — sudi se po onome sto korisnik vidi.
  const ow = RJ.isPrecip(v1.code);
  const v2Wet = v2.precipitation;
  if (tw) theyWet++;
  if (ow) weWet++;
  if (tw && ow) agreeWet++;
  if (!tw && !ow) agreeDry++;
  if (tw !== ow) disagree.push({ name, their: their.text, warning: their.warning, v1: KOD[v1.code] ?? v1.code, v2: KOD[v2.code] ?? v2.code,
    dbz: newest.maxDbz, pers: temporal.persistence, conf: v2.precipitationConfidence, st: hasSt ? near.v : '—',
    stKm: hasSt ? near.d.toFixed(1) : '—', model: cur.weather_code, flags: v2.diagnostics.flags });

  console.log(
    name.padEnd(13),
    String(newest.maxDbz ?? '-').padStart(3),
    `${Math.round(100 * temporal.persistence)}%`.padStart(4), '|',
    (KOD[v1.code] ?? v1.code).padEnd(13),
    (KOD[v2.code] ?? v2.code).padEnd(10),
    v2.precipitationConfidence.toFixed(2), '|',
    their.text.slice(0, 22).padEnd(23), '|',
    (ow ? 'mi:PADA' : 'mi:suho') + ' ' + (tw ? 'oni:PADA' : 'oni:suho') + (tw === ow ? '' : '  <-- RAZLIKA') + (v2Wet !== ow ? '  [V2 drukcije]' : ''),
  );
}

const n = list.length - noData;
console.log(`\n=== SLAGANJE (${n} mjesta) ===`);
console.log(`  oboje kaze PADA:  ${agreeWet}`);
console.log(`  oboje kaze suho:  ${agreeDry}`);
console.log(`  razilazimo se:    ${disagree.length}`);
console.log(`  slaganje:         ${Math.round((100 * (agreeWet + agreeDry)) / n)}%`);
console.log(`  mi tvrdimo kisu na ${weWet}, oni na ${theyWet} mjesta`);

if (disagree.length) {
  console.log('\n=== GDJE SE RAZILAZIMO (za rucnu provjeru) ===');
  for (const d of disagree) {
    console.log(`\n  ${d.name}:`);
    console.log(`    oni:     "${d.their}"`);
    console.log(`    mi V1:   ${d.v1}    V2: ${d.v2} (conf ${d.conf.toFixed(2)})`);
    console.log(`    radar:   ${d.dbz ?? 'bez odjeka'} dBZ, postojanost ${Math.round(100 * d.pers)}%`);
    console.log(`    postaja: "${d.st}" (${d.stKm} km) | model: kod ${d.model}`);
    if (d.flags.length) console.log(`    flags:   ${d.flags.join(', ')}`);
  }
}
