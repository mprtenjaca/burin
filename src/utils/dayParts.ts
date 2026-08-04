import type { HourlyPoint } from "@/api/types";
import { t } from "@/i18n";
import { parseLocal } from "./format";

export type DayPartId = "morning" | "afternoon" | "evening" | "night";

export type DayPart = {
  id: DayPartId;
  label: string;
  hours: HourlyPoint[];
  temp: number; // najviša u razdoblju (za noć: najniža)
  code: number; // najizraženije stanje razdoblja
  isDay: boolean;
  precipProb: number;
  precipSum: number;
  windSpeed: number;
  windGusts: number;
  windDir: number;
  pressure: number;
  humidity: number;
  feelsLike: number;
  uv: number;
};

/** Rasponi sati po razdoblju dana (kao u Vrijeme&Radar). */
const RANGES: { id: DayPartId; from: number; to: number }[] = [
  { id: "morning", from: 6, to: 11 },
  { id: "afternoon", from: 12, to: 17 },
  { id: "evening", from: 18, to: 23 },
  { id: "night", from: 0, to: 5 },
];

function labelFor(id: DayPartId): string {
  switch (id) {
    case "morning":
      return t.home.morning;
    case "afternoon":
      return t.home.afternoon;
    case "evening":
      return t.home.evening;
    case "night":
      return t.home.night;
  }
}

/** Najčešći, a pri izjednačenju najteži (viši kod) vremenski kod. */
function dominantCode(hours: HourlyPoint[]): number {
  const counts = new Map<number, number>();
  for (const h of hours) counts.set(h.code, (counts.get(h.code) ?? 0) + 1);
  let bestCode = hours[0]?.code ?? 0;
  let bestCount = -1;
  for (const [code, count] of counts) {
    if (count > bestCount || (count === bestCount && code > bestCode)) {
      bestCode = code;
      bestCount = count;
    }
  }
  return bestCode;
}

function avg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/**
 * Dijeli satnu prognozu jednog datuma na Prijepodne / Poslijepodne /
 * Navečer / Noću. Razdoblja bez podataka (npr. danas su prošli) se
 * izostavljaju. Noć prikazuje minimum, ostala razdoblja maksimum.
 */
export function buildDayParts(hourly: HourlyPoint[], date: string): DayPart[] {
  const ofDay = hourly.filter((h) => h.time.startsWith(date));
  const parts: DayPart[] = [];

  for (const range of RANGES) {
    const hours = ofDay.filter((h) => {
      const hour = parseLocal(h.time).getHours();
      return hour >= range.from && hour <= range.to;
    });
    if (hours.length === 0) continue;

    const temps = hours.map((h) => h.temp);
    parts.push({
      id: range.id,
      label: labelFor(range.id),
      hours,
      temp: range.id === "night" ? Math.min(...temps) : Math.max(...temps),
      code: dominantCode(hours),
      isDay: hours.some((h) => h.isDay),
      precipProb: Math.max(...hours.map((h) => h.precipProb)),
      precipSum: Math.round(hours.reduce((s, h) => s + h.precip, 0) * 10) / 10,
      windSpeed: Math.round(avg(hours.map((h) => h.windSpeed))),
      windGusts: Math.max(...hours.map((h) => h.windGusts)),
      windDir: hours[0]!.windDir,
      pressure: Math.round(avg(hours.map((h) => h.pressure))),
      humidity: Math.round(avg(hours.map((h) => h.humidity))),
      feelsLike:
        range.id === "night"
          ? Math.min(...hours.map((h) => h.feelsLike))
          : Math.max(...hours.map((h) => h.feelsLike)),
      uv: Math.max(...hours.map((h) => h.uv)),
    });
  }

  return parts;
}
