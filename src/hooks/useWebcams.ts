import { useQuery } from "@tanstack/react-query";

import { fetchNearbyWebcams, hasWindyKey } from "@/api/windyWebcams";

const MIN = 60 * 1000;

/**
 * Web kamere oko zadane točke.
 *
 * **`staleTime` je 5 min, a ne duže, i to je OBAVEZNO:** URL-ovi slika koje
 * Windy vrati nose token koji na besplatnoj razini istječe za 10 minuta,
 * nakon čega ta adresa vraća HTTP 401 i slika bi se srušila u prazan okvir.
 * Pet minuta ostavlja pola tokena kao zalihu. Njihova dokumentacija zato i
 * preporučuje ponovni upit pri svakom otvaranju ekrana.
 *
 * Zbog istog tokena ovo je JEDINI dio aplikacije koji bez mreže ne može
 * pokazati staru vrijednost (`lastWeather` posvuda drugdje preživi) — pa
 * kartica mora reći da nema mreže, a ne stajati prazna.
 *
 * `enabled` pada na false bez ključa I bez koordinata: bez ključa sekcija
 * se ne prikazuje, pa nema smisla ni pokretati upit.
 */
export function useWebcams(lat?: number, lon?: number, placeName?: string) {
  const ready = hasWindyKey() && lat !== undefined && lon !== undefined;

  return useQuery({
    // Zaokruženo na 2 decimale (~1 km): inače bi svaki GPS šum bio nov ključ
    // i trošio upit na isto mjesto. Ime mjesta je U KLJUČU jer određuje
    // ČIJE se kamere prikazuju (vidi `pickWebcams`).
    queryKey: ["windy-webcams", lat?.toFixed(2), lon?.toFixed(2), placeName ?? ""],
    queryFn: () => fetchNearbyWebcams(lat!, lon!, placeName),
    enabled: ready,
    staleTime: 5 * MIN,
    gcTime: 10 * MIN,
    // Besplatna razina bez objavljene kvote — jedan pokušaj, pa mir.
    retry: 1,
  });
}
