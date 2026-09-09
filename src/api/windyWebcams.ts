import { haversineKm } from "@/utils/geo";

import { fetchJson } from "./client";

/**
 * Web kamere iz Windy Webcams API-ja (9.9.2026.).
 *
 * ŠTO OVO JEST, a što nije: Windyjev „live" je ZADNJA SNIMLJENA SLIKA, ne
 * video. Provjereno na njihovom javnom playeru za hrvatsku kameru (Tkon):
 * `playerType=live` poslužuje `.jpg` s `Cache-Control: max-age=150`, a u
 * cijelom playeru nema ni jednog `.m3u8`/`.mp4`. Zato se sekcija u
 * aplikaciji zove „Kamere", ne „Live" — obećanje mora odgovarati stvari.
 *
 * Pravi live video imaju WhatsUpCams (čije kamere Windy i distribuira —
 * 200+ u Hrvatskoj), ali SAMO kroz vlastiti iframe player
 * (`services.whatsupcams.com/wgt/<id>/`, Flowplayer + hls.js); javnog
 * API-ja nemaju (`/api` → 404). Uz to LiveCamCroatia tvrdi izključna prava
 * za hrvatske kamere i traži pismeno dopuštenje — isti obrazac na kojem je
 * odbijena Pliva. Zato ide Windy.
 *
 * PRAVNO (uvjeti Windyja): mobilna aplikacija je IZRIČITO dopuštena na
 * besplatnoj razini uz navođenje Windyja kao izvora, i svaka slika mora
 * biti povezana s njihovom stranicom. Dva uvjeta koja treba pamtiti:
 * usluga se ne smije staviti SAMO u plaćeni dio aplikacije, i slike se
 * koriste u izvornoj veličini ili manjoj (bez razvlačenja).
 *
 * TOKEN: URL-ovi slika koje API vrati nose token koji na besplatnoj razini
 * ISTJEČE ZA 10 MINUTA (profesionalna: 24 h), nakon čega ta adresa vraća
 * HTTP 401. Ne istječe kamera — istječe LINK, a novi se dobije običnim
 * ponovnim upitom; njihova dokumentacija to i preporučuje („call … every
 * time the page is loaded"). Posljedica za nas: keš mora biti KRAĆI od 10
 * min (vidi `useWebcams`), i ovo je prvi dio aplikacije koji bez mreže ne
 * može pokazati staru vrijednost — sve ostalo (`lastWeather`) preživi.
 */

const KEY = process.env.EXPO_PUBLIC_WINDY_API_KEY;
const API_URL = "https://api.windy.com/webcams/api/v3/webcams";

/**
 * Bez ključa se sekcija kamera NE PRIKAZUJE (ista odluka kao `hasOwmKey`).
 *
 * Zaštita je u kodu, a ne u konfiguraciji: bez ovoga bi produkcijska
 * gradnja bez ključa imala prazan okvir pod kartom. Isto načelo kao kod
 * Štampara — nema prekidača koji se zaboravi.
 */
export function hasWindyKey(): boolean {
  return typeof KEY === "string" && KEY.trim().length > 0;
}

/** Jedna kamera, svedena na ono što kartica i ekran crtaju. */
export type Webcam = {
  id: string;
  title: string;
  lat: number;
  lon: number;
  /** Zračna udaljenost od odabranog mjesta, km — puni `nearestWebcams`. */
  distanceKm: number;
  /** Slika za karticu (manja) i za ekran (veća); token istječe za 10 min. */
  preview?: string;
  full?: string;
  /** Windyjeva stranica te kamere — obveza iz uvjeta (slika je link). */
  pageUrl?: string;
  /** Kad je slika snimljena (ms) — kartica piše „prije 3 min". */
  takenAtMs?: number;
};

/*
 * Oblik odgovora v3. Sve je neobavezno jer se parser NE SMIJE srušiti na
 * polju koje Windy preimenuje ili izostavi za pojedinu kameru — kamere su
 * ukras, ne podatak zbog kojeg app pada.
 */
type RawWebcam = {
  webcamId?: number | string;
  title?: string;
  status?: string;
  location?: { latitude?: number; longitude?: number; city?: string };
  /*
   * Oblik POTVRĐEN na pravom odgovoru (9.9.2026., kamera Tkon):
   * URL-ovi su SAMO u `images.current` i `images.daylight`, u tri
   * veličine (icon 48px · thumbnail 200px · preview 400×224).
   *
   * `images.sizes` NIJE mjesto s adresama nego s DIMENZIJAMA
   * (`{preview: {width, height}}`) — prva verzija je odande čitala
   * `sizes.preview.url`, dobivala `undefined`, i kartica je zbog toga
   * pokazivala „nema kamera" iako ih je API vratio (Markov nalaz za
   * Polaču). Nema veličine veće od `preview`.
   */
  images?: {
    current?: { preview?: string; thumbnail?: string; icon?: string };
    daylight?: { preview?: string; thumbnail?: string };
  };
  urls?: { detail?: string; edit?: string; provider?: string };
  lastUpdatedOn?: string;
};
type RawResponse = { total?: number; webcams?: RawWebcam[] };

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/**
 * Imena koja Windy vrati, a koja korisniku ne govore ništa.
 *
 * „unknown" se stvarno pojavio u popisu za Zadar (Markov nalaz 9.9.2026.).
 * Ostalo je isti razred: prazan naziv, generički „webcam"/„cam 3", ili
 * naziv koji je samo broj. Slika bez mjesta ne govori ništa o vremenu jer
 * se ne zna GDJE je — pa takva kamera ispada iz popisa.
 */
function isUsableName(name: string): boolean {
  if (name.length < 2) return false;
  const s = name.toLowerCase();
  if (s === "unknown" || s === "n/a" || s === "null" || s === "-") return false;
  // Samo brojka ili „cam 3" / „webcam 12" — nije mjesto.
  if (/^[\d\s#-]+$/.test(s)) return false;
  if (/^(web)?cam(era)?\b[\s\d#-]*$/.test(s)) return false;
  return true;
}

/**
 * Izvezeno radi testova: odgovor Windyja → naše kamere, sortirane po
 * udaljenosti od zadane točke.
 *
 * Kamere bez koordinata se ODBACUJU — bez njih se ne može reći koliko su
 * daleko, a „kamera u blizini" bez udaljenosti nije informacija.
 */
export function parseWebcams(
  raw: unknown,
  lat: number,
  lon: number,
): Webcam[] {
  const list = (raw as RawResponse)?.webcams;
  if (!Array.isArray(list)) return [];

  const out: Webcam[] = [];
  for (const w of list) {
    const wLat = num(w?.location?.latitude);
    const wLon = num(w?.location?.longitude);
    if (wLat === undefined || wLon === undefined) continue;

    const id = w?.webcamId === undefined ? undefined : String(w.webcamId);
    if (!id) continue;

    /*
     * KAMERA BEZ IMENA SE ODBACUJE (Markov nalaz 9.9.2026.: „ako nema ime
     * ne pokazuj").
     *
     * Windy vraća i kamere kojima je `location.city` prazan ili doslovno
     * „unknown", a `title` beskoristan („Cam 3"). Prije je fallback bio
     * `#<id>`, pa se u popisu za Zadar pojavila kamera imena „unknown" —
     * slika bez mjesta ne govori NIŠTA o vremenu jer se ne zna gdje je.
     * Nema pametnog imena → nema kartice.
     */
    const rawName = (w?.location?.city ?? w?.title ?? "").trim();
    if (!isUsableName(rawName)) continue;

    /*
     * Samo AKTIVNE kamere. Windy vraća i one sa statusom „inactive" —
     * njihova zadnja slika može biti stara danima, a slika od prošlog
     * tjedna o današnjem vremenu laže gore nego prazan okvir.
     */
    if (w?.status !== undefined && w.status !== "active") continue;

    /*
     * `current` je zadnja snimka, `daylight` zadnja DNEVNA — druga je
     * rezerva za kamere koje noću ne daju sliku. Ispod toga thumbnail:
     * manja slika je bolja od praznog okvira.
     *
     * `preview` (400×224) je najveća veličina koju v3 daje, pa je i
     * `full` isti URL — nema većeg.
     */
    const preview =
      w?.images?.current?.preview ??
      w?.images?.daylight?.preview ??
      w?.images?.current?.thumbnail ??
      w?.images?.daylight?.thumbnail;
    const full = preview;

    const taken = w?.lastUpdatedOn ? Date.parse(w.lastUpdatedOn) : NaN;

    out.push({
      id,
      // Ime mjesta je korisnije od naslova kamere ("Cam 3"), kad postoji.
      // Bez upotrebljivog imena se ovdje uopće ne dolazi (vidi filtar iznad).
      title: rawName,
      lat: wLat,
      lon: wLon,
      distanceKm: haversineKm({ lat, lon }, { lat: wLat, lon: wLon }),
      preview,
      full,
      // Obveza iz uvjeta: slika mora vesti na Windyjevu stranicu kamere.
      pageUrl: w?.urls?.detail ?? `https://www.windy.com/webcams/${id}`,
      takenAtMs: Number.isFinite(taken) ? taken : undefined,
    });
  }

  out.sort((a, b) => a.distanceKm - b.distanceKm);

  /*
   * NAJVIŠE JEDNA KAMERA PO MJESTU (9.9.2026.).
   *
   * Izmjereno na pravom odgovoru za Polaču: od 10 vraćenih kamera njih
   * **pet je bio Tkon**, sve na 4.2 km. Popis od pet slika istog mjesta ne
   * govori ništa više od jedne, a istisne susjedna mjesta iz `LIMIT`-a.
   * Zadržava se najbliža (niz je već sortiran).
   *
   * Ovo NE dira grad s vlastitim kamerama na različitim lokacijama unutar
   * istog imena — takve Windy ionako vraća pod istim `city`, pa je jedna
   * po mjestu ispravan izbor i tamo.
   */
  const seen = new Set<string>();
  return out.filter((w) => {
    const key = w.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Domet traženja, u kilometrima.
 *
 * NE određuje što se prikazuje — to radi `pickWebcams` po IMENU MJESTA
 * (vidi ispod). Ovo je samo koliko se široko pita Windy: dovoljno da se
 * uhvate i kamere susjednih mjesta, za slučaj da grad svoju nema.
 */
export const WEBCAM_RANGE_KM = 25;
/*
 * 100 km, ne 60 (9.9.2026.): kad mjesto nema svoju kameru, najbliža se
 * pokazuje OBAVEZNO (Markov zahtjev za Polaču i Pridragu), pa širi krug
 * mora dosegnuti kameru i iz Like ili Slavonije. Traži se samo kad bliži
 * ne da ništa, i kešira 5 min — dodatni poziv plaćaju samo mjesta bez
 * kamere u 25 km.
 */
export const WEBCAM_RANGE_WIDE_KM = 100;

/**
 * Usporedba imena mjesta bez dijakritike i sufiksa („Zadar-aerodrom",
 * „Zadar (Puntamika)" → „zadar"). Bez ovoga bi ista mjesta ispadala
 * različita zbog jednog slova.
 */
function normalizePlace(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    // Kombinirajući dijakritički znakovi (U+0300–U+036F) — „Šibenik" →
    // „sibenik". `đ` se ne razlaže NFD-om, pa ide zasebno.
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z]/g, " ")
    .trim()
    .split(/\s+/)[0] ?? "";
}

/**
 * ŠTO SE PRIKAZUJE (Markov odabir 9.9.2026.: „samo za grad, ako ima grad
 * kameru; ako ne, onda šire; i ako nema ime ne pokazuj — pogotovo ne Vir
 * koji je 20 km").
 *
 * Pravilo je najprije po IMENU, pa tek onda po kilometrima:
 *
 * 1. Ako mjesto ima SVOJU kameru (ime kamere se poklapa s imenom mjesta),
 *    prikazuju se SAMO njegove. Zadar s tri gradske kamere ne pokazuje
 *    Vir, bez obzira što je Vir unutar dometa.
 * 2. Ako grad svoju nema, prikazuje se TOČNO JEDNA — najbliža, BEZ granice
 *    udaljenosti (Markov zahtjev 9.9.2026., drugi krug: „ako nema ništa u
 *    tom mjestu želim samo 1 najbližu kameru, obavezno"). Prva verzija je
 *    rezala susjede na 12 km — po Viru na 20 km uz ZADAR, koji ima svoje
 *    kamere pa ga rez nije ni trebao. Za Pridragu i Polaču, koje svoje
 *    nemaju, isti je rez značio: nema sekcije. Kartica uvijek piše
 *    udaljenost, pa korisnik sam vidi koliko je daleko.
 *
 * Izvezeno radi testova.
 */
export function pickWebcams(all: Webcam[], placeName: string): Webcam[] {
  const target = normalizePlace(placeName);
  const own = target ? all.filter((w) => normalizePlace(w.title) === target) : [];
  if (own.length > 0) return own;
  // `all` je sortiran po udaljenosti (parseWebcams) — prva je najbliža.
  return all.slice(0, 1);
}

/** Koliko kamera tražimo — ekran prikazuje najbliže, kartica prvu. */
const LIMIT = 10;

/**
 * Kamere oko zadane točke, najbliža prva.
 *
 * Ključ ide u ZAGLAVLJE (`x-windy-api-key`), ne u URL — inače bi stajao u
 * povijesti zahtjeva i u svakom logu posrednika.
 */
async function fetchInRadius(
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<Webcam[]> {
  const raw = await fetchJson<unknown>(
    `${API_URL}?nearby=${lat.toFixed(4)},${lon.toFixed(4)},${radiusKm}` +
      `&limit=${LIMIT}&include=images,location,urls`,
    { headers: { "x-windy-api-key": KEY ?? "" } },
  );
  // Windy `nearby` zna vratiti i nešto izvan zadanog kruga — režemo sami.
  return parseWebcams(raw, lat, lon).filter((w) => w.distanceKm <= radiusKm);
}

/**
 * Kamere oko zadane točke, najbliža prva.
 *
 * Ključ ide u ZAGLAVLJE (`x-windy-api-key`), ne u URL — inače bi stajao u
 * povijesti zahtjeva i u svakom logu posrednika.
 *
 * Širi krug se traži SAMO kad bliži ne vrati ni jednu kameru: to je drugi
 * mrežni poziv, ali samo za mjesta koja svoju kameru nemaju, i samo jednom
 * po 5 min (keš u `useWebcams`). Alternativa bi bila UVIJEK tražiti 60 km
 * i rezati u kodu — što bi svakom mjestu dohvaćalo kamere koje mu ne
 * trebaju.
 */
export async function fetchNearbyWebcams(
  lat: number,
  lon: number,
  /** Ime odabranog mjesta — po njemu se bira ČIJE se kamere prikazuju. */
  placeName = "",
): Promise<Webcam[]> {
  if (!hasWindyKey()) return [];

  /*
   * DIJAGNOSTIKA U RAZVOJU, SAMO KAD NEMA REZULTATA (9.9.2026.).
   *
   * Povod: „ne pokazuju se kamere na Polači" — a ispalo je da tražilica
   * zna vratiti DRUGO mjesto istog imena (Vrana na Cresu umjesto one uz
   * Vransko jezero; Polača kod Knina umjesto one kod Biograda). Sekcija se
   * skriva i za „nema kamera" i za pali poziv, pa se s ekrana ne vidi ni
   * koje je mjesto pogođeno ni što je pošlo po zlu. Ovaj `warn` u Metro
   * terminalu kaže koordinate, što je parser propustio i zašto je prazno.
   *
   * Namjerno NE loga uspjeh: kamere se traže pri svakoj promjeni mjesta i
   * svakih 5 min, pa bi to bio šum. Isti obrazac kao `[burin] widget nije
   * osvježen:` — glas samo kad nešto ne štima. U produkciji se ne izvršava.
   */
  const tag = `[burin] kamere „${placeName || "?"}" (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
  const describe = (list: Webcam[]) =>
    list.length === 0
      ? "ništa"
      : list.map((w) => `${w.title} ${w.distanceKm.toFixed(1)} km`).join(", ");

  let near: Webcam[];
  try {
    near = await fetchInRadius(lat, lon, WEBCAM_RANGE_KM);
  } catch (err) {
    if (__DEV__) console.warn(`${tag}: poziv PAO — ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
  const picked = pickWebcams(near, placeName);
  if (picked.length > 0) return picked;

  /*
   * Širi krug SAMO kad bliži (25 km) ne vrati NI JEDNU upotrebljivu kameru.
   * `pickWebcams` i tu uzme samo najbližu; tek ako ni u 100 km nema ništa,
   * sekcija se na početnoj ne prikaže — što je u Hrvatskoj gotovo nemoguće.
   */
  let wide: Webcam[];
  try {
    wide = await fetchInRadius(lat, lon, WEBCAM_RANGE_WIDE_KM);
  } catch (err) {
    if (__DEV__) console.warn(`${tag}: širi poziv PAO — ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
  const pickedWide = pickWebcams(wide, placeName);
  if (__DEV__ && pickedWide.length === 0) {
    console.warn(
      `${tag}: prazno — ni vlastite ni ijedne kamere do ${WEBCAM_RANGE_WIDE_KM} km. ` +
        `Nakon parsera, ${WEBCAM_RANGE_KM} km: ${describe(near)}; ${WEBCAM_RANGE_WIDE_KM} km: ${describe(wide)}. ` +
        `Provjeri je li ovo PRAVO mjesto (istoimena mjesta: Vrana, Polača…).`,
    );
  }
  return pickedWide;
}
