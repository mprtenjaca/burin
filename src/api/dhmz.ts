import { XMLParser } from "fast-xml-parser";

import { haversineKm } from "@/utils/geo";

import { fetchText } from "./client";
import type { DhmzObservation } from "./types";

const FEED_URL = "https://vrijeme.hr/hrvatska_n.xml";

export type DhmzStation = {
  name: string;
  lat: number;
  lon: number;
  temp?: number;
  humidity?: number;
  pressure?: number;
  pressureTrend?: number;
  windDir?: string;
  windSpeed?: number;
  conditionText?: string;
};

export type DhmzReport = { stations: DhmzStation[]; measuredAt: string };

/** DHMZ koristi "-" za nedostupno; fxp brojeve već parsira u number. */
function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    if (v.trim() !== "" && v.trim() !== "-" && Number.isFinite(n)) return n;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" || s === "-" ? undefined : s;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Parsira hrvatska_n.xml. Nikad ne baca iznimku — neispravan feed
 * vraća null i UI tiho prelazi na Open-Meteo.
 */
export function parseDhmzXml(xml: string): DhmzReport | null {
  try {
    const parser = new XMLParser({ ignoreAttributes: true });
    const doc: unknown = parser.parse(xml);
    const root = (doc as { Hrvatska?: Record<string, unknown> })?.Hrvatska;
    if (!root || typeof root !== "object") return null;

    const dt = root.DatumTermin as { Datum?: unknown; Termin?: unknown } | undefined;
    const datum = str(dt?.Datum);
    const termin = num(dt?.Termin);
    const measuredAt =
      datum && termin !== undefined ? `${datum}. ${pad2(termin)}:00` : "";

    const gradRaw = root.Grad;
    const grads = Array.isArray(gradRaw) ? gradRaw : gradRaw ? [gradRaw] : [];

    const stations: DhmzStation[] = [];
    for (const g of grads as Array<Record<string, unknown>>) {
      const name = str(g.GradIme);
      const lat = num(g.Lat);
      const lon = num(g.Lon);
      if (!name || lat === undefined || lon === undefined) continue;
      const p = (g.Podatci ?? {}) as Record<string, unknown>;
      stations.push({
        name,
        lat,
        lon,
        temp: num(p.Temp),
        humidity: num(p.Vlaga),
        pressure: num(p.Tlak),
        pressureTrend: num(p.TlakTend),
        windDir: str(p.VjetarSmjer),
        windSpeed: num(p.VjetarBrzina),
        conditionText: str(p.Vrijeme),
      });
    }

    if (stations.length === 0) return null;
    return { stations, measuredAt };
  } catch {
    return null;
  }
}

/** Dohvat + parsiranje; svaka greška vraća null (tihi fallback). */
export async function fetchDhmzObservations(): Promise<DhmzReport | null> {
  try {
    const xml = await fetchText(FEED_URL);
    return parseDhmzXml(xml);
  } catch {
    return null;
  }
}

const AIRPORT_RE = /aerodrom|zra[čc]na luka/i;

/**
 * Mala kazna aerodromskim postajama pri odabiru. Aerodromi su u ravnici
 * izvan grada i noću mjere niže od naselja (Split 4.8.2026.: grad 29.6 °C
 * vs aerodrom 28.0 °C), pa kad je gradska postaja podjednako blizu želimo
 * nju. Kazna je namjerno malena — leave-one-out test je pokazao da veće
 * vrijednosti ne poboljšavaju točnost, a DHMZ u međuterminima objavi
 * skraćeni set postaja pa je aerodrom često jedina u blizini.
 */
const AIRPORT_PENALTY_KM = 3;

/**
 * Najbliža postaja danoj točki, s udaljenošću u km. Aerodromske postaje
 * su blago kažnjene jer nisu reprezentativne za naselje.
 */
export function findNearestStation(
  lat: number,
  lon: number,
  report: DhmzReport,
): DhmzObservation | null {
  let best: DhmzStation | null = null;
  let bestScore = Infinity;
  let bestDist = Infinity;
  for (const station of report.stations) {
    const d = haversineKm({ lat, lon }, { lat: station.lat, lon: station.lon });
    // Aerodromske postaje su u ravnici izvan grada i noću se hlade više od
    // naselja, pa im dajemo kaznu da gradska postaja pobijedi kad postoji.
    const score = d + (AIRPORT_RE.test(station.name) ? AIRPORT_PENALTY_KM : 0);
    if (score < bestScore) {
      bestScore = score;
      bestDist = d;
      best = station;
    }
  }
  if (!best) return null;
  return {
    stationName: best.name,
    lat: best.lat,
    lon: best.lon,
    distanceKm: Math.round(bestDist * 10) / 10,
    temp: best.temp,
    humidity: best.humidity,
    pressure: best.pressure,
    pressureTrend: best.pressureTrend,
    windDir: best.windDir,
    windSpeed: best.windSpeed,
    conditionText: best.conditionText,
    measuredAt: report.measuredAt,
  };
}
