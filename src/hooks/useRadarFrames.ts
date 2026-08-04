import { useQuery } from "@tanstack/react-query";

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
