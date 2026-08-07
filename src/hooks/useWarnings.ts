import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { MeteoWarning } from "@/api/meteoalarm";
import { fetchMeteoalarmWarnings, warningsForPlace } from "@/api/meteoalarm";
import {
  feedNameForCountry,
  geocodeRegion,
} from "@/api/meteoalarmEurope";
import type { Place } from "@/api/types";
import { useLanguage } from "@/i18n/useLanguage";
import { regionsForPlace } from "@/utils/emmaRegions";
import { haversineKm } from "@/utils/geo";

const MIN = 60 * 1000;

/**
 * Koliko daleko središte regije smije biti od mjesta da upozorenje
 * vrijedi. Regije su vrlo različite veličine (njemački okrug ~30 km,
 * talijanska pokrajina ~150 km), pa je granica velikodušna — bolje
 * pokazati susjednu regiju nego propustiti pravu.
 */
const REGION_RANGE_KM = 90;

/** Najviše regija koje geokodiramo po dohvatu — čuva kvotu geokodera. */
const MAX_GEOCODED = 12;

/**
 * Upozorenja za mjesto (heroj + ekran Upozorenja).
 *
 * DVA PUTA (6.8.2026.):
 *  - HRVATSKA ide preko ručne tablice EMMA regija (`warningsForPlace`) —
 *    provjerena je i točna.
 *  - Ostatak Europe (38 zemalja s feedom) preko GEOKODIRANJA imena
 *    regije: Meteoalarm ne objavljuje granice ni koordinate, a regije su
 *    po zemlji posve različite (Italija 19, Njemačka 409), pa ručna
 *    tablica nije izvediva.
 *
 * Siguran na neuspjeh: bez feeda ili bez pogotka vraća prazan niz.
 */
export function useWarnings(place: Place | null): MeteoWarning[] {
  const country = place?.countryCode;
  /*
   * Stariji spremljeni gradovi nemaju `countryCode` (uveden 6.8.2026.).
   * Za njih državu izvodi hrvatska tablica regija: ako mjesto pada u
   * neku od 14 EMMA regija, tretira se kao Hrvatska — bez toga bi
   * postojeći korisnici IZGUBILI upozorenja koja danas rade.
   */
  const inCroatiaTable = place
    ? regionsForPlace(place.lat, place.lon).length > 0
    : false;
  const isCroatia = country ? country.toUpperCase() === "HR" : inCroatiaTable;
  const feed = isCroatia ? "croatia" : feedNameForCountry(country);

  /*
   * Jezik je DIO KLJUČA (6.8.2026.): tekst upozorenja dolazi iz feeda na
   * odabranom jeziku, pa keširani hrvatski odgovor ne vrijedi za
   * engleski. Bez jezika u ključu bi prebacivanje jezika ostavilo staro
   * upozorenje na starom jeziku dok keš ne istekne.
   */
  const lang = useLanguage();

  const query = useQuery({
    queryKey: ["meteoalarm", feed ?? "none", lang],
    queryFn: () => fetchMeteoalarmWarnings(feed, lang),
    enabled: !!feed,
    staleTime: 15 * MIN,
    retry: 1,
  });

  /*
   * Izvan Hrvatske: geokodiraj imena regija i zadrži ona blizu mjesta.
   * Ovisi o dohvaćenim upozorenjima, pa je zaseban upit s vlastitim
   * ključem — rezultat se keširaju kao i svaki drugi.
   */
  const nearby = useQuery({
    queryKey: ["meteoalarm-nearby", feed, place?.id],
    enabled: !!feed && !isCroatia && !!place && (query.data?.length ?? 0) > 0,
    staleTime: 60 * MIN,
    retry: 0,
    queryFn: async (): Promise<MeteoWarning[]> => {
      const all = query.data ?? [];
      const here = { lat: place!.lat, lon: place!.lon };

      // Jedno ime = jedna regija; ne geokodiraj isto više puta.
      const byArea = new Map<string, MeteoWarning[]>();
      for (const w of all) {
        const key = w.areaDesc ?? w.region;
        const list = byArea.get(key);
        if (list) list.push(w);
        else byArea.set(key, [w]);
      }

      const names = [...byArea.keys()].slice(0, MAX_GEOCODED);
      const hits = await Promise.all(
        names.map((n) => geocodeRegion(n, country!)),
      );

      const out: MeteoWarning[] = [];
      names.forEach((name, i) => {
        const hit = hits[i];
        if (!hit) return;
        if (haversineKm(here, hit) > REGION_RANGE_KM) return;
        out.push(...(byArea.get(name) ?? []));
      });
      return out.sort((a, b) => b.level - a.level || a.onset - b.onset);
    },
  });

  return useMemo(() => {
    if (!place || !query.data) return [];
    if (isCroatia) return warningsForPlace(query.data, place.lat, place.lon);
    return nearby.data ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, nearby.data, place?.id, isCroatia]);
}
