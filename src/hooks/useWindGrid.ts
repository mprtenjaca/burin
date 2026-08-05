import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { type Bounds, fetchWindGrid } from "@/api/windGrid";

/**
 * Mreža vjetra za trenutni kadar karte.
 *
 * Granice se zaokružuju na 0.25° da svako malo pomicanje karte ne pravi
 * novi upit — mreža je ionako gruba, pa pomak od par kilometara ne mijenja
 * sliku. Bez toga bi svaki `onRegionDidChange` išao na mrežu.
 */
function quantize(bounds: Bounds): Bounds {
  // 0.5°, ne 0.25°: svaki upit nosi 154 točke i najbrže troši SATNU kvotu
  // Open-Metea (429 "try again in the next hour"). Grublje zaokruživanje
  // znači da niz manjih pomaka karte dijeli isti keširani rezultat.
  const q = (v: number) => Math.round(v * 2) / 2;
  return {
    west: q(bounds.west),
    south: q(bounds.south),
    east: q(bounds.east),
    north: q(bounds.north),
  };
}

export function useWindGrid(bounds: Bounds | null, enabled: boolean) {
  const b = bounds ? quantize(bounds) : null;

  return useQuery({
    queryKey: ["wind-grid", b?.west, b?.south, b?.east, b?.north],
    enabled: enabled && b !== null,
    // Vjetar se po satu mijenja malo, a upit je najskuplji (154 točke).
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(30_000, 3_000 * 2 ** attempt),
    // Bez ovoga crtice nestanu sa svakim pomakom karte dok novi kadar
    // ne stigne — sloj treperi. Stara mreža ostaje dok nova ne dođe.
    placeholderData: keepPreviousData,
    queryFn: () => fetchWindGrid(b!),
  });
}
