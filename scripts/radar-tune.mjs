/**
 * BAŽDARENJE V2 PRAGOVA na datasetu iz `radar-replay.mjs` (11.9.2026.).
 *
 * Ne pogađa pragove — pretraži ih i ispiše što koji daje protiv mjerenja
 * na tlu. Pravilo projekta: „sva mjerenja izmjeriti, protiv termometra".
 *
 *   node scripts/radar-replay.mjs --stations 250 --save replay-dataset.json
 *   node scripts/radar-tune.mjs replay-dataset.json
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'replay-dataset.json';
const { rows } = JSON.parse(readFileSync(file, 'utf8'));
const wet = rows.filter((r) => r.truth.wet);
const dry = rows.filter((r) => !r.truth.wet);

console.log(`dataset: ${rows.length} postaja (${wet.length} mokrih, ${dry.length} suhih)\n`);

/** Kvaliteta pravila: pogodak na mokrima i na suhima, pa F1. */
function score(pred) {
  const tp = wet.filter(pred).length;
  const fn = wet.length - tp;
  const fp = dry.filter(pred).length;
  const tn = dry.length - fp;
  const recall = wet.length ? tp / wet.length : 0;
  const spec = dry.length ? tn / dry.length : 0;
  const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
  const f1 = prec + recall > 0 ? (2 * prec * recall) / (prec + recall) : 0;
  return { tp, fn, fp, tn, recall, spec, prec, f1 };
}

const pc = (x) => `${(100 * x).toFixed(0)}%`.padStart(4);
const line = (name, s) =>
  console.log(
    name.padEnd(34),
    `mokro ${pc(s.recall)}  suho ${pc(s.spec)}  tocnost ${pc(s.prec)}  F1 ${s.f1.toFixed(3)}`,
    ` TP ${String(s.tp).padStart(2)} FP ${String(s.fp).padStart(2)} FN ${String(s.fn).padStart(2)}`,
  );

// ---- pojedinačni featurei ----
console.log('=== JEDAN FEATURE, najbolji prag ===');
const FEATURES = [
  ['maxDbz', (r) => r.stats.maxDbz ?? 0, [5, 10, 15, 20, 25, 28, 30, 35, 40]],
  ['p90Dbz', (r) => r.stats.p90Dbz ?? 0, [5, 10, 15, 20, 25, 28, 30, 35]],
  ['medianDbz', (r) => r.stats.medianDbz ?? 0, [3, 5, 8, 10, 15, 20, 25]],
  ['weightedMeanDbz', (r) => r.stats.weightedMeanDbz ?? 0, [2, 3, 5, 8, 10, 15, 20]],
  ['coverage20 %', (r) => 100 * r.stats.coverage20, [1, 2, 5, 10, 15, 20, 30, 40]],
  ['weightedCoverage20 %', (r) => 100 * r.stats.weightedCoverage20, [1, 2, 5, 10, 15, 20, 30]],
  ['coverage28 %', (r) => 100 * r.stats.coverage28, [0.5, 1, 2, 5, 10, 20]],
  ['persistence %', (r) => 100 * r.temporal.persistence, [10, 20, 25, 40, 50, 60, 75, 100]],
  ['echoAgeMin', (r) => r.temporal.echoAgeMin, [1, 10, 20, 30, 40]],
];
const best = {};
for (const [name, f, grid] of FEATURES) {
  let bestOne = null;
  for (const th of grid) {
    const s = score((r) => f(r) >= th);
    if (!bestOne || s.f1 > bestOne.s.f1) bestOne = { th, s };
  }
  best[name] = bestOne;
  line(`${name} >= ${bestOne.th}`, bestOne.s);
}

// ---- kombinacije ----
console.log('\n=== KOMBINACIJE (ILI / I) ===');
const combos = [
  ['cov20>=2 ILI pers>=50', (r) => 100 * r.stats.coverage20 >= 2 || 100 * r.temporal.persistence >= 50],
  ['cov20>=5 ILI pers>=50', (r) => 100 * r.stats.coverage20 >= 5 || 100 * r.temporal.persistence >= 50],
  ['cov20>=2 I pers>=25', (r) => 100 * r.stats.coverage20 >= 2 && 100 * r.temporal.persistence >= 25],
  ['cov20>=5 I pers>=25', (r) => 100 * r.stats.coverage20 >= 5 && 100 * r.temporal.persistence >= 25],
  ['wcov20>=2 I pers>=25', (r) => 100 * r.stats.weightedCoverage20 >= 2 && 100 * r.temporal.persistence >= 25],
  ['p90>=10 I cov20>=2', (r) => (r.stats.p90Dbz ?? 0) >= 10 && 100 * r.stats.coverage20 >= 2],
  ['p90>=15 ILI cov20>=10', (r) => (r.stats.p90Dbz ?? 0) >= 15 || 100 * r.stats.coverage20 >= 10],
  ['V1 (max>=20)', (r) => r.v1.precip],
];
for (const [name, pred] of combos) line(name, score(pred));

// ---- bodovni model (prototip V2 scorera) ----
console.log('\n=== BODOVNI MODEL: confidence = w1*cov + w2*pers + w3*p90, prag varira ===');
function confidence(r) {
  const cov = Math.min(1, (100 * r.stats.weightedCoverage20) / 20);
  const pers = r.temporal.persistence;
  const str = Math.min(1, (r.stats.p90Dbz ?? 0) / 28);
  const raw = 0.45 * cov + 0.35 * pers + 0.20 * str;
  // clutter snizava, ne obara
  return Math.max(0, raw * (1 - 0.4 * r.clutter));
}
for (const th of [0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4]) {
  line(`confidence >= ${th}`, score((r) => confidence(r) >= th));
}

// ---- gdje V1 gubi ----
console.log('\n=== PROPUSTENE (V1 kaze suho, a pada) — koliko jako pada? ===');
const missed = wet.filter((r) => !r.v1.precip).sort((a, b) => b.truth.mmh - a.truth.mmh);
console.log('mm/h   maxDbz  p90  cov20  pers  conf');
for (const r of missed.slice(0, 15)) {
  console.log(
    r.truth.mmh.toFixed(1).padStart(4),
    String(r.stats.maxDbz ?? 0).padStart(7),
    String(Math.round(r.stats.p90Dbz ?? 0)).padStart(5),
    pc(r.stats.coverage20),
    pc(r.temporal.persistence),
    confidence(r).toFixed(2).padStart(6),
  );
}
const invisible = missed.filter((r) => (r.stats.maxDbz ?? 0) === 0).length;
console.log(`\nod ${missed.length} propustenih, ${invisible} ima 0 dBZ — radar ih NE VIDI (nije stvar pragova)`);

console.log('\n=== LAZNE (V1 kaze pada, a suho) ===');
const falses = dry.filter((r) => r.v1.precip);
console.log('maxDbz  p90  cov20  pers  clutter  conf');
for (const r of falses.slice(0, 15)) {
  console.log(
    String(r.stats.maxDbz ?? 0).padStart(6),
    String(Math.round(r.stats.p90Dbz ?? 0)).padStart(5),
    pc(r.stats.coverage20),
    pc(r.temporal.persistence),
    pc(r.clutter),
    confidence(r).toFixed(2).padStart(6),
  );
}
