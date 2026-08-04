import { fetchJson } from "./client";

const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";

/**
 * Naučena pristranost modela za jedno mjesto: koliko je model sustavno
 * topliji (+) ili hladniji (−) od stvarnosti, odvojeno za noć i dan.
 */
export type ModelBias = { night: number; day: number };

export const NO_BIAS: ModelBias = { night: 0, day: 0 };

/**
 * Primjenjuje se samo pola naučene vrijednosti. Mjereno na 62 DHMZ postaje
 * (4.8.2026.): bez korekcije 1.76 °C prosječnog odmaka, puna korekcija
 * 1.86 °C (gore — pojačava šum), polovična 1.67 °C. Dio razlike je stvarna
 * pristranost modela, dio je slučajni šum, pa se uzima pola.
 */
const BIAS_FACTOR = 0.5;

/** Sigurnosna granica — naučena pristranost ne smije divljati. */
const MAX_BIAS_C = 4;

/** Koliko dana povijesti se koristi za učenje. */
const LEARN_DAYS = 14;

/** Arhiva zaostaje nekoliko dana, pa učimo do ovog odmaka. */
const ARCHIVE_LAG_DAYS = 6;

type HourlyTemps = { hourly?: { time: string[]; temperature_2m: (number | null)[] } };

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clamp(v: number): number {
  return Math.max(-MAX_BIAS_C, Math.min(MAX_BIAS_C, v));
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/**
 * Uči pristranost modela za mjesto: usporedi što model *sada* tvrdi za
 * protekle dane s onim što je arhiva zabilježila da je stvarno bilo.
 * Odvojeno za noćne (22–07 h) i dnevne sate, jer model najviše griješi
 * noću u zaleđu (ne dopušta da se udoline ohlade).
 *
 * Nikad ne baca — bez podataka vraća nulu i model ostaje nekorigiran.
 */
export async function learnModelBias(
  lat: number,
  lon: number,
  now: Date = new Date(),
): Promise<ModelBias> {
  try {
    const end = new Date(now.getTime() - ARCHIVE_LAG_DAYS * 86_400_000);
    const start = new Date(end.getTime() - LEARN_DAYS * 86_400_000);

    const [archive, model] = await Promise.all([
      fetchJson<HourlyTemps>(
        `${ARCHIVE_BASE}?latitude=${lat}&longitude=${lon}&start_date=${isoDate(start)}` +
          `&end_date=${isoDate(end)}&hourly=temperature_2m&timezone=auto`,
      ),
      fetchJson<HourlyTemps>(
        `${FORECAST_BASE}?latitude=${lat}&longitude=${lon}` +
          `&hourly=temperature_2m&past_days=${LEARN_DAYS + ARCHIVE_LAG_DAYS}` +
          `&forecast_days=1&timezone=auto`,
      ),
    ]);

    const archTimes = archive.hourly?.time ?? [];
    const archTemps = archive.hourly?.temperature_2m ?? [];
    const modelTimes = model.hourly?.time ?? [];
    const modelTemps = model.hourly?.temperature_2m ?? [];
    if (archTimes.length === 0 || modelTimes.length === 0) return NO_BIAS;

    const byTime = new Map<string, number>();
    modelTimes.forEach((time, i) => {
      const v = modelTemps[i];
      if (typeof v === "number") byTime.set(time, v);
    });

    const nightDiffs: number[] = [];
    const dayDiffs: number[] = [];
    for (let i = 0; i < archTimes.length; i++) {
      const time = archTimes[i]!;
      const truth = archTemps[i];
      const predicted = byTime.get(time);
      if (typeof truth !== "number" || predicted === undefined) continue;
      const hour = Number(time.slice(11, 13));
      const diff = predicted - truth;
      if (hour >= 22 || hour <= 7) nightDiffs.push(diff);
      else dayDiffs.push(diff);
    }

    // Malo uzorka -> ne vjerujemo naučenom.
    if (nightDiffs.length < 20 && dayDiffs.length < 20) return NO_BIAS;

    return {
      night: nightDiffs.length >= 20 ? clamp(mean(nightDiffs) * BIAS_FACTOR) : 0,
      day: dayDiffs.length >= 20 ? clamp(mean(dayDiffs) * BIAS_FACTOR) : 0,
    };
  } catch {
    return NO_BIAS;
  }
}
