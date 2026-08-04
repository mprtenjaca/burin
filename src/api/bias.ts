import { fetchJson } from "./client";

const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";

/**
 * Naučena pristranost modela za jedno mjesto: koliko je model sustavno
 * topliji (+) ili hladniji (−) od stvarnosti. Razdvojeno po dijelu dana
 * jer greška nije ravnomjerna — u kraškom zaleđu je najveća u samom
 * jutarnjem minimumu (04–08 h), kad je jezero hladnog zraka najdublje,
 * a znatno manja u prvom dijelu noći.
 */
export type ModelBias = {
  /** 22–03 h */
  earlyNight: number;
  /** 04–08 h — jutarnji minimum, ovdje model najviše griješi. */
  dawn: number;
  /** 09–21 h */
  day: number;
};

export const NO_BIAS: ModelBias = { earlyNight: 0, dawn: 0, day: 0 };

export type BiasSlot = keyof ModelBias;

/** Je li pristranost ništavna (usporedba po vrijednosti, ne po referenci). */
export function isZeroBias(bias: ModelBias): boolean {
  return bias.earlyNight === 0 && bias.dawn === 0 && bias.day === 0;
}

/** U koji dio dana pada dani sat (0–23). */
export function biasSlotForHour(hour: number): BiasSlot {
  if (hour >= 4 && hour <= 8) return "dawn";
  if (hour >= 22 || hour <= 3) return "earlyNight";
  return "day";
}

/*
 * Umjesto fiksnog faktora, primjenjuje se samopodesivo prigušenje po
 * DOSLJEDNOSTI promašaja: |prosjek| / prosjek |promašaja|. Kad model
 * griješi stalno u istom smjeru (Starigrad: pretopao u 18 od 20 jutara,
 * dosljednost ~0.97), primijeni se gotovo cijela naučena vrijednost;
 * kad su promašaji šum bez smjera, prigušenje ih samo uguši. Fiksni
 * faktor (0.75) je upravo na takvim mjestima gušio i stvarnu, dosljednu
 * grešku — Starigrad je ostajao 2° pretopao iako je greška bila očita.
 */

/** Sigurnosna granica — naučena pristranost ne smije divljati. */
const MAX_BIAS_C = 5;

/**
 * Koliko dana povijesti se koristi. Dulji period daje stabilniju procjenu,
 * ali prati sezonu s odmakom — tri tjedna je razumna sredina.
 */
const LEARN_DAYS = 21;

/** Arhiva zaostaje nekoliko dana; učimo do ovog odmaka od danas. */
const ARCHIVE_LAG_DAYS = 6;

/** Najmanji broj usporedivih sati da naučenom vjerujemo. */
const MIN_SAMPLES = 30;

type HourlyTemps = { hourly?: { time: string[]; temperature_2m: (number | null)[] } };

type DailyTemps = {
  daily?: {
    time: string[];
    temperature_2m_min: (number | null)[];
    temperature_2m_max: (number | null)[];
  };
};

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
 * Prosjek promašaja prigušen vlastitom dosljednošću (izvezeno radi testova).
 * Dosljednost = |prosjek| / prosjek apsolutnih promašaja: 1 kad model
 * griješi uvijek u istom smjeru i za sličan iznos, ~0 kad je šum.
 */
export function shrunkBias(diffs: number[]): number {
  if (diffs.length === 0) return 0;
  const avg = mean(diffs);
  const meanAbs = mean(diffs.map(Math.abs));
  if (meanAbs === 0) return 0;
  const consistency = Math.min(1, Math.abs(avg) / meanAbs);
  return avg * consistency;
}

/*
 * ODBAČENO: učenje pristranosti iz okolnih DHMZ postaja. Ideja je bila da
 * postaje mjere stvarnost pa vide grešku koju arhiva ne vidi. Izmjereno
 * (5.8.2026.) da ne radi: u međuterminima DHMZ objavi samo ~29 postaja, pa
 * su "okolne" postaje 30–70 km daleko i u posve drugom krajoliku (za
 * Starigrad: Gospić i Plitvice na 600+ m, Veli Rat svjetionik na moru).
 * Model je tamo *prehladan*, pa se naučilo −0.9 °C i Starigrad je postao
 * još topliji. Greška modela se ne prenosi preko reljefa.
 */

/**
 * Uči pristranost modela za mjesto: usporedi što model *sada* tvrdi za
 * protekle dane s onim što je arhiva zabilježila da je stvarno bilo.
 *
 * Jutarnja (`dawn`) pristranost se uči iz **dnevnih minimuma**, a ne iz
 * prosjeka jutarnjih sati. Razlika je bitna: mjereno u Starigradu
 * (11.–30.7.2026.) prosjek jutarnjih sati daje 2.2 °C, a stvarni promašaj
 * minimuma je 2.69 °C i dosljedan je (pozitivan u 18 od 20 dana, do
 * +5.4 °C) — model ne dopušta da se kraška udolina ohladi do dna.
 *
 * OGRANIČENJE: arhiva dijeli grubu mrežu s prognozom, pa ne vidi grešku
 * uzrokovanu pogrešnom ćelijom (Starigrad). Za to služi
 * `learnBiasFromStations`, koje uči iz stvarnih mjerenja.
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
    const pastDays = LEARN_DAYS + ARCHIVE_LAG_DAYS;

    const [archive, model, archiveDaily, modelDaily] = await Promise.all([
      fetchJson<HourlyTemps>(
        `${ARCHIVE_BASE}?latitude=${lat}&longitude=${lon}&start_date=${isoDate(start)}` +
          `&end_date=${isoDate(end)}&hourly=temperature_2m&timezone=auto`,
      ),
      fetchJson<HourlyTemps>(
        `${FORECAST_BASE}?latitude=${lat}&longitude=${lon}` +
          `&hourly=temperature_2m&past_days=${pastDays}` +
          `&forecast_days=1&timezone=auto`,
      ),
      fetchJson<DailyTemps>(
        `${ARCHIVE_BASE}?latitude=${lat}&longitude=${lon}&start_date=${isoDate(start)}` +
          `&end_date=${isoDate(end)}&daily=temperature_2m_min,temperature_2m_max&timezone=auto`,
      ),
      fetchJson<DailyTemps>(
        `${FORECAST_BASE}?latitude=${lat}&longitude=${lon}` +
          `&daily=temperature_2m_min,temperature_2m_max&past_days=${pastDays}` +
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

    const diffs: Record<BiasSlot, number[]> = {
      earlyNight: [],
      dawn: [],
      day: [],
    };
    for (let i = 0; i < archTimes.length; i++) {
      const time = archTimes[i]!;
      const truth = archTemps[i];
      const predicted = byTime.get(time);
      if (typeof truth !== "number" || predicted === undefined) continue;
      diffs[biasSlotForHour(Number(time.slice(11, 13)))].push(predicted - truth);
    }

    const learned = (slot: BiasSlot) =>
      diffs[slot].length >= MIN_SAMPLES ? clamp(shrunkBias(diffs[slot])) : 0;

    // Promašaj dnevnog minimuma/maksimuma — vjerniji stvarnoj greški nego
    // prosjek sati, jer se vrhovi krivulje ne poravnaju s prosjekom.
    const extremeBias = (key: "temperature_2m_min" | "temperature_2m_max") => {
      const truthDays = archiveDaily.daily?.time ?? [];
      const truthVals = archiveDaily.daily?.[key] ?? [];
      const modelDays = modelDaily.daily?.time ?? [];
      const modelVals = modelDaily.daily?.[key] ?? [];
      if (truthDays.length === 0 || modelDays.length === 0) return undefined;

      const byDate = new Map<string, number>();
      modelDays.forEach((date, i) => {
        const v = modelVals[i];
        if (typeof v === "number") byDate.set(date, v);
      });

      const list: number[] = [];
      truthDays.forEach((date, i) => {
        const truth = truthVals[i];
        const predicted = byDate.get(date);
        if (typeof truth !== "number" || predicted === undefined) return;
        list.push(predicted - truth);
      });
      // Trebamo barem tjedan dana da procjeni vjerujemo.
      return list.length >= 7 ? clamp(shrunkBias(list)) : undefined;
    };

    const minBias = extremeBias("temperature_2m_min");
    const maxBias = extremeBias("temperature_2m_max");

    const bias: ModelBias = {
      earlyNight: learned("earlyNight"),
      // Minimum dana pada u ovo razdoblje, pa mu je promašaj minimuma
      // vjerniji od prosjeka jutarnjih sati.
      dawn: minBias ?? learned("dawn"),
      day: maxBias ?? learned("day"),
    };
    return isZeroBias(bias) ? NO_BIAS : bias;
  } catch {
    return NO_BIAS;
  }
}
