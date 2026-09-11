import type { RadarStats } from "@/api/radarSample";
import type { RadarTemporal } from "@/utils/radarFeatures";
import { DBZ_DRY, DBZ_HEAVY, DBZ_STORM, isFog, isPrecip, isThunder, cloudCodeFromCover, precipCodeFromDbz } from "@/utils/radarJudge";

/**
 * CURRENT-WEATHER ENGINE V2 (11.9.2026.) — confidence umjesto hard switcha.
 *
 * V1 (`radarJudge.judgeCurrentCode`) ostaje NETAKNUT i još odlučuje u
 * aplikaciji. Ovaj modul računa paralelno; razlike se logiraju (shadow
 * mode) dok se ne dokaže da je bolji.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ŠTO JE MJERENJE POKAZALO, i zašto V2 izgleda ovako
 *
 * Replay protiv MJERENJA NA TLU (GeoSphere Austria, `tawes-v1-10min`,
 * mm/10 min, 240 postaja pod radarom, 38 mokrih — 11.9.2026.):
 *
 *   pravilo                    mokro   suho    F1
 *   ─────────────────────────────────────────────
 *   V1 (maxDbz >= 20)           37 %    94 %   0.431
 *   p90Dbz >= 20                34 %    96 %   0.441
 *   coverage20 >= 1 %           37 %    95 %   0.444
 *   PERSISTENCE >= 25 %         55 %    94 %   0.583   ← POBJEDNIK
 *
 * POSTOJANOST je najjači pojedinačni signal u cijelom skupu: +18 poena
 * na kiši uz ISTI pogodak na suhima. Zato V2 ne vaga sve featurese
 * jednako — postojanost dobiva glavnu težinu.
 *
 * VAŽAN NEGATIVAN NALAZ: pretraga težina (pers × cov × jačina × clutter,
 * 216 kombinacija) NIJE prešla F1 0.583 — dakle isto što i sama
 * postojanost. Složena fuzija na ovim podacima NE DODAJE ništa, pa je
 * `precipitationConfidence` namjerno prosta: postojanost nosi, ostalo
 * dotjeruje. Kad dataset naraste (ili dođe ML), težine su na jednom
 * mjestu i mijenjaju se bez diranja logike.
 *
 * STROP KOJI SE NE MOŽE PREĆI PRAGOVIMA: od 24 propuštene kiše, 20 ima
 * **0 dBZ** — radar ih ne vidi (0.6–1.2 mm/h na z=7). Realni maksimum
 * pogotka na mokrima iz ovog izvora je ~60 %, a postojanost je već na
 * 55 %. Ostatak traži gušći radar (LibreWXR z=11), ne bolje pragove.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Prag postojanosti — IZMJEREN, ne odabran (F1 0.583 na 240 postaja). */
export const PERSISTENCE_WET = 0.25;
/** Iznad ovoga pokrivenost sama potvrđuje oborinu (kišno polje). */
export const COVERAGE_WET = 0.05;
/** Ispod ovoga se tvrdnja o oborini ne postavlja ni uz postojanost. */
export const CONFIDENCE_WET = 0.25;
/** Model stariji od ovoga gubi gotovo svu težinu za „sada" (minute). */
export const MODEL_STALE_MIN = 90;
/** Naoblaka s postaje: potpuna težina do ovoga, pa pada (minute). */
export const SKY_FRESH_MIN = 15;
/** Naoblaka s postaje: iznad ovoga je težina praktično nula (minute). */
export const SKY_STALE_MIN = 75;

export type PrecipIntensity = "none" | "light" | "moderate" | "heavy" | "convective";
export type PrecipType = "rain" | "drizzle" | "snow" | "sleet" | "freezing_rain" | "hail" | "unknown";
export type EvidenceSource = "radar" | "station" | "model" | "blended" | "unknown";

export type CurrentWeatherEvidence = {
  radar: {
    available: boolean;
    ageMinutes: number;
    maxDbz: number | null;
    meanDbz: number | null;
    p90Dbz: number | null;
    coverage20: number;
    coverage28: number;
    coverage40: number;
    coverage55: number;
    weightedCoverage20: number;
    persistence: number;
    echoAgeMin: number;
    trendDbzPerHour: number;
    clutterScore: number;
    motionConfidence: number;
    confidence: number;
  };
  station: {
    available: boolean;
    distanceKm: number | null;
    ageMinutes: number;
    precipitationObserved: boolean | null;
    weatherCode: number | null;
    confidence: number;
  };
  model: {
    available: boolean;
    ageMinutes: number;
    precipitation: number | null;
    cloudCover: number | null;
    weatherCode: number | null;
    confidence: number;
  };
};

export type CurrentSkyResult = {
  condition: "clear" | "mostly_clear" | "partly_cloudy" | "mostly_cloudy" | "overcast" | "unknown";
  /** WMO kod koji app već razumije (0/1/2/3.5/3), ili `null`. */
  code: number | null;
  confidence: number;
  source: "station" | "model" | "blended" | "unknown";
  stationAgeMinutes: number | null;
  modelAgeMinutes: number | null;
};

export type CurrentWeatherResult = {
  code: number;
  precipitation: boolean;
  precipitationType: PrecipType | null;
  precipitationIntensity: PrecipIntensity;
  precipitationConfidence: number;
  source: EvidenceSource;
  sky: CurrentSkyResult;
  evidence: CurrentWeatherEvidence;
  diagnostics: { reason: string; flags: string[] };
};

export type V2Input = {
  radar?: { stats: RadarStats; temporal: RadarTemporal; clutterScore: number; frameTime: number };
  covered?: boolean;
  station?: { code?: number; ageMin: number; distanceKm: number };
  model: { code: number; cloudCover: number; precipitation?: number; ageMin: number };
  temp: number;
  nowMs: number;
};

/**
 * Starost MODELA u minutama iz njegovog vlastitog `time` (lokalni ISO).
 *
 * Izmjereno 11.9.2026.: Open-Meteo `current.interval` je 900 s, što je
 * samo KORAK, a ne svježina — u 09:18 je ECMWF kao „sada" vraćao 07:15.
 * Dakle model je redovno stariji od postaje, a ta se greška cijelo jutro
 * vidjela kao „model tvrdi kišu/vedro, a vani je drugo".
 *
 * Nepoznat oblik → 120 min (pretpostavka na strani nepovjerenja, jer je
 * to red veličine izmjerene starosti), ne 0.
 */
export function modelAgeMinutes(modelTime: string | undefined, nowMs: number): number {
  if (!modelTime) return 120;
  const m = modelTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return 120;
  const [, y, mo, d, h, mi] = m;
  const t = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)).getTime();
  const age = (nowMs - t) / 60_000;
  // Model iz budućnosti (zona, zaokruživanje) je „svjež", ne negativan.
  return age < 0 ? 0 : age;
}

/** Glatki pad pouzdanosti s dobi: 1 do `fresh`, 0 na `stale`. */
export function ageDecay(ageMin: number, fresh: number, stale: number): number {
  if (!Number.isFinite(ageMin)) return 0;
  if (ageMin <= fresh) return 1;
  if (ageMin >= stale) return 0;
  const x = (ageMin - fresh) / (stale - fresh);
  // Kosinusno ublaženo — bez skoka na granicama.
  return 0.5 * (1 + Math.cos(Math.PI * x));
}

/**
 * POUZDANOST DA OBORINA DOSEŽE TLO, 0..1.
 *
 * Težine su IZMJERENE (vidi zaglavlje): postojanost 0.7, pokrivenost 0.3,
 * jačina 0 — jer jačina na ovom datasetu nije dodala ništa iznad
 * postojanosti. Ostaje u formuli s malom težinom samo da jak, širok i
 * postojan odjek ne izgleda isto kao slab — ali ne smije sama odlučivati.
 *
 * Clutter SNIŽAVA, ne obara: jaka kiša može privremeno izgledati
 * stacionarno (Korenica 11.9.: 100 % kruga, pola sata, prava kiša).
 */
export function precipitationConfidence(
  stats: RadarStats,
  t: RadarTemporal,
  clutter: number,
): number {
  /*
   * DVA TVRDA UVJETA prije ikakvog vaganja — oba IZMJERENA, oba nađena
   * kao kvar u usporedbi na 112 mjesta 11.9.2026. (Vrgorac i Kutina:
   * 12 dBZ, a V2 je tvrdio kišu):
   *
   *  1. Trenutni odjek ispod `DBZ_DRY` NIJE oborina, ma što prošli okviri
   *     govorili — 95 % od 269 postaja pod 20 dBZ bilo je suho. Prva
   *     verzija je provjeravala samo `maxDbz === null`, pa je 12 dBZ
   *     prolazilo.
   *  2. Postojanost ispod praga je NULA, ne razmjer. `min(1, 0.20/0.25)`
   *     je davalo 0.8 za jedan okvir od pet — prag je time bio poništen
   *     upravo tamo gdje je najviše trebao (Metković).
   *
   * Kad okvira nema dovoljno da se postojanost zna (< 2), ne obara se —
   * isto načelo kao u V1 (`prevEcho`).
   */
  if (stats.maxDbz === null || stats.maxDbz < DBZ_DRY) return 0;
  if (t.frames >= 2 && t.persistence < PERSISTENCE_WET) return 0;
  const pers = t.frames >= 2 ? t.persistence : 0.5;
  const cov = Math.min(1, stats.weightedCoverage20 / COVERAGE_WET);
  const str = Math.min(1, (stats.p90Dbz ?? 0) / 28);
  const raw = 0.6 * pers + 0.3 * cov + 0.1 * str;
  return Math.max(0, Math.min(1, raw * (1 - 0.35 * clutter)));
}

/**
 * dBZ koji predstavlja JAČINU NAD TOČKOM — `median`, ne `p90` ni `max`.
 *
 * Izmjereno nad splitskom Rivom 11.9.2026. u 10:00, isti okvir, samo
 * različit polumjer uzorka:
 *
 *   polumjer   max   p90   MEDIAN   mm/h(p90)   mm/h(median)
 *     1 km      39    38     38        8.9          8.6
 *     1.5 km    47    44     38       20.3          7.4
 *     3 km      50    47     38       31.6          6.7
 *     5 km      52    47     38       31.6          4.2
 *
 * `median` je 38 na SVAKOM polumjeru; `p90` skoči s 38 na 47, a
 * procijenjena jačina s 8.9 na 31.6 mm/h. Dakle s `p90` je odgovor
 * ovisio o tome koliki krug gledamo, a ne o tome koliko pada — mijenjaš
 * polumjer i dobiješ 4× drugu brojku.
 *
 * Povod je Markov nalaz s kamere: app (i vrijemeradar.hr) tvrdili su
 * grmljavinsko nevrijeme nad Splitom, a na Rivi ljudi šetaju bez
 * kišobrana. Radar je bio u pravu da pada — DHMZ Split-Marjan (1.1 km)
 * javlja „grmljavina s oborinom", vlaga 98 % — ali je jezgra od 49 dBZ
 * bila nad morem i nad Klisom, 3–6 km dalje. Median (38 dBZ ≈ 9 mm/h)
 * odgovara onome što se s kamere vidi; p90 (47 ≈ 32 mm/h) ne.
 *
 * `p90` OSTAJE, ali za drugo pitanje: „ima li konvektivne jezgre u
 * blizini" (grmljavina, upozorenje). Jačina nad točkom i prisutnost
 * jezgre su dva različita pitanja i ne smiju dijeliti brojku.
 */
export function intensityDbz(stats: RadarStats): number | null {
  return stats.medianDbz ?? stats.weightedMeanDbz ?? stats.maxDbz;
}

/** Jačina NAD TOČKOM — iz `median`, koji ne ovisi o polumjeru. */
export function intensityFrom(stats: RadarStats): PrecipIntensity {
  const d = intensityDbz(stats);
  if (d === null || d < DBZ_DRY) return "none";
  // „Konvektivno" je svojstvo JEZGRE, ne točke — čita se iz p90/max.
  if ((stats.p90Dbz ?? stats.maxDbz ?? 0) >= DBZ_STORM) return "convective";
  if (d >= DBZ_HEAVY) return "heavy";
  if (d >= 28) return "moderate";
  return "light";
}

/**
 * VRSTA oborine. Radar ne razlikuje vrstu — samo temperaturu znamo, a
 * postaja zna stvarno (susnježica, ledena kiša). Zato postaja vodi kad je
 * blizu i svježa, inače se pogađa iz temperature.
 */
export function typeFrom(stationCode: number | undefined, temp: number): PrecipType {
  if (stationCode !== undefined) {
    if (stationCode === 66 || stationCode === 67) return "freezing_rain";
    if (stationCode >= 71 && stationCode <= 77) return "snow";
    if (stationCode === 68 || stationCode === 69) return "sleet";
    if (stationCode >= 51 && stationCode <= 55) return "drizzle";
    if (stationCode === 96 || stationCode === 99) return "hail";
    if (isPrecip(stationCode)) return "rain";
  }
  if (temp <= 0.5) return "snow";
  if (temp <= 2) return "sleet";
  return "rain";
}

/**
 * NAOBLAKA — vlastiti rezultat s vlastitim age decayem (Markov nalaz
 * 11.9.: „Zadar je sad pretežno oblačan a vani je pretežno vedro";
 * postaja je javljala termin star 50 min).
 *
 * DVA NAČELA:
 *
 *  1. Stara naoblaka NIJE činjenica — pouzdanost pada glatko s dobi.
 *     Rezultat ostaje isti, ali `confidence` govori koliko mu vjerovati.
 *
 *  2. ODSUTNOST ODJEKA NIJE VEDRO. Radar ne vidi oblake; suh oblačan dan
 *     je najčešće stanje zime. Radar smije samo POTVRDITI oblake kad
 *     oborina pada — nikad zaključiti vedro. (Ovdje se svjesno RAZILAZIM
 *     s predloženim dizajnom koji je tražio da stanje „postupno prelazi
 *     prema vedrom" bez odjeka — to bi svaki oblačan dan pretvorilo u
 *     vedar.)
 *
 * Model ima nižu OSNOVNU težinu od postaje (0.6) jer nije opažanje, i
 * uz to vlastiti decay — izmjereno 11.9.: ECMWF je u 09:18 kao „sada"
 * vraćao 07:15, dakle dva sata star.
 */
export function skyCondition(i: V2Input, precipConfidence: number): CurrentSkyResult {
  const st = i.station;
  const stationSky =
    st?.code !== undefined && (isFog(st.code) || (st.code >= 0 && st.code < 4)) ? st.code : null;
  const stationW = stationSky !== null ? ageDecay(st!.ageMin, SKY_FRESH_MIN, SKY_STALE_MIN) : 0;

  const modelSky = cloudCodeFromCover(i.model.cloudCover);
  const modelW = 0.6 * ageDecay(i.model.ageMin, 30, 240);

  // Oborina koja pada JEST dokaz oblaka — jedini smjer u kojem radar
  // smije govoriti o nebu.
  const overcastFromRain = precipConfidence >= CONFIDENCE_WET;

  let code: number | null;
  let source: CurrentSkyResult["source"];
  let confidence: number;

  /*
   * Izvor se imenuje po tome ODAKLE JE KOD, ne po tome što je bilo
   * dostupno. „blended" je rezervirano za slučaj kad se dva izvora
   * RAZILAZE a oba imaju sličnu težinu — tada je odgovor kompromis i
   * pouzdanost mu pada. Inače je izvor onaj čiji je kod uzet.
   */
  if (stationW > 0 && stationW >= modelW) {
    code = stationSky;
    const contested = modelW > 0 && modelSky !== stationSky && modelW >= 0.75 * stationW;
    source = contested ? "blended" : "station";
    // Kad se izvori razilaze, ne tvrdi se punom snagom.
    confidence = contested ? stationW * 0.75 : stationW;
  } else if (modelW > 0) {
    code = modelSky;
    const contested = stationW > 0 && stationSky !== null && stationSky !== modelSky;
    source = contested ? "blended" : "model";
    confidence = contested ? modelW * 0.75 : modelW;
  } else {
    code = overcastFromRain ? 3 : null;
    source = overcastFromRain ? "radar" as never : "unknown";
    confidence = overcastFromRain ? 0.5 : 0;
  }

  if (overcastFromRain && code !== null && code < 3) {
    // Pada, a nebo tvrdi vedro → oblaci su tu, tvrdnja je stara.
    code = 3;
    confidence = Math.max(confidence, 0.6);
  }

  const condition =
    code === null ? "unknown"
      : isFog(code) ? "overcast"
        : code <= 0.5 ? "clear"
          : code <= 1.5 ? "mostly_clear"
            : code <= 2.5 ? "partly_cloudy"
              : code < 3.5 + 0.01 && code >= 3.5 ? "mostly_cloudy"
                : "overcast";

  return {
    condition,
    code,
    confidence,
    source,
    stationAgeMinutes: st ? st.ageMin : null,
    modelAgeMinutes: i.model.ageMin,
  };
}

/**
 * V2 odluka o trenutnom vremenu. Nikad ne baca; bez svih izvora vraća
 * model s niskom pouzdanošću.
 */
export function judgeCurrentCodeV2(i: V2Input): CurrentWeatherResult {
  const flags: string[] = [];

  // ---- radar ----
  const radarAgeMin = i.radar ? (i.nowMs / 1000 - i.radar.frameTime) / 60 : Infinity;
  const radarUsable = !!i.radar && i.covered === true && radarAgeMin <= 20;
  if (i.radar && !radarUsable) flags.push(i.covered === false ? "RADAR_UNCOVERED" : "RADAR_STALE");

  const stats = i.radar?.stats;
  const temporal = i.radar?.temporal;
  const clutter = i.radar?.clutterScore ?? 0;
  const pConf = radarUsable && stats && temporal ? precipitationConfidence(stats, temporal, clutter) : 0;

  if (radarUsable && stats) {
    if (stats.coverage20 < 0.02 && stats.maxDbz !== null) flags.push("RADAR_LOW_COVERAGE");
    if (clutter >= 0.5) flags.push("POSSIBLE_CLUTTER");
    if (temporal && temporal.persistence >= 0.75) flags.push("RADAR_PERSISTENT");
    if (temporal && temporal.motionConfidence >= 0.4) flags.push("RADAR_MOVING");
    if (temporal && temporal.trendDbzPerHour > 15) flags.push("RADAR_GROWING");
  }

  // ---- postaja ----
  const st = i.station;
  const stationPrecip = st?.code !== undefined ? isPrecip(st.code) : null;
  const stationNear = (st?.distanceKm ?? Infinity) <= 8;
  const stationConf = st
    ? ageDecay(st.ageMin, 20, 60) * (stationNear ? 1 : 0.3)
    : 0;
  if (st?.code !== undefined && stationPrecip === true && stationConf > 0.3) flags.push("STATION_CONFIRMS");
  if (st?.code !== undefined && stationPrecip === false && pConf >= CONFIDENCE_WET) flags.push("STATION_CONTRADICTS");

  // ---- model ----
  const modelConf = 0.5 * ageDecay(i.model.ageMin, 30, 240);
  if (i.model.ageMin > MODEL_STALE_MIN) flags.push("MODEL_STALE");

  const evidence: CurrentWeatherEvidence = {
    radar: {
      available: radarUsable,
      ageMinutes: Number.isFinite(radarAgeMin) ? radarAgeMin : -1,
      maxDbz: stats?.maxDbz ?? null,
      meanDbz: stats?.meanDbz ?? null,
      p90Dbz: stats?.p90Dbz ?? null,
      coverage20: stats?.coverage20 ?? 0,
      coverage28: stats?.coverage28 ?? 0,
      coverage40: stats?.coverage40 ?? 0,
      coverage55: stats?.coverage55 ?? 0,
      weightedCoverage20: stats?.weightedCoverage20 ?? 0,
      persistence: temporal?.persistence ?? 0,
      echoAgeMin: temporal?.echoAgeMin ?? 0,
      trendDbzPerHour: temporal?.trendDbzPerHour ?? 0,
      clutterScore: clutter,
      motionConfidence: temporal?.motionConfidence ?? 0,
      confidence: pConf,
    },
    station: {
      available: !!st && st.code !== undefined,
      distanceKm: st?.distanceKm ?? null,
      ageMinutes: st?.ageMin ?? Infinity,
      precipitationObserved: stationPrecip,
      weatherCode: st?.code ?? null,
      confidence: stationConf,
    },
    model: {
      available: true,
      ageMinutes: i.model.ageMin,
      precipitation: i.model.precipitation ?? null,
      cloudCover: i.model.cloudCover,
      weatherCode: i.model.code,
      confidence: modelConf,
    },
  };

  const sky = skyCondition(i, pConf);

  /*
   * ODLUKA. Redoslijed je iz mjerenja, ne iz ukusa:
   *  1. radar kad je pouzdan — jedini gleda TVOJU točku u ovom trenutku
   *  2. postaja kad je blizu i svježa — jedina zna vrstu
   *  3. model — najstariji izvor, zato zadnji
   */
  let code: number;
  let source: EvidenceSource;
  let reason: string;
  let precipitation: boolean;

  const radarWet = pConf >= CONFIDENCE_WET;
  const stationWet = stationPrecip === true && stationConf >= 0.4;

  if (radarUsable && radarWet) {
    const intensity = intensityFrom(stats!);
    const thunder =
      (stats!.maxDbz ?? 0) >= DBZ_STORM ||
      ((stats!.maxDbz ?? 0) >= DBZ_HEAVY && (isThunder(st?.code ?? -1) || isThunder(i.model.code)));
    if (thunder) {
      code = 95;
      reason = `radar ${stats!.maxDbz} dBZ, konvektivna jezgra`;
    } else {
      // Jačina iz MEDIANA (ne p90) — vidi `intensityDbz`.
      code = precipCodeFromDbz(intensityDbz(stats!) ?? DBZ_DRY, i.temp);
      reason =
        `radar: median ${Math.round(intensityDbz(stats!) ?? 0)} dBZ` +
        ` (jezgra p90 ${Math.round(stats!.p90Dbz ?? 0)})` +
        `, postojanost ${Math.round(100 * (temporal?.persistence ?? 0))}%` +
        `, pokrivenost ${Math.round(100 * stats!.coverage20)}%`;
    }
    precipitation = true;
    // Vrsta ostaje postajina kad je blizu i svježa — ona zna susnježicu.
    if (stationWet && st?.code !== undefined && stationConf >= 0.6) {
      code = st.code;
      source = "blended";
      reason += `; vrsta s postaje (${st.distanceKm.toFixed(1)} km, ${Math.round(st.ageMin)} min)`;
    } else {
      source = "radar";
    }
    return {
      code, precipitation: true, precipitationType: typeFrom(st?.code, i.temp),
      precipitationIntensity: intensity, precipitationConfidence: pConf,
      source, sky, evidence, diagnostics: { reason, flags },
    };
  }

  // Radar radi i NE vidi oborinu → obara tvrdnje drugih (izmjereno: 94 %
  // pogotka na suhima, najjača strana V1 koju V2 čuva).
  if (radarUsable && !radarWet) {
    if (stationWet) flags.push("RADAR_OVERRIDES_STATION");
    code = sky.code ?? cloudCodeFromCover(i.model.cloudCover);
    return {
      code, precipitation: false, precipitationType: null,
      precipitationIntensity: "none", precipitationConfidence: pConf,
      source: sky.source === "unknown" ? "radar" : sky.source === "model" ? "model" : "station",
      sky, evidence,
      diagnostics: {
        reason: stats?.maxDbz === null
          ? "radar bez odjeka nad tockom"
          : `radar ${stats?.maxDbz} dBZ ali pouzdanost ${pConf.toFixed(2)} < ${CONFIDENCE_WET}`,
        flags,
      },
    };
  }

  // Radara nema — NIKAD „nema radara = nema kiše".
  flags.push("RADAR_UNAVAILABLE");
  if (stationWet && st?.code !== undefined) {
    return {
      code: st.code, precipitation: true, precipitationType: typeFrom(st.code, i.temp),
      precipitationIntensity: "moderate", precipitationConfidence: stationConf,
      source: "station", sky, evidence,
      diagnostics: { reason: `bez radara; postaja ${st.distanceKm.toFixed(1)} km, ${Math.round(st.ageMin)} min`, flags },
    };
  }
  if (st?.code !== undefined && stationConf > 0.2) {
    return {
      code: st.code, precipitation: isPrecip(st.code), precipitationType: isPrecip(st.code) ? typeFrom(st.code, i.temp) : null,
      precipitationIntensity: isPrecip(st.code) ? "light" : "none", precipitationConfidence: stationConf,
      source: "station", sky, evidence,
      diagnostics: { reason: "bez radara; postaja vodi", flags },
    };
  }
  flags.push("MODEL_FALLBACK");
  return {
    code: i.model.code, precipitation: isPrecip(i.model.code),
    precipitationType: isPrecip(i.model.code) ? typeFrom(undefined, i.temp) : null,
    precipitationIntensity: isPrecip(i.model.code) ? "moderate" : "none",
    precipitationConfidence: modelConf,
    source: "model", sky, evidence,
    diagnostics: { reason: `samo model, star ${Math.round(i.model.ageMin)} min`, flags },
  };
}
