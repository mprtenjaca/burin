import { t } from "@/i18n";

export type TempUnit = "C" | "F";
export type WindUnit = "kmh" | "ms";

const DAY_NAMES = [
  "nedjelja",
  "ponedjeljak",
  "utorak",
  "srijeda",
  "četvrtak",
  "petak",
  "subota",
] as const;

/**
 * Open-Meteo vraća lokalne ISO stringove bez zone ("2026-08-04T16:00").
 * Parsiramo ih ručno da izbjegnemo UTC interpretaciju date-only stringova.
 */
export function parseLocal(iso: string): Date {
  const [datePart, timePart] = iso.split("T");
  const [y = 1970, m = 1, d = 1] = (datePart ?? "").split("-").map(Number);
  const [hh = 0, mm = 0] = (timePart ?? "").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "utorak, 4.8." */
export function formatDay(iso: string): string {
  const dt = parseLocal(iso);
  return `${DAY_NAMES[dt.getDay()]}, ${dt.getDate()}.${dt.getMonth() + 1}.`;
}

const DAY_NAMES_SHORT = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"] as const;

/** "uto 4.8." — za retke 14-dnevne liste */
export function formatDayShort(iso: string): string {
  const dt = parseLocal(iso);
  return `${DAY_NAMES_SHORT[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.`;
}

/** "16:00" (24-satni) */
export function formatTime(iso: string): string {
  const dt = parseLocal(iso);
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

/** "16" — za traku po satima */
export function formatHour(iso: string): string {
  return pad2(parseLocal(iso).getHours());
}

/** epoch ms -> "HH:mm" lokalno — za "Podaci od HH:mm" */
export function clockTime(epochMs: number): string {
  const dt = new Date(epochMs);
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

export function convertTemp(celsius: number, unit: TempUnit): number {
  return unit === "C" ? celsius : (celsius * 9) / 5 + 32;
}

export function convertWind(kmh: number, unit: WindUnit): number {
  return unit === "kmh" ? kmh : kmh / 3.6;
}

export function tempUnitLabel(unit: TempUnit): string {
  return unit === "C" ? "°C" : "°F";
}

export function windUnitLabel(unit: WindUnit): string {
  return unit === "kmh" ? "km/h" : "m/s";
}

/** Kut u stupnjevima -> hrvatska kratica smjera (S, SI, I, ...). */
export function windDirLabel(deg: number): string {
  const idx = Math.round(deg / 45) % 8;
  return t.windDirs[idx] ?? "";
}
