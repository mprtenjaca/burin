import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/api/client";

/** Jedan korak vremenske crte na slojevima koji nisu radar. */
export type TimelineHour = {
  /** Lokalni ISO, npr. "2026-08-05T14:00". */
  time: string;
  temp?: number;
  cloudCover?: number;
  windSpeed?: number;
  /** Je li ovo tekući sat (oznaka "Sada"). */
  isNow: boolean;
};

type OmHourly = {
  hourly?: {
    time: string[];
    temperature_2m?: (number | null)[];
    cloud_cover?: (number | null)[];
    wind_speed_10m?: (number | null)[];
  };
};

const PAST_DAYS = 1;
const FORECAST_DAYS = 3;

function currentHourIso(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:00`;
}

/** Izvezeno radi testova. */
export function buildTimelineHours(raw: OmHourly, now: Date = new Date()): TimelineHour[] {
  const times = raw.hourly?.time ?? [];
  const nowIso = currentHourIso(now);
  const num = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;

  return times.map((time, i) => ({
    time,
    temp: num(raw.hourly?.temperature_2m?.[i]),
    cloudCover: num(raw.hourly?.cloud_cover?.[i]),
    windSpeed: num(raw.hourly?.wind_speed_10m?.[i]),
    isNow: time === nowIso,
  }));
}

/** Indeks tekućeg sata; -1 ako ga nema u nizu. */
export function nowIndex(hours: TimelineHour[]): number {
  return hours.findIndex((h) => h.isNow);
}

/**
 * Sati za vremensku crtu na slojevima Temperatura / Naoblaka / Vjetar.
 *
 * OWM besplatne pločice nose samo trenutno stanje, pa klizanje po satima ne
 * može promijeniti sliku. Umjesto mrtve kontrole, crta prikazuje **stvarnu
 * vrijednost za centar karte** po satu (npr. "14:00 — 31°"). Zato ide zaseban
 * lagan upit, a ne `useWeatherBundle`: karti ne trebaju ni korekcije
 * mjerenjem ni DHMZ, samo sirova krivulja za tu točku.
 *
 * Koordinate se zaokružuju na 2 decimale da pomicanje karte za par metara ne
 * pravi novi upit.
 */
export function useTimelineHours(lat?: number, lon?: number, enabled = true) {
  const rLat = lat === undefined ? undefined : Math.round(lat * 100) / 100;
  const rLon = lon === undefined ? undefined : Math.round(lon * 100) / 100;

  return useQuery({
    queryKey: ["map-timeline-hours", rLat, rLon],
    enabled: enabled && rLat !== undefined && rLon !== undefined,
    staleTime: 30 * 60 * 1000,
    /*
     * Open-Meteo ima SATNU kvotu i pri prekoračenju vraća HTTP 429
     * ("try again in the next hour"). Bez razmaka među pokušajima se kvota
     * samo dodatno troši, pa je odmak eksponencijalan i dug.
     */
    retry: 2,
    retryDelay: (attempt) => Math.min(30_000, 3_000 * 2 ** attempt),
    /*
     * KLJUČNO za vremensku crtu: bez ovoga svaki pomak karte mijenja
     * `queryKey`, `data` na tren postane `undefined`, pa crta ostane bez
     * koraka — klizač i play problijede i ne daju se koristiti dok novi
     * upit ne stigne. Sa `keepPreviousData` crta zadrži stare sate dok se
     * novi dohvaćaju i kontrola nikad ne "umre".
     */
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await fetchJson<OmHourly>(
        `https://api.open-meteo.com/v1/forecast?latitude=${rLat}&longitude=${rLon}` +
          `&hourly=temperature_2m,cloud_cover,wind_speed_10m` +
          `&past_days=${PAST_DAYS}&forecast_days=${FORECAST_DAYS}&timezone=auto`,
      );
      return buildTimelineHours(raw);
    },
  });
}
