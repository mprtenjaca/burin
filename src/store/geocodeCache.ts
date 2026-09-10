import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { geocodeRegion } from "@/api/meteoalarmEurope";

/**
 * TRAJNI KEŠ GEOKODIRANJA REGIJA (10.9.2026.).
 *
 * Meteoalarm izvan Hrvatske ne daje koordinate regija, pa `useWarnings`
 * geokodira do 12 imena PO MJESTU — za grad u Njemačkoj ili Austriji to je
 * bilo do 12 mrežnih poziva pri SVAKOM prvom otvaranju, iako se regije ne
 * miču. Ime regije → koordinate je činjenica koja se ne mijenja, pa se
 * pamti na disku: nakon prvog posjeta zemlji geokodiranja više nema.
 *
 * Pamte se i PROMAŠAJI (`null`): ime koje geokoder ne poznaje neće
 * poznavati ni sutra, a bez toga bi se isti promašaj tražio iznova.
 *
 * Ključ: `DE:goslar` — država je dio ključa jer isto ime u drugoj zemlji
 * MORA dati drugo mjesto (Velebit u Srbiji, vidi `geocodeRegion`).
 *
 * Omeđeno: najviše `MAX_ENTRIES` zapisa; kad se prijeđe, ispadaju
 * najstariji (redoslijed ključeva objekta = redoslijed upisa). Cijeli
 * store je ~20 kB — jedan zapis je desetak brojki i kratko ime.
 *
 * Živi u `store/`, ne u `api/`, da `meteoalarmEurope.ts` ostane čist
 * modul bez AsyncStoragea (njegovi testovi ga uvoze izravno).
 */

const MAX_ENTRIES = 300;

type Hit = { lat: number; lon: number } | null;

type GeocodeCacheState = {
  hits: Record<string, Hit>;
  remember: (key: string, hit: Hit) => void;
};

export const useGeocodeCache = create<GeocodeCacheState>()(
  persist(
    (set) => ({
      hits: {},
      remember: (key, hit) =>
        set((s) => {
          const next: Record<string, Hit> = { ...s.hits, [key]: hit };
          const keys = Object.keys(next);
          if (keys.length > MAX_ENTRIES) {
            for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete next[k];
          }
          return { hits: next };
        }),
    }),
    {
      name: "burin:geocode-regions",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Ključ keša: država + normalizirano ime. Izvezeno radi testa. */
export function geocodeCacheKey(areaDesc: string, countryCode: string): string {
  return `${countryCode.toUpperCase()}:${areaDesc.trim().toLowerCase()}`;
}

/**
 * `geocodeRegion` s trajnim kešom: pogodak (i promašaj) se čita s diska,
 * mreža se pita samo za ime koje još nije viđeno.
 */
export async function geocodeRegionCached(
  areaDesc: string,
  countryCode: string,
): Promise<Hit> {
  const key = geocodeCacheKey(areaDesc, countryCode);
  const known = useGeocodeCache.getState().hits[key];
  if (known !== undefined) return known;
  const hit = await geocodeRegion(areaDesc, countryCode);
  useGeocodeCache.getState().remember(key, hit);
  return hit;
}
