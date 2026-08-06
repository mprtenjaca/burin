import { fetchJson } from "./client";

/**
 * Meteoalarm izvan Hrvatske (6.8.2026.).
 *
 * ZAŠTO ODVOJENO OD HRVATSKE: za Hrvatsku imamo ručnu tablicu 14 EMMA
 * regija (`emmaRegions.ts`) — provjerena je i točna. Ovdje se regije
 * određuju GEOKODIRANJEM imena iz feeda, što je nužno jer Meteoalarm ne
 * objavljuje ni granice regija ni koordinate (provjereno: `area` nosi
 * samo `areaDesc` i EMMA ID), a regije su po zemlji posve različite —
 * Italija ih ima 19, Austrija 116, Njemačka 409.
 *
 * Geokodiranje je zato REZERVA, ne zamjena: manje je pouzdano i mora se
 * čuvati od promašaja preko granice (izmjereno: "Velebit channel" bez
 * filtra države geokodira se u Velebit u SRBIJI).
 */

/** Zemlje s Meteoalarm feedom — provjereno 6.8.2026. (38 od 40). */
const FEEDS: Record<string, string> = {
  AT: "austria",
  BE: "belgium",
  BA: "bosnia-herzegovina",
  BG: "bulgaria",
  HR: "croatia",
  CY: "cyprus",
  CZ: "czechia",
  DK: "denmark",
  EE: "estonia",
  FI: "finland",
  FR: "france",
  DE: "germany",
  GR: "greece",
  HU: "hungary",
  IS: "iceland",
  IE: "ireland",
  IL: "israel",
  IT: "italy",
  LV: "latvia",
  LT: "lithuania",
  LU: "luxembourg",
  MT: "malta",
  MD: "moldova",
  ME: "montenegro",
  NL: "netherlands",
  NO: "norway",
  PL: "poland",
  PT: "portugal",
  RO: "romania",
  RS: "serbia",
  SK: "slovakia",
  SI: "slovenia",
  ES: "spain",
  SE: "sweden",
  CH: "switzerland",
  UA: "ukraine",
  GB: "united-kingdom",
  AD: "andorra",
};

export function feedNameForCountry(code?: string): string | undefined {
  return code ? FEEDS[code.toUpperCase()] : undefined;
}

/** Ima li ta zemlja Meteoalarm feed. */
export function hasMeteoalarmFeed(code?: string): boolean {
  return feedNameForCountry(code) !== undefined;
}

/**
 * Čisti ime regije za geokodiranje: skida administrativne riječi koje
 * geokoder ne poznaje.
 *
 * Izmjereno 6.8.2026.: "Kreis Goslar" ne daje ništa, a "Goslar" pogađa;
 * isto "Gospic region" → "Gospic". Izvezeno radi testova.
 */
export function cleanRegionName(areaDesc: string): string {
  return areaDesc
    .replace(
      /\b(region|regija|Kreis|Landkreis|Stadt|Provincia|Province|Département|Departement|County|coast|channel|kanal)\b/gi,
      " ",
    )
    // Zagrade nose dopunu ("Eisenstadt (Stadt)"), ne ime.
    .replace(/\(.*?\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type GeoHit = { latitude: number; longitude: number; country_code?: string };
type GeoResponse = { results?: GeoHit[] };

/**
 * Koordinate regije po imenu, ograničeno na zadanu zemlju.
 *
 * Filtar države je OBAVEZAN: bez njega se "Velebit channel" geokodira u
 * Velebit u Srbiji (izmjereno 6.8.2026.), pa bi mjesto dobilo upozorenje
 * iz krive zemlje. Vraća `null` kad ime nije nađeno — takvo se
 * upozorenje jednostavno preskoči.
 */
export async function geocodeRegion(
  areaDesc: string,
  countryCode: string,
): Promise<{ lat: number; lon: number } | null> {
  const name = cleanRegionName(areaDesc);
  if (name.length < 2) return null;
  try {
    const res = await fetchJson<GeoResponse>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}` +
        `&count=5&language=en&format=json`,
    );
    const hit = (res.results ?? []).find(
      (r) => r.country_code?.toUpperCase() === countryCode.toUpperCase(),
    );
    return hit ? { lat: hit.latitude, lon: hit.longitude } : null;
  } catch {
    return null;
  }
}
