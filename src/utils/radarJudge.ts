import type { RadarEcho } from "@/api/radarSample";

/**
 * SUDAC ZA `current.code` — tko odlučuje što heroj piše i crta (10.9.2026.).
 *
 * Tri izvora, tri različite svježine, tri različite snage:
 *
 *   radar (RainViewer) 1–10 min   zna JAKU jezgru i zna kad je NEMA;
 *                                 između (slaba kiša / isparavanje) ne zna
 *   postaja (DHMZ)     30–120 min zna naoblaku, maglu, temperaturu, vjetar;
 *                                 za oborinu je snimka termina, ne „sada"
 *   model (Open-Meteo) 6–12 h     zna trend; za kišu koja pada ne zna
 *                                 (Crikvenica: 61 uz prazan radar; Verona:
 *                                 61 „rosulja" uz 47 dBZ)
 *
 * Do 10.9. je postaja pobjeđivala model bez pitanja (točno za naoblaku),
 * pa je „grmljavina s oborinom" iz termina stajala do sljedećeg iako je
 * jezgra prošla za 20 min. Sad radar dira SAMO krajnosti oborine; sve
 * ostalo ostaje kako je bilo.
 *
 * TRI PRAVILA, svako s vlastitim temeljem (mjerenja 10.9.2026., RainViewer
 * vs mjerenje na tlu — Austrija mm/10 min, 270 postaja; Slovenija pojava,
 * 20 postaja; Hrvatska tekst, 46 postaja × 2 termina):
 *
 *  1. OBARANJE, < 20 dBZ: postaja ili model tvrde oborinu, radar ne vidi
 *     ništa → oborine nema, ostaje nebo. Izmjereno: od 269 postaja pod
 *     20 dBZ samo 13 (5 %) je bilo mokro — i to rosulja od 0.1 mm.
 *  2. PODIZANJE, ≥ 42 dBZ: jaka jezgra → jaka kiša, čak i kad model kaže
 *     rosulja. Temelj: nijedna od 290 postaja bez oborine nije prešla
 *     37 dBZ (0 lažnih), a 42 dBZ ≈ 11 mm/h fizički ne isparava do tla.
 *     Grmljavina se piše samo ako to potvrđuje i drugi izvor (postaja ≤ 90
 *     min ili model) — munje radar ne vidi.
 *  3. IZMEĐU (20–42): ne dira se. Tu radar ne razlikuje slabu kišu na tlu
 *     od kiše koja isparava u oblaku (Loibl 42 dBZ uz 0 mm; Zadar 19 dBZ
 *     uz „slaba kiša") — pa odlučuje postaja, pa model, kao do sada.
 *
 * Pouke koje ovaj modul kodira:
 *  - „ima odjeka" NIJE „pada": 12 dBZ je 0.1 mm/h (Zadar 13:20, Marko:
 *    „ne pada, oblačno").
 *  - LibreWXR NIJE sudac: 10–25 dBZ jači od RainViewera na istim točkama,
 *    100 % nepomičan odjek nad Dalmacijom (Polača 42 uz suho, RV 17).
 *  - usporedba mora biti u ISTOM trenutku (radar 13:20 vs DHMZ 12:00 dao
 *    je besmislice); DHMZ `Termin` je LOKALNI sat.
 *  - pravila su ISTA za sve zemlje; Hrvatska samo ima jedan izvor više
 *    (postaju). Nema prekidača po državi — to bi bilo posebno po mjestu.
 */

/** Ispod ovoga radar kaže „ne pada" (95 % suhih od 269 postaja). */
export const DBZ_DRY = 20;
/** Od ovoga „jaka oborina" (0 lažnih na 290 postaja; ~11 mm/h). */
export const DBZ_HEAVY = 42;
/**
 * Od ovoga GRMLJAVINA i bez drugog izvora (10.9.2026., Markov nalaz na
 * Lombardiji: „Vrijeme&Radar kaže grmljavinsko nevrijeme, naša app jaka
 * kiša").
 *
 * Zašto se ovdje smije izmisliti grmljavina koju radar ne vidi: 55 dBZ je
 * ~100 mm/h, a takvu jezgru fizički diže SAMO konvektivni oblak — slojasta
 * kiša ne dolazi ni blizu. Izmjereno u tom trenutku: Quistello 60 dBZ,
 * Verona 55, a kišomjeri ARPA Lombardije u okolici bilježe **6.4 mm i
 * 5.2 mm u DESET minuta** (Bigarello, Mantova S.Agnese) — 38 mm/h, dakle
 * pljusak. Model je za Veronu i Quistello ondje tvrdio kod 61 („slaba
 * kiša"), pa se na njega nije imalo što nasloniti; za Mantovu je dao 95.
 *
 * Ispod 55 pravilo ostaje staro: grmljavina samo uz potvrdu postaje ili
 * modela — munje radar ne vidi i ne smije ih nagađati iz 45 dBZ.
 */
export const DBZ_STORM = 55;
/** Okvir stariji od ovoga se ne uzima — radar tada šuti. */
export const RADAR_MAX_AGE_MIN = 20;
/**
 * Tekst OBORINE s postaje stariji od ovoga ne vrijedi ni kad radar šuti —
 * grmljavina traje 20 min; termin je satni, objavljen 30–70 min kasnije.
 * Naoblaka i magla nemaju rok.
 */
export const STATION_PRECIP_MAX_AGE_MIN = 90;
/** Koliko dugo postaja smije „svjedočiti" grmljavinu uz jaku jezgru. */
export const STATION_THUNDER_MAX_AGE_MIN = 90;

export type CodeSource = "radar" | "station" | "model";

export type JudgeInput = {
  /** Kod iz DHMZ teksta (`dhmzTextToCode`), ili `undefined` kad ga nema. */
  stationCode?: number;
  /** Starost mjerenja s postaje u minutama (`Infinity` kad nije poznata). */
  stationAgeMin?: number;
  /** Kod iz modela za „sada". */
  modelCode: number;
  /** Naoblaka iz modela, %. */
  cloudCover: number;
  /** Temperatura, °C — bira kišu ili snijeg. */
  temp: number;
  /** Radarski odjek; `undefined` = radar nedostupan. */
  echo?: RadarEcho;
  /** Ima li radar nad točkom (RainViewer coverage). Bez toga radar šuti. */
  covered?: boolean;
  /** Sada, epoch ms. */
  nowMs: number;
};

export type Judged = { code: number; source: CodeSource };

export const isThunder = (c: number) => c >= 95 && c <= 99;
export const isFog = (c: number) => c === 45 || c === 48;
export const isPrecip = (c: number) => (c >= 51 && c <= 67) || (c >= 71 && c <= 86) || isThunder(c);
export const isCloudCode = (c: number) => c >= 0 && c < 4;

/**
 * Naoblaka u WMO kod, s vlastitim razredom 3.5 („pretežno oblačno") koji
 * aplikacija već ima. Granice su na jednakim koracima kroz pet razreda.
 */
export function cloudCodeFromCover(pct: number): number {
  if (pct <= 12) return 0;
  if (pct <= 37) return 1;
  if (pct <= 62) return 2;
  if (pct <= 87) return 3.5;
  return 3;
}

/** Postaja i model kao do 10.9. — ali OBORINA s postaje ima rok trajanja. */
function stationThenModel(i: JudgeInput): Judged {
  const s = i.stationCode;
  if (s !== undefined) {
    if (isPrecip(s) && (i.stationAgeMin ?? Infinity) > STATION_PRECIP_MAX_AGE_MIN) {
      return { code: i.modelCode, source: "model" };
    }
    return { code: s, source: "station" };
  }
  return { code: i.modelCode, source: "model" };
}

/** Nebo bez oborine: postaja ako govori o nebu ili magli, inače model. */
function skyOnly(i: JudgeInput): Judged {
  const s = i.stationCode;
  if (s !== undefined && (isFog(s) || isCloudCode(s))) return { code: s, source: "station" };
  return { code: cloudCodeFromCover(i.cloudCover), source: "radar" };
}

/**
 * Odluka o kodu „sada". Nikad ne baca; bez radara i bez postaje vraća model.
 */
export function judgeCurrentCode(i: JudgeInput): Judged {
  const ageMin = i.echo ? (i.nowMs / 1000 - i.echo.frameTime) / 60 : Infinity;
  const radarSpeaks = i.echo !== undefined && i.covered === true && ageMin <= RADAR_MAX_AGE_MIN;
  if (!radarSpeaks) return stationThenModel(i);

  const dbz = i.echo!.maxDbz ?? -Infinity;

  // 2. PODIZANJE: jaka jezgra je oborina, što god postaja i model tvrdili.
  if (dbz >= DBZ_HEAVY) {
    const stationThunder =
      i.stationCode !== undefined && isThunder(i.stationCode) && (i.stationAgeMin ?? Infinity) <= STATION_THUNDER_MAX_AGE_MIN;
    // Konvektivna jezgra (≥ 55 dBZ) je grmljavina sama po sebi — vidi
    // `DBZ_STORM`. Ispod toga treba potvrda postaje ili modela.
    if (dbz >= DBZ_STORM || stationThunder || isThunder(i.modelCode)) {
      return { code: 95, source: "radar" };
    }
    return { code: i.temp <= 1 ? 75 : 65, source: "radar" };
  }

  // 1. OBARANJE: radar ne vidi ništa → tko god tvrdi oborinu, u krivu je.
  if (dbz < DBZ_DRY) {
    const claimed = stationThenModel(i);
    if (isPrecip(claimed.code)) return skyOnly(i);
    return claimed;
  }

  // 3. IZMEĐU: radar ne zna — postaja, pa model, kao do sada.
  return stationThenModel(i);
}

/**
 * `measuredAt` iz DHMZ feeda („10.09.2026. 12:00", lokalno) → starost u
 * minutama u odnosu na `nowMs`. Nepoznat oblik → `Infinity` (= „staro").
 */
export function stationAgeMinutes(measuredAt: string | undefined, nowMs: number): number {
  const m = measuredAt?.match(/(\d{2})\.(\d{2})\.(\d{4})\.\s*(\d{1,2}):(\d{2})/);
  if (!m) return Infinity;
  const [, dd, mm, yyyy, hh, min] = m;
  const t = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min)).getTime();
  return (nowMs - t) / 60_000;
}
