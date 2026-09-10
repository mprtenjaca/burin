import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Place } from "@/api/types";
import { placeId } from "@/api/types";
import { t } from "@/i18n";

export type GpsState =
  | { status: "loading" }
  | { status: "granted"; place: Place }
  | { status: "denied" };

/**
 * Nazivi UPRAVNIH JEDINICA koji NISU ime mjesta — županija, oblast,
 * pokrajina, okrug.
 *
 * Popravak 6.9.2026. (Markov nalaz na uređaju): "Moja lokacija" je umjesto
 * *Zadar* pisala *Zadarska županija*. Uzrok je bio red
 * `first.city ?? first.subregion ?? first.region`: na Androidu `city` zna
 * biti `null` i izvan velikih gradova (Google vrati samo `subregion`), pa
 * je ime palo na županiju. Heroj tada nosi naziv koji nije mjesto i još je
 * najduži tekst na ekranu.
 *
 * Filtriraju se SUFIKSI, ne cijela imena: popis županija bi trebalo držati
 * u koraku sa svijetom, a "…ska županija" / "…county" hvata obrazac.
 * Hrvatski, engleski i njemački jer aplikacija ima ta sučelja i Meteoalarm
 * pokriva Europu.
 */
const ADMIN_SUFFIXES = [
  "županija",
  "zupanija",
  "county",
  "district",
  "province",
  "region",
  "regija",
  "oblast",
  "okrug",
  "landkreis",
  "bezirk",
  "kanton",
];

function isAdminName(value: string): boolean {
  const v = value.trim().toLowerCase();
  return ADMIN_SUFFIXES.some((s) => v === s || v.endsWith(` ${s}`) || v.startsWith(`${s} `));
}

/**
 * Ime MJESTA iz reverse geocode odgovora, ili `undefined` kad ga nema.
 *
 * Redoslijed je od najužeg prema najširem, ali svaki kandidat mora proći
 * `isAdminName` — bolje ostati na "Moja lokacija" nego napisati županiju.
 * `district` je uvučen ispred `subregion` jer na Androidu često nosi ime
 * naselja (Google ga puni kad `city` izostane).
 *
 * Izvezeno radi testova: ovo je čista funkcija nad odgovorom, a
 * `useLocation` se ne može testirati bez nativnog modula.
 */
export function placeNameFrom(
  address: Pick<Location.LocationGeocodedAddress, "city" | "district" | "subregion" | "region" | "name"> | undefined,
): string | undefined {
  const candidates = [address?.city, address?.district, address?.subregion, address?.name, address?.region];
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const trimmed = c.trim();
    if (!trimmed || isAdminName(trimmed)) continue;
    return trimmed;
  }
  return undefined;
}

/**
 * Traži foreground dozvolu (samo balanced točnost — nikad preciznu ni
 * pozadinsku), dohvaća poziciju i reverse-geocodira ime mjesta.
 * Aplikacija mora biti potpuno upotrebljiva i kad je dozvola odbijena.
 */
export function useLocation(
  enabled: boolean,
): GpsState & { request: () => void; permissionGranted: boolean | undefined } {
  const [state, setState] = useState<GpsState>({ status: "loading" });
  /*
   * Je li traženje UOPĆE pokrenuto — čuva efekt niže od udvajanja kad
   * ručni dodir promijeni `enabled` u istom kadru (vidi objašnjenje uz
   * efekt). Ref, ne state: čitanje i upis moraju vrijediti ODMAH, a
   * ponovno crtanje ovdje ne treba.
   */
  const started = useRef(false);

  /*
   * JE LI DOZVOLA VEC DANA - provjera BEZ dijaloga (10.9.2026., Markov
   * nalaz: "opet me pita na trazilici iako sam dopustio lokaciju").
   *
   * Trazilica GPS trazi TEK NA DODIR (odluka: ne dizati sustavni dijalog
   * samo zato sto je netko otvorio trazilicu), pa je red do dodira pisao
   * "Dopusti pristup lokaciji" - i onda kad je dozvola odavno dana.
   * Sustavni dijalog se u tom slucaju NE pojavljuje (request vraca
   * granted tiho), ali tekst reda TRAZI dozvolu, i to korisnik cita kao
   * "opet me pita". Kvar je bio u rijeci, ne u dozvoli.
   *
   * getForegroundPermissionsAsync samo CITA stanje - nema dijaloga, nema
   * GPS-a, nema mreze - pa smije na svako montiranje. Sucelje po tome
   * bira rijec: dana -> "Moja lokacija", nije -> "Dopusti pristup".
   * Dohvat pozicije i dalje ceka dodir; ovo ne mijenja koliko se trazi.
   */
  const [permissionGranted, setPermissionGranted] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (alive) setPermissionGranted(p.granted);
      })
      .catch(() => {
        // nepoznato ostaje undefined -> sucelje se ponasa kao prije
      });
    return () => {
      alive = false;
    };
  }, []);

  const request = useCallback(() => {
    started.current = true;
    let cancelled = false;

    async function run() {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (!perm.granted) {
          setState({ status: "denied" });
          return;
        }
        const pos =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));
        if (cancelled) return;

        const { latitude, longitude } = pos.coords;
        let name = t.drawer.myLocation;
        let countryCode: string | undefined;
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
          const first = geo[0];
          name = placeNameFrom(first) ?? name;
          // Bira Meteoalarm feed i izvan Hrvatske (dorada 6.8.2026.).
          countryCode = first?.isoCountryCode ?? undefined;
        } catch {
          // reverse geocode nije kritičan — ostaje "Moja lokacija"
        }
        if (cancelled) return;

        setState({
          status: "granted",
          place: {
            id: placeId(latitude, longitude),
            name,
            countryCode,
            lat: latitude,
            lon: longitude,
            isGps: true,
          },
        });
      } catch {
        if (!cancelled) setState({ status: "denied" });
      }
    }

    setState({ status: "loading" });
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * AUTOMATSKO traženje pri montiranju — SAMO JEDNOM po prelasku u
   * `enabled` (popravak 7.9.2026., Markov nalaz u tražilici: "stisnem
   * dopusti moju lokaciju, pojavi se grad kao da zašteka").
   *
   * Bila su DVA kvara u ovih par redova, oba iz istog uzorka:
   *
   * 1. `return request()` je koristio funkciju za ODUSTAJANJE kao
   *    čišćenje efekta. U tražilici `enabled` je `selected === null ||
   *    gpsAsked`, pa dodir na "Dopusti moju lokaciju" MIJENJA `enabled` s
   *    false na true → React prvo pokrene ČIŠĆENJE prethodnog efekta,
   *    koje postavi `cancelled = true` upravo onom traženju koje je dodir
   *    tek pokrenuo. Rezultat: prvi pokušaj se tiho odbaci, pa efekt
   *    krene iznova — odatle zastoj od jednog ciklusa i "štucanje".
   *
   * 2. Isti dodir zove `gps.request()` RUČNO, a efekt se zbog promjene
   *    `enabled` pokreće ponovno — dva paralelna dohvata pozicije i dva
   *    reverse geocodea preko mreže za jedan dodir.
   *
   * Popravak: efekt pokreće traženje samo kad `enabled` PRIJEĐE u true i
   * traženje još nije bilo, a čišćenje se NE veže na `request`. Ručni
   * `request()` iz sučelja i dalje radi uvijek (npr. ponovni pokušaj
   * nakon odbijanja) i sam upisuje `started`, pa ga efekt ne udvaja.
   */
  useEffect(() => {
    if (!enabled || started.current) return;
    request();
  }, [enabled, request]);

  return { ...state, request, permissionGranted };
}
