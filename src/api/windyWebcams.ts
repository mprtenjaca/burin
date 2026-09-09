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
  location?: { latitude?: number; longitude?: number; city?: string };
  images?: {
    current?: { preview?: string; thumbnail?: string; icon?: string };
    sizes?: { preview?: { url?: string }; full?: { url?: string } };
    daylight?: { preview?: string };
  };
  urls?: { detail?: string; edit?: string };
  lastUpdatedOn?: string;
};
type RawResponse = { total?: number; webcams?: RawWebcam[] };

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

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
     * Slika se traži na VIŠE mjesta: v3 je vraća pod `images.current`, a
     * neke kamere je nose pod `images.sizes`. Prvo što postoji pobjeđuje —
     * tako parser preživi obje varijante bez grananja po verziji.
     */
    const preview =
      w?.images?.current?.preview ??
      w?.images?.sizes?.preview?.url ??
      w?.images?.daylight?.preview;
    const full = w?.images?.sizes?.full?.url ?? preview;

    const taken = w?.lastUpdatedOn ? Date.parse(w.lastUpdatedOn) : NaN;

    out.push({
      id,
      // Ime mjesta je korisnije od naslova kamere ("Cam 3"), kad postoji.
      title: (w?.location?.city ?? w?.title ?? "").trim() || `#${id}`,
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

  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Domet u kojem se kamera smatra „u blizini".
 *
 * 25 km, ne 40 kao kod Štampara: tamo je širi domet bio opravdan jer je
 * jedan peludomjer PO ŽUPANIJI, pa je Polača (24.8 km od Zadra) inače
 * ispadala. Kamere su guste — 25 km drži da slika prikazuje mjesto koje
 * korisnik prepoznaje, a ne susjednu dolinu s drugim vremenom.
 */
export const WEBCAM_RANGE_KM = 25;

/** Koliko kamera tražimo — ekran prikazuje najbliže, kartica prvu. */
const LIMIT = 10;

/**
 * Kamere oko zadane točke, najbliža prva.
 *
 * Ključ ide u ZAGLAVLJE (`x-windy-api-key`), ne u URL — inače bi stajao u
 * povijesti zahtjeva i u svakom logu posrednika.
 */
export async function fetchNearbyWebcams(
  lat: number,
  lon: number,
): Promise<Webcam[]> {
  if (!hasWindyKey()) return [];

  const raw = await fetchJson<unknown>(
    `${API_URL}?nearby=${lat.toFixed(4)},${lon.toFixed(4)},${WEBCAM_RANGE_KM}` +
      `&limit=${LIMIT}&include=images,location,urls`,
    { headers: { "x-windy-api-key": KEY ?? "" } },
  );

  return parseWebcams(raw, lat, lon).filter(
    (w) => w.distanceKm <= WEBCAM_RANGE_KM,
  );
}
