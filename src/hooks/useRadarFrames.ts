import { useQuery } from "@tanstack/react-query";

import { fetchLibreFrames } from "@/api/librewxr";
import { fetchRadarFrames } from "@/api/rainviewer";

const MIN = 60 * 1000;

/**
 * Okviri RainViewer radara — keširano 5 min da se endpoint ne opterećuje.
 *
 * Od 10.9.2026. ovo je i ULAZ SUDCA za oborinu (`useRadarEcho`).
 *
 * TEMPO, 11.9.2026. — Markov zahtjev za zimu: „zimsko vrijeme je jako
 * promjenjivo i želim imati sve na oku, svaku promjenu; nije me briga
 * koliko često ćeš ažurirati i osvježavati".
 *
 * RainViewer objavljuje novi okvir svakih 10 min, ali ne u pravilnom
 * ritmu i ne u istoj sekundi za sve. S provjerom svakih 5 min heroj je
 * kasnio do ~6–7 min iza stvarnog vremena; s 90 s kasni najviše ~2 min,
 * a to je razlika između „prestalo je" i „app još piše kišu".
 *
 * Cijena je mala i izmjerena: lista okvira je JEDAN JSON od ~3 kB, bez
 * pločica. 40 poziva/h × 3 kB ≈ 120 kB/h dok je app OTVORENA (upit stoji
 * uz ekran, u pozadini react-query ne vrti interval). Pločice se i dalje
 * dohvaćaju samo kad se okvir STVARNO promijeni — ključ odjeka nosi
 * vrijeme okvira, pa isti okvir ne pokreće novi dohvat.
 */
export function useRadarFrames(enabled = true) {
  return useQuery({
    queryKey: ["rainviewer-frames"],
    queryFn: fetchRadarFrames,
    enabled,
    staleTime: 90 * 1000,
    refetchInterval: 90 * 1000,
    // Zima: promjena se traži i kad se korisnik vrati u app, bez čekanja
    // na sljedeći interval.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/**
 * Okviri LibreWXR radara — test-sloj s budućnošću (`Radar+`).
 *
 * `enabled` jer se traži SAMO kad je taj sloj odabran: RainViewer je jedan
 * upit po pokretanju karte, a ovo bi bio drugi bez ikakve koristi dok se
 * sloj ne uključi.
 *
 * Tempo je namjerno mirniji od RainViewera (10 min umjesto 5, bez refetcha
 * na fokus): javna instanca je besplatna i ne objavljuje rate-limit, a
 * okviri ionako stižu svakih 10 min — češći upit vraća isti odgovor. Isto
 * načelo kao kod Štampara ("ne pollati agresivno").
 */
export function useLibreFrames(enabled: boolean) {
  return useQuery({
    queryKey: ["librewxr-frames"],
    queryFn: fetchLibreFrames,
    enabled,
    staleTime: 10 * MIN,
    refetchInterval: 10 * MIN,
    refetchOnWindowFocus: false,
    // Instanca bez SLA: jedan ponovni pokušaj, pa sloj ostane prazan.
    retry: 1,
  });
}
