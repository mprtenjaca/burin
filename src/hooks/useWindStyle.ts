import { useQuery } from "@tanstack/react-query";

import { fetchWindStyle } from "@/api/windStyle";

/**
 * Plava podloga za sloj vjetra. Dohvaća se jednom po sesiji (stil je
 * statičan), pa `staleTime: Infinity` — prebacivanje čipa ne smije
 * povlačiti 100 kB stila iznova.
 *
 * Ako dohvat padne, ekran karte se vraća na obični svijetli stil — vjetar
 * je i dalje vidljiv, samo s manjim kontrastom.
 */
export function useWindStyle(enabled: boolean) {
  return useQuery({
    queryKey: ["wind-map-style"],
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: fetchWindStyle,
  });
}
