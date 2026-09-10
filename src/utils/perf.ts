/**
 * PERF OZNAKE — mjerenje puta „dodir na grad → sadržaj na početnoj"
 * (10.9.2026.).
 *
 * Pouka od 9.9.: pet popravaka brzine koji NISU bili izmjereni palo je na
 * uređaju. Ovo je alat da se brzina mjeri BROJKOM, ne dojmom: svaka
 * karika lanca (dodir, render početne, početak i kraj prijelaza, dolazak
 * pojedinog upita, sastavljen paket, montiran heroj, montirana karta)
 * upiše svoj trenutak, a `report()` ispiše delte od dodira.
 *
 * RADI SAMO U RAZVOJU ili uz `EXPO_PUBLIC_PERF=1` (zapečeno pri
 * pakiranju): u običnoj produkcijskoj gradnji svaka funkcija je no-op,
 * pa oznake smiju ostati u kodu — ne troše ništa i ne pišu u konzolu.
 *
 * Kako čitati: nakon dodira u tražilici konzola dobije jedan blok
 *
 *   [perf] search:tap → home:render +18 ms, home:transitionStart +41 ms,
 *          q:current +612 ms, q:forecast +780 ms, bundle:fresh +791 ms, …
 *
 * Ono što traje predugo vidi se odmah; ono što se ne dogodi (npr.
 * `home:transitionStart` nikad) vidi se po tome što ga nema.
 */

const ENABLED = __DEV__ || process.env.EXPO_PUBLIC_PERF === "1";

/** Oznaka od koje se računaju delte — dodir na grad u tražilici. */
const ORIGIN = "search:tap";

/** Koliko dugo nakon dodira još primamo oznake u isti blok. */
const WINDOW_MS = 8_000;

let origin: number | undefined;
let marks: { label: string; at: number }[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function now(): number {
  // Hermes ima `performance.now()`; rezerva za okoline gdje ga nema (jest).
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/**
 * Upiši oznaku. `ORIGIN` otvara novi blok; ostale se lijepe na otvoreni.
 * Oznake bez otvorenog bloka (npr. pri pokretanju aplikacije) se tiho
 * odbacuju — mjerimo prijelaz, ne cijeli život aplikacije.
 */
export function mark(label: string, detail?: string): void {
  if (!ENABLED) return;
  const at = now();
  if (label === ORIGIN) {
    if (flushTimer) clearTimeout(flushTimer);
    origin = at;
    marks = [];
    flushTimer = setTimeout(report, WINDOW_MS);
    return;
  }
  if (origin === undefined || at - origin > WINDOW_MS) return;
  marks.push({ label: detail ? `${label}(${detail})` : label, at });
}

/** Ispiši otvoreni blok i zatvori ga. Zove se sam nakon `WINDOW_MS`. */
export function report(): void {
  if (!ENABLED || origin === undefined) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = undefined;
  const base = origin;
  const line = marks.map((m) => `${m.label} +${Math.round(m.at - base)} ms`).join(", ");
  // eslint-disable-next-line no-console
  console.log(`[perf] ${ORIGIN} → ${line || "(bez oznaka)"}`);
  origin = undefined;
  marks = [];
}
