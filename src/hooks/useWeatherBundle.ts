import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { fetchAirQuality, fetchCurrent, fetchForecast } from "@/api/openMeteo";
import type { Place, WeatherBundle } from "@/api/types";
import { buildBundle } from "@/api/weather";
import { useLastWeather } from "@/store/lastWeather";

const MIN = 60 * 1000;

/**
 * Sastavlja WeatherBundle iz odvojenih upita (svaki sa svojim staleTime):
 * trenutno vrijeme 10 min, prognoza 30 min, kvaliteta zraka 30 min.
 * Kod greške vraća zadnje spremljene podatke (isStale = true).
 */
export function useWeatherBundle(place: Place | null) {
  const current = useQuery({
    queryKey: ["om-current", place?.id],
    queryFn: () => fetchCurrent(place!.lat, place!.lon),
    enabled: !!place,
    staleTime: 10 * MIN,
  });

  const forecast = useQuery({
    queryKey: ["om-forecast", place?.id],
    queryFn: () => fetchForecast(place!.lat, place!.lon),
    enabled: !!place,
    staleTime: 30 * MIN,
  });

  const aqi = useQuery({
    queryKey: ["om-aqi", place?.id],
    queryFn: () => fetchAirQuality(place!.lat, place!.lon),
    enabled: !!place,
    staleTime: 30 * MIN,
    retry: 1,
  });

  const save = useLastWeather((s) => s.save);
  const cached: WeatherBundle | undefined = useLastWeather((s) =>
    place ? s.byPlaceId[place.id] : undefined,
  );

  const fresh = useMemo(() => {
    if (!place || !current.data || !forecast.data) return undefined;
    return buildBundle({
      place,
      current: current.data,
      hourly: forecast.data.hourly,
      daily: forecast.data.daily,
      aqi: aqi.data,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id, current.data, forecast.data, aqi.data]);

  useEffect(() => {
    if (fresh) save(fresh);
  }, [fresh, save]);

  const bundle = fresh ?? cached;
  const hasError = current.isError || forecast.isError;

  return {
    bundle,
    /** Prvo učitavanje bez ikakvih podataka (ni cache-a). */
    isLoading: !bundle && !hasError && (current.isPending || forecast.isPending),
    /** Greška bez ičega za prikaz. */
    isError: hasError && !bundle,
    /** Prikazujemo starije podatke jer svježi dohvat nije uspio. */
    isStale: !fresh && !!cached && hasError,
    isRefreshing: current.isRefetching || forecast.isRefetching,
    refetch: () => {
      void current.refetch();
      void forecast.refetch();
      void aqi.refetch();
    },
  };
}
