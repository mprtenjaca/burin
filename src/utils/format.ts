import { t } from "@/i18n";

export type TempUnit = "C" | "F";
export type WindUnit = "kmh" | "ms";

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
  return `${t.dayNames[dt.getDay()]}, ${dt.getDate()}.${dt.getMonth() + 1}.`;
}

/** "uto 4.8." — za retke 14-dnevne liste */
export function formatDayShort(iso: string): string {
  const dt = parseLocal(iso);
  return `${t.dayNamesShort[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.`;
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

/**
 * Sati koji SU JOŠ PRED NAMA, iz niza koji počinje tekućim satom.
 *
 * Postoji jer se `hourly` gradi PRI DOHVATU (`mapHourly` reže od punog
 * sata), a upit stoji 30 minuta. U 15:40 niz je i dalje počinjao u
 * 15:00, pa je prva kolona trake bila sat koji TRAJE — i nosila je
 * prognozu od 15:00, koja se do 15:40 već mogla razići sa stvarnim
 * vremenom (nađeno na uređaju 8.8.2026.: pisalo je „kiša" dok je vani
 * bilo pretežno vedro).
 *
 * Rez se zato radi PRI CRTANJU, prema živom satu (`useNow`), pa traka
 * prelazi na sljedeći sat čim otkuca puni sat — bez novog dohvata.
 *
 * Uspoređuje se po punom satu, ne po točnom trenutku: unos za 16:00
 * mora ostati vidljiv cijeli taj sat, a nestati tek u 17:00.
 */
export function futureHours<T extends { time: string }>(hours: T[], now: Date): T[] {
  const startOfHour = new Date(now).setMinutes(0, 0, 0);
  const upcoming = hours.filter((h) => parseLocal(h.time).getTime() > startOfHour);
  /*
   * Kad prognoza zaostane (svi unosi su prošli), bolje je pokazati
   * zadnje poznato nego praznu traku.
   */
  return upcoming.length > 0 ? upcoming : hours;
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

/**
 * Kratka oznaka koja se lijepi na BROJ u gustim prikazima (Markov odabir
 * 6.8.2026.): Celzijus je zadan pa mu slovo ne treba — "24°". Fahrenheit
 * ga MORA imati, inače je "75°" neodredivo i izgleda kao pogrešna
 * temperatura u istoj aplikaciji.
 *
 * Za samostalne oznake (legende, DHMZ kartica) ostaje `tempUnitLabel`,
 * gdje je i "°C" na mjestu.
 */
export function tempUnitSuffix(unit: TempUnit): string {
  return unit === "C" ? "°" : "°F";
}

export function windUnitLabel(unit: WindUnit): string {
  return unit === "kmh" ? "km/h" : "m/s";
}

/** Kut u stupnjevima -> hrvatska kratica smjera (S, SI, I, ...). */
export function windDirLabel(deg: number): string {
  const idx = Math.round(deg / 45) % 8;
  return t.windDirs[idx] ?? "";
}
