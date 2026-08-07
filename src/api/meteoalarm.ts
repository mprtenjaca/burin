import type { EmmaId } from "@/utils/emmaRegions";
import { regionsForPlace } from "@/utils/emmaRegions";

import { fetchJson } from "./client";

/**
 * DHMZ upozorenja preko Meteoalarma (feeds.meteoalarm.org). JSON API
 * umjesto Atom feeda: jedan upit vraća SVA upozorenja s hrvatskim
 * tekstom inline (`info` blok s `language: hr-HR`, izravno od DHMZ-a) —
 * Atom bi tražio zaseban CAP XML dohvat po upozorenju za hrvatski.
 * Provjereno 6.8.2026.: 200 bez ključa, hr-HR + en-GB po upozorenju.
 *
 * Odgovor uključuje i povijest (isteklo, zamijenjeno) — filtrira se po
 * `expires` i status "Actual", a Update istog upozorenja pobjeđuje po
 * najnovijem `sent`.
 */
const FEED_BASE = "https://feeds.meteoalarm.org/api/v1/warnings/feeds-";
const FEED_URL = `${FEED_BASE}croatia`;

/** Meteoalarm razina; zeleno (1) se ne objavljuje kao upozorenje. */
export type WarningLevel = 2 | 3 | 4;

/** Meteoalarm awareness_type — 1 vjetar, 5 vrućina, 10 kiša, 3 grmljavina... */
export type WarningType = number;

export type MeteoWarning = {
  /** CAP identifier — stabilan ključ za liste. */
  id: string;
  /**
   * EMMA ID regije. Za Hrvatsku je iz naše tablice (HR001…HR806); izvan
   * nje je kod te zemlje (AT707, DE…), pa je tip širi od `EmmaId`.
   */
  region: EmmaId | string;
  /** Ime regije iz feeda — izvan Hrvatske jedini opis koji imamo. */
  areaDesc?: string;
  level: WarningLevel;
  type: WarningType;
  /** Hrvatski naslov, npr. "Crveno upozorenje za vrućinu". */
  event: string;
  /** DHMZ opis, npr. "Toplinski val. maksimalna temperatura > 36 °C". */
  description?: string;
  /** DHMZ uputa, npr. "BUDITE NA OPREZU zbog vrućina...". */
  instruction?: string;
  /** Epoch ms. */
  onset: number;
  expires: number;
  sent: number;
};

// ---- sirovi oblik odgovora (samo polja koja se čitaju) ----

type RawParameter = { valueName?: string; value?: string };
type RawGeocode = { valueName?: string; value?: string };
type RawArea = { areaDesc?: string; geocode?: RawGeocode[] };
type RawInfo = {
  language?: string;
  event?: string;
  description?: string;
  instruction?: string;
  onset?: string;
  expires?: string;
  parameter?: RawParameter[];
  area?: RawArea[];
};
type RawAlert = {
  identifier?: string;
  status?: string;
  sent?: string;
  info?: RawInfo[];
};
type RawFeed = { warnings?: { alert?: RawAlert }[] };

/** "2; yellow; Moderate" -> 2. */
function parseLevel(info: RawInfo): WarningLevel | undefined {
  const p = info.parameter?.find((x) => x.valueName === "awareness_level");
  const n = Number.parseInt(p?.value ?? "", 10);
  return n === 2 || n === 3 || n === 4 ? n : undefined;
}

/** "5; high-temperature" -> 5. */
function parseType(info: RawInfo): WarningType {
  const p = info.parameter?.find((x) => x.valueName === "awareness_type");
  const n = Number.parseInt(p?.value ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

function parseTime(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * Feed -> upozorenja na snazi. Izvezeno radi testova. Nikad ne baca:
 * neispravan oblik daje prazan niz (react-query brani `undefined`,
 * a bez feeda aplikacija mora normalno raditi — samo bez trake).
 */
export function parseMeteoalarm(
  raw: unknown,
  now: number = Date.now(),
  /**
   * Jezik teksta upozorenja — prefiks koda iz feeda (`hr` → hr-HR,
   * `en` → en-GB). Zadano hrvatski, da postojeći pozivi i testovi ostanu
   * nepromijenjeni; pravu vrijednost prosljeđuje `fetchWarnings`.
   */
  lang: string = "hr",
): MeteoWarning[] {
  const feed = raw as RawFeed;
  if (!Array.isArray(feed?.warnings)) return [];

  const parsed: MeteoWarning[] = [];
  for (const entry of feed.warnings) {
    const alert = entry?.alert;
    if (!alert || alert.status !== "Actual") continue;
    const sent = parseTime(alert.sent);
    /*
     * Jezik prati SUČELJE (dorada 6.8.2026.): DHMZ objavljuje i hr-HR i
     * en-GB blok za svako upozorenje (provjereno na živom feedu — sva
     * 198 upozorenja imaju oba), pa engleski korisnik dobiva engleski
     * tekst izravno od izvora, bez strojnog prijevoda.
     *
     * Redoslijed rezervi: traženi jezik → engleski → prvi ponuđeni.
     * Engleski je međurezerva jer izvan Hrvatske hr-HR bloka nema, a
     * engleski je čitljiviji od npr. njemačkog ili talijanskog.
     */
    const info =
      alert.info?.find((i) => i.language?.startsWith(lang)) ??
      alert.info?.find((i) => i.language?.startsWith("en")) ??
      alert.info?.[0];
    if (!info?.event || sent === undefined) continue;

    const level = parseLevel(info);
    const onset = parseTime(info.onset);
    const expires = parseTime(info.expires);
    if (level === undefined || onset === undefined || expires === undefined) continue;
    if (expires <= now) continue;

    for (const area of info.area ?? []) {
      const region = area.geocode?.find((g) => g.valueName === "EMMA_ID")?.value;
      if (!region) continue;
      parsed.push({
        id: alert.identifier ?? `${region}-${onset}-${level}`,
        region: region as EmmaId,
        areaDesc: area.areaDesc,
        level,
        type: parseType(info),
        event: info.event,
        description: info.description || undefined,
        instruction: info.instruction || undefined,
        onset,
        expires,
        sent,
      });
    }
  }

  /*
   * Update zamjenjuje raniji Alert za isto (regija, vrsta, razdoblje) —
   * oba su "Actual" i oba još vrijede, pa bi se bez ovoga isto upozorenje
   * pokazalo dvaput. Pobjeđuje najnoviji `sent`.
   */
  const byKey = new Map<string, MeteoWarning>();
  for (const w of parsed) {
    const key = `${w.region}|${w.type}|${w.level}|${w.onset}|${w.expires}`;
    const existing = byKey.get(key);
    if (!existing || w.sent > existing.sent) byKey.set(key, w);
  }
  return [...byKey.values()];
}

/**
 * Dohvat + parsiranje; svaka greška vraća prazan niz (tihi izostanak).
 * Bez `feed` imena ide hrvatski feed — zadana zemlja aplikacije.
 */
export async function fetchMeteoalarmWarnings(
  feed = "croatia",
  /** Jezik teksta upozorenja — vidi `parseMeteoalarm`. */
  lang = "hr",
): Promise<MeteoWarning[]> {
  try {
    return parseMeteoalarm(
      await fetchJson<unknown>(`${FEED_BASE}${feed}`),
      Date.now(),
      lang,
    );
  } catch {
    return [];
  }
}

/**
 * Upozorenja koja pogađaju mjesto: kopnena regija + pomorski pojas
 * (vidi `regionsForPlace`), poredano najteže pa najranije — prvi je
 * ono što heroj pokazuje.
 */
export function warningsForPlace(
  all: MeteoWarning[],
  lat: number,
  lon: number,
): MeteoWarning[] {
  const regions = new Set<string>(regionsForPlace(lat, lon));
  return all
    .filter((w) => regions.has(w.region))
    .sort((a, b) => b.level - a.level || a.onset - b.onset);
}
