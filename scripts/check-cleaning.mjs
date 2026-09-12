/**
 * KOLIKO `dropImpossiblePrecip` GRIJEŠI NA MJESTIMA GDJE ZNAMO ISTINU
 * (12.9.2026., Markov nalaz Budva/Danilovgrad: „jako puno se razlikujemo
 * od ostatka aplikacija i to za 10ke posto").
 *
 * Pravilo je 11.9. izvedeno iz JEDNOG zadarskog slučaja (14 % naoblake,
 * 0.8 mm, yr potvrdio vedro) i ondje je bilo točno. Danilovgrad pokazuje
 * drugu stranu: 94 % vjerojatnosti uz 6 % naoblake, app to obriše na 2 %,
 * a radar nad istom točkom vidi 30 dBZ i 100 % širine — PADA.
 *
 * Ovdje se mjeri na točkama gdje istinu daje MJERENJE NA TLU (METAR), a
 * ne drugi model: za svaku se uzme tekući sat iz ECMWF-a, primijeni
 * pravilo, pa usporedi s onim što je aerodrom stvarno opazio.
 *
 * POKRETANJE:
 *   node scripts/check-cleaning.mjs
 *   node scripts/check-cleaning.mjs --max 40
 */
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const MAX = Number(arg('max', 30));

// pragovi iz src/api/weather.ts (drže se u sinkronizaciji ručno — ako se
// ondje promijene, ova skripta mora ih dobiti isto)
const CLEAR_SKY_MAX_CLOUD = 30;
const CLEAR_SKY_MAX_MM = 1;
const cap = (cc) => Math.round(cc / 3);

const isWet = (m) => /(^|\s)(-|\+)?(SH|TS)?(RA|DZ|SN|GR|GS|PL|SG)/.test(String(m.wxString || ''));

const mr = await fetch('https://aviationweather.gov/api/data/metar?bbox=36,-10,60,30&format=json&hours=1');
if (!mr.ok) { console.error('METAR HTTP', mr.status); process.exit(1); }
const metars = await mr.json();

// dedupe po postaji (feed nosi više termina)
const seen = new Map();
for (const m of metars) if (!seen.has(m.icaoId)) seen.set(m.icaoId, m);
const all = [...seen.values()];
const wet = all.filter(isWet).slice(0, MAX);
const dry = all.filter((m) => !m.wxString).slice(0, MAX);
const sample = [...wet, ...dry];
console.log(`METAR postaja: ${all.length}  uzorak: ${wet.length} mokrih + ${dry.length} suhih`);

// ECMWF za sve točke odjednom
const lats = sample.map((m) => m.lat).join(',');
const lons = sample.map((m) => m.lon).join(',');
const u = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}`
  + `&hourly=precipitation_probability,precipitation,cloud_cover,weather_code&models=ecmwf_ifs025`
  + `&forecast_days=1&past_days=1&timezone=UTC`;
const fr = await fetch(u);
if (!fr.ok) { console.error('Open-Meteo HTTP', fr.status); process.exit(1); }
const arr = await fr.json();
const list = Array.isArray(arr) ? arr : [arr];

const nowIso = new Date().toISOString().slice(0, 13) + ':00';
let wrongDrop = 0, rightDrop = 0, untouchedWet = 0, untouchedDry = 0;
const rows = [];
list.forEach((o, i) => {
  const m = sample[i];
  const h = o.hourly;
  const k = h.time.indexOf(nowIso);
  if (k < 0) return;
  const cc = h.cloud_cover[k], mm = h.precipitation[k], pr = h.precipitation_probability[k];
  const cleaned = !(cc >= CLEAR_SKY_MAX_CLOUD || mm > CLEAR_SKY_MAX_MM);
  const out = cleaned ? Math.min(pr, cap(cc)) : pr;
  const truth = isWet(m);
  if (cleaned && out !== pr) {
    if (truth) { wrongDrop++; rows.push({ m, pr, out, cc, mm, truth, bad: true }); }
    else { rightDrop++; rows.push({ m, pr, out, cc, mm, truth, bad: false }); }
  } else if (truth) untouchedWet++; else untouchedDry++;
});

console.log();
console.log('OČIŠĆENI SATI (pravilo je snizilo postotak):');
console.log('postaja  mjereno      ECMWF -> app     naoblaka   mm');
for (const r of rows.sort((a, b) => (b.bad ? 1 : 0) - (a.bad ? 1 : 0) || b.pr - a.pr)) {
  console.log(
    `${r.m.icaoId.padEnd(6)} ${(r.truth ? (r.m.wxString || 'RA') : 'suho').padEnd(11)} ` +
    `${String(r.pr).padStart(4)}% -> ${String(r.out).padStart(3)}%   ` +
    `${String(r.cc).padStart(4)}%   ${String(r.mm).padStart(4)}  ${r.bad ? 'POGREŠNO OBRISANO' : 'ok'}`,
  );
}
console.log();
console.log('=== SAŽETAK ===');
console.log(`  pravilo snizilo, a KIŠA PADA (greška) : ${wrongDrop}`);
console.log(`  pravilo snizilo, i suho je (ispravno) : ${rightDrop}`);
console.log(`  netaknuto, kiša pada                  : ${untouchedWet}`);
console.log(`  netaknuto, suho                       : ${untouchedDry}`);
