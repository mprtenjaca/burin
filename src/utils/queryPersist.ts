/**
 * PRAVILA KEŠA UPITA NA DISKU (10.9.2026.) — čist modul, bez React
 * Nativea, da se pravilo može TESTIRATI. Sam persister se sastavlja u
 * `app/_layout.tsx`; ovdje je samo ono što odlučuje ŠTO smije na disk.
 */

/** Prefiks ključeva u AsyncStorageu; persister dodaje `-<hash upita>`. */
export const QUERY_PREFIX = "burin:q";

/** Zapis stariji od ovoga se pri čitanju preskače, a `persisterGc` ga briše. */
export const QUERY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * PODIĆI kad se promijeni OBLIK nekog spremanog odgovora (npr. novi
 * parametar u `fetchForecast` ili novo polje u `PollenDay`) — stari zapisi
 * se tada preskaču umjesto da se čitaju krivo.
 */
export const QUERY_BUSTER = "1";

/**
 * Prvi element ključa upita koji NE SMIJE na disk:
 *  - `windy-webcams` — URL-ovi slika nose token koji istječe za 10 min;
 *    spremljen bi nakon restarta vraćao 401 i prazne okvire;
 *  - `stampar-pollen` — razvojni HTML izvor, nikad u produkciji;
 *  - `librewxr-frames` — radarski okviri se mijenjaju svakih 10 min,
 *    stari su beskorisni, a pločice se ionako traže po okviru;
 *  - `radar-echo` — uzorak odjeka nad mjestom za JEDAN okvir; jučerašnji
 *    ne govori ništa o danas, a ključ ionako nosi vrijeme okvira;
 *  - `radar-past` — dBZ po prošlim satima (popravak ikona u traci);
 *    vrijedi samo za današnje sate i sadrži Map, koji se ne serijalizira
 *    u JSON kako treba.
 */
export const NOT_ON_DISK: ReadonlySet<string> = new Set([
  "windy-webcams",
  "stampar-pollen",
  "librewxr-frames",
  "radar-echo",
  "radar-past",
]);

/** Smije li upit s ovim ključem na disk. */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  return !NOT_ON_DISK.has(String(queryKey[0]));
}
