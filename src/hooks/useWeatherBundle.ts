import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { fetchDhmzObservations, findNearestStation } from "@/api/dhmz";
import {
  fetchAirQuality,
  fetchCurrent,
  fetchForecast,
  fetchSeaTemperature,
} from "@/api/openMeteo";
import type { Place, WeatherBundle } from "@/api/types";
import {
  buildBundle,
  correctHourly,
  correctWithObservation,
  observationDelta,
} from "@/api/weather";
import { useLastWeather } from "@/store/lastWeather";

const MIN = 60 * 1000;

/** DHMZ mjerenja vrijede samo ako je najbliža postaja unutar 50 km. */
const DHMZ_MAX_DISTANCE_KM = 50;

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

  // Temperatura mora — undefined za kopnena mjesta, tada se ne prikazuje.
  const seaTemp = useQuery({
    queryKey: ["om-sea", place?.id],
    queryFn: () => fetchSeaTemperature(place!.lat, place!.lon),
    enabled: !!place,
    staleTime: 60 * MIN,
    retry: 0,
  });

  // Globalni DHMZ feed (sve postaje); greška vraća null — tihi fallback.
  const dhmz = useQuery({
    queryKey: ["dhmz"],
    queryFn: fetchDhmzObservations,
    enabled: !!place,
    staleTime: 10 * MIN,
    retry: 1,
  });

  const save = useLastWeather((s) => s.save);
  const cached: WeatherBundle | undefined = useLastWeather((s) =>
    place ? s.byPlaceId[place.id] : undefined,
  );

  const fresh = useMemo(() => {
    if (!place || !current.data || !forecast.data) return undefined;
    const nearest = dhmz.data
      ? findNearestStation(place.lat, place.lon, dhmz.data)
      : null;
    const dhmzObs =
      nearest && nearest.distanceKm <= DHMZ_MAX_DISTANCE_KM ? nearest : undefined;
    // Ista greška modela ispravlja se i na heroju i na satnoj krivulji,
    // inače hero i prvi sat u traci pokazuju različit broj.
    const delta = observationDelta(current.data, dhmzObs);
    return buildBundle({
      place,
      current: correctWithObservation(current.data, dhmzObs),
      hourly: correctHourly(forecast.data.hourly, delta),
      hourlyAll: correctHourly(forecast.data.hourlyAll, delta),
      daily: forecast.data.daily,
      dhmz: dhmzObs,
      aqi: aqi.data,
      seaTemp: seaTemp.data,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id, current.data, forecast.data, aqi.data, dhmz.data, seaTemp.data]);

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
      void seaTemp.refetch();
    },
  };
}
