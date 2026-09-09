import { useQuery } from "@tanstack/react-query";

import { fetchLibreFrames } from "@/api/librewxr";
import { fetchRadarFrames } from "@/api/rainviewer";

const MIN = 60 * 1000;

/** Okviri radara — keširano 5 min da se endpoint ne opterećuje. */
export function useRadarFrames() {
  return useQuery({
    queryKey: ["rainviewer-frames"],
    queryFn: fetchRadarFrames,
    staleTime: 5 * MIN,
    refetchInterval: 5 * MIN,
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
