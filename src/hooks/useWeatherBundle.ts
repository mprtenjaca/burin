import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import {
  fetchDhmzObservations,
  findNearbyStations,
  findNearestStation,
} from "@/api/dhmz";
import {
  fetchAirQuality,
  fetchCurrent,
  fetchForecast,
  fetchSeaTemperature,
} from "@/api/openMeteo";
import type { Place, WeatherBundle } from "@/api/types";
import { NO_BIAS, learnModelBias } from "@/api/bias";
import {
  buildBundle,
  correctHourly,
  debiasDaily,
  debiasHourly,
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

  // Naučena pristranost modela za ovo mjesto. Mijenja se sporo (klima
  // lokacije), pa se drži cijeli dan.
  const bias = useQuery({
    queryKey: ["model-bias", place?.id],
    queryFn: () => learnModelBias(place!.lat, place!.lon),
    enabled: !!place,
    staleTime: 12 * 60 * MIN,
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
    // Korekcija se računa iz nekoliko okolnih postaja (točnije od jedne),
    // a ista greška se primjenjuje na hero i na satnu krivulju — inače
    // hero i prvi sat u traci pokazuju različit broj.
    const nearby = dhmz.data
      ? findNearbyStations(place.lat, place.lon, dhmz.data)
      : [];

    // Redoslijed je važan: prvo se iz prognoze ukloni naučena pristranost
    // modela (rješava sutrašnja jutra), pa se tek onda ostatak razlike
    // pripiše mjerenju (rješava "sada") — inače bi se ista greška
    // ispravila dva puta.
    const modelBias = bias.data ?? NO_BIAS;
    const debiasedHourly = debiasHourly(forecast.data.hourly, modelBias);
    const debiasedAll = debiasHourly(forecast.data.hourlyAll, modelBias);
    const debiasedCurrent = {
      ...current.data,
      temp: current.data.temp - (current.data.isDay ? modelBias.day : modelBias.night),
      feelsLike:
        current.data.feelsLike -
        (current.data.isDay ? modelBias.day : modelBias.night),
    };
    const delta = observationDelta(debiasedCurrent, nearby);

    return buildBundle({
      place,
      // Isti `delta` kao za satnu krivulju — hero i prva ura moraju se
      // poklapati, pa se korekcija računa iz istog prosjeka postaja.
      current: {
        ...debiasedCurrent,
        temp: debiasedCurrent.temp + delta,
        feelsLike: debiasedCurrent.feelsLike + delta,
      },
      hourly: correctHourly(debiasedHourly, delta),
      hourlyAll: correctHourly(debiasedAll, delta),
      daily: debiasDaily(forecast.data.daily, modelBias),
      dhmz: dhmzObs,
      aqi: aqi.data,
      seaTemp: seaTemp.data,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    place?.id,
    current.data,
    forecast.data,
    aqi.data,
    dhmz.data,
    seaTemp.data,
    bias.data,
  ]);

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
