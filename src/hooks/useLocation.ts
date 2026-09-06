import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

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
export function useLocation(enabled: boolean): GpsState & { request: () => void } {
  const [state, setState] = useState<GpsState>({ status: "loading" });

  const request = useCallback(() => {
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

  useEffect(() => {
    if (!enabled) return;
    return request();
  }, [enabled, request]);

  return { ...state, request };
}
