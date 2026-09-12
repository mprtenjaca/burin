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

/**
 * „SADA" U ZONI MJESTA, izraženo kao lokalni Date uređaja — par za
 * `parseLocal` (12.9.2026., Markov nalaz na Sidneyju u Ohiju).
 *
 * Open-Meteo se zove s `timezone=auto`, pa satni unosi VEĆ dolaze u
 * vremenu mjesta („2026-09-12T08:00" znači 08:00 po Ohiju). Ali
 * `parseLocal` ih gradi `new Date(y, m-1, d, hh, mm)`, a taj konstruktor
 * uvijek radi u zoni UREĐAJA — pa se „08:00 u Ohiju" uspoređivalo s
 * hrvatskih 14:12 i ispadalo kao prošlost.
 *
 * Izmjereno: u Ohiju 08:11, traka je počinjala od 15:00 umjesto od 09:00
 * i PRESKAKALA šest sati (cijelo prijepodne). Vrijedi za svaki grad izvan
 * zone uređaja; na hrvatskim gradovima se ne vidi jer je pomak nula.
 *
 * Popravak je pomak istog predznaka koji `parseLocal` već nosi: uzme se
 * pravi trenutak, doda pomak mjesta i oduzme pomak uređaja, pa oba kraja
 * usporedbe žive u istoj (uređajevoj) skali.
 *
 * Bez `utcOffsetSeconds` vraća `now` nepromijenjen — tako se ponašaju
 * pozivi koji zonu još ne nose i domaći gradovi.
 */
export function placeNow(now: Date, utcOffsetSeconds?: number): Date {
  if (utcOffsetSeconds === undefined) return now;
  const deviceOffsetMs = -now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() + utcOffsetSeconds * 1000 - deviceOffsetMs);
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
/**
 * Sati za traku: od SLJEDEĆEG sata naprijed.
 *
 * Traka je PROGNOZA — Markov odabir 11.9.2026.: „pokazuj samo od
 * sljedećeg, sadašnji i prošli nemaju smisla u traci, oni su dolje na
 * 14-dnevnoj gdje se može vidjeti što je bilo ujutro".
 *
 * Sadašnjost ionako stoji iznad, na heroju (isti presuđeni kod), pa bi je
 * stupac ponavljao; prošli sati žive u sheetu dana, gdje ih
 * `withPastCodes` ispravlja iz radarskih okvira.
 *
 * Isti rez je stajao i prije 10.9., iz drugog razloga (tada je tekući
 * stupac nosio MODELSKU prognozu za sat koji traje — u 15:40 je „15"
 * crtao kišu iz runa starog pola sata). Kratko je 11.9. bio pomaknut na
 * tekući sat i vraćen istog dana.
 */
export function futureHours<T extends { time: string }>(
  hours: T[],
  now: Date,
  utcOffsetSeconds?: number,
): T[] {
  const startOfHour = new Date(placeNow(now, utcOffsetSeconds)).setMinutes(0, 0, 0);
  const upcoming = hours.filter((h) => parseLocal(h.time).getTime() > startOfHour);
  /*
   * Kad prognoza zaostane (svi unosi su prošli), bolje je pokazati
   * zadnje poznato nego praznu traku.
   */
  return upcoming.length > 0 ? upcoming : hours;
}

/** epoch ms -> "HH:mm" lokalno — za "Podaci od HH:mm" */
export function clockTime(epochMs: number, utcOffsetSeconds?: number): string {
  const dt = placeNow(new Date(epochMs), utcOffsetSeconds);
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

/**
 * Oznaka zone uz sat, SAMO kad se mjesto ne poklapa s uređajem
 * (12.9.2026., Markov zahtjev za američke gradove).
 *
 * Ne ispisuje se ime zone (`America/New_York`) nego pomak od UTC-a —
 * kratica je nejednoznačna (CST je i Amerika i Kina), a pomak je
 * jednoznačan i ne treba prijevod. Domaći grad ne dobiva ništa: tamo
 * oznaka ne govori ništa novo, a oduzima prostor.
 */
export function zoneLabel(utcOffsetSeconds: number | undefined, now = new Date()): string {
  if (utcOffsetSeconds === undefined) return "";
  const deviceOffsetSeconds = -now.getTimezoneOffset() * 60;
  if (utcOffsetSeconds === deviceOffsetSeconds) return "";
  const sign = utcOffsetSeconds < 0 ? "−" : "+";
  const abs = Math.abs(utcOffsetSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  return `UTC${sign}${h}${m ? `:${pad2(m)}` : ""}`;
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

/**
 * Podnaslov reda u tražilici: „Zadarska županija · Hrvatska" (9.9.2026.).
 *
 * Povod: tražilica je dala Vranu na Cresu umjesto one uz Vransko jezero, a
 * Polača postoji i kod Knina — sama država ne razlikuje istoimena mjesta,
 * županija da. Vrijedi za sve zemlje („Bayern · Njemačka"), jer i tamo ih
 * ima. Regija se preskače kad je jednaka imenu (Wien · Wien), a prazna
 * polja ispadaju. Bez ičega vraća prazan niz — red tada ne crta podnaslov.
 */
export function placeSubtitle(place: {
  name: string;
  region?: string;
  country?: string;
}): string {
  return [place.region, place.country]
    .filter((s): s is string => !!s && s.trim().length > 0 && s !== place.name)
    .join(" · ");
}
