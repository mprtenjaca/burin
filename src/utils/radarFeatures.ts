import type { RadarStats } from "@/api/radarSample";

/**
 * TEMPORALNI FEATUREI RADARA (11.9.2026.) — V2 sloj.
 *
 * Prostorne statistike (`sampleStats`) kažu KOLIKO je područja pod
 * odjekom sada. Ovaj modul kaže ŠTO SE S TIM DEŠAVA kroz vrijeme, a to je
 * jedina stvar koja pouzdano razlikuje kišu od zemljanog odjeka.
 *
 * Temelj je mjerenje istog dana nad dvama mjestima u istom satu:
 *
 *   METKOVIĆ — lažna jaka kiša (Markov nalaz: „po kamerama kiše nema"):
 *     08:20  30 dBZ ( 8 %)   08:30  45 (18 %)   08:40  24 ( 6 %)
 *     08:50  49 dBZ (49 %)   09:00  39 (71 %)   09:10  bez odjeka
 *     → skače 30↕45↕24↕49, pa NESTANE u jednom okviru
 *
 *   KORENICA — prava kiša (Marko: „Korenica još pada"):
 *     08:30  29 dBZ (100 %)  08:40  37 (100 %)
 *     08:50  33 dBZ (100 %)  09:00  36 (100 %)
 *     → stabilno, puna pokrivenost, pola sata
 *
 *   ZADAR jutros — prava kiša koja PROLAZI:
 *     07:30  33 → 07:40  39 → 07:50  37 → 08:00  38 → 08:10  17
 *     → raste, drži se 35 min, pa naglo padne (ćelija je prošla)
 *
 * NAMJERNO PROSTO: bez optical flowa i bez korelacije polja. Na z=7 je
 * piksel ~0.88 km (44° N), pa je pomak od jednog piksela na granici šuma —
 * složeniji algoritam bi dao dojam točnosti koju podaci ne nose. Ovo
 * mjeri ono što se na toj rezoluciji MOŽE mjeriti.
 */

/** Jedan okvir nad točkom: statistike + vrijeme. */
export type FrameSample = RadarStats & { frameTime: number };

export type RadarTemporal = {
  /**
   * Udio okvira (od najnovijeg unatrag) koji imaju odjek ≥ 20 dBZ, 0..1.
   * Korenica ≈ 1.0, Metković ≈ 0.6 uz velike skokove.
   */
  persistence: number;
  /** Koliko je MINUTA odjek neprekidno prisutan, gledano od najnovijeg. */
  echoAgeMin: number;
  /**
   * Promjena jačine po satu (dBZ/h), iz linearne regresije kroz okvire.
   * Pozitivno = raste (konvekcija), negativno = slabi (ćelija odlazi).
   */
  trendDbzPerHour: number;
  /**
   * Prosječna ABSOLUTNA promjena jačine između susjednih okvira (dBZ).
   * Visoko = treperi. Metković ~13, Korenica ~3.
   */
  jitterDbz: number;
  /**
   * Procijenjena brzina pomaka u km/h, ili `null` kad se ne da izvesti.
   * Računa se iz pomaka TEŽIŠTA odjeka između okvira.
   */
  speedKmh: number | null;
  /** Smjer ODAKLE dolazi, stupnjevi (0 = sa sjevera), ili `null`. */
  fromDirDeg: number | null;
  /**
   * Koliko se vjeruje pomaku, 0..1. Nisko kad je pomak reda jednog
   * piksela ili kad okviri nisu dosljedni.
   */
  motionConfidence: number;
  /** Koliko je okvira sudjelovalo u računu. */
  frames: number;
};

/** Ima li okvir odjek koji se uopće računa. */
const hasEcho = (f: FrameSample) => f.maxDbz !== null && f.maxDbz >= 20;

/** Reprezentativna jačina okvira: p90, pa median, pa max. */
export function frameStrength(f: FrameSample): number {
  return f.p90Dbz ?? f.medianDbz ?? f.maxDbz ?? 0;
}

/**
 * Nagib pravca kroz (vrijeme, jačina) — dBZ na sat. Najmanji kvadrati;
 * s manje od dva okvira nema trenda.
 */
function slopePerHour(points: { t: number; v: number }[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const mt = points.reduce((a, p) => a + p.t, 0) / n;
  const mv = points.reduce((a, p) => a + p.v, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mt) * (p.v - mv);
    den += (p.t - mt) ** 2;
  }
  if (den === 0) return 0;
  return (num / den) * 3600; // po sekundi → po satu
}

/**
 * Temporalni featurei iz niza okvira. `frames` MORA biti sortiran po
 * vremenu uzlazno (najstariji prvi); najnoviji je mjerodavan za „sada".
 *
 * `centroids` su težišta odjeka po okviru u KILOMETRIMA relativno na
 * korisničku točku (x prema istoku, y prema sjeveru) — `undefined` za
 * okvire bez odjeka. Kad ih nema, pomak se ne računa.
 */
export function radarTemporal(
  frames: FrameSample[],
  centroids?: (({ xKm: number; yKm: number }) | undefined)[],
): RadarTemporal {
  if (frames.length === 0) {
    return {
      persistence: 0, echoAgeMin: 0, trendDbzPerHour: 0, jitterDbz: 0,
      speedKmh: null, fromDirDeg: null, motionConfidence: 0, frames: 0,
    };
  }

  const withEcho = frames.filter(hasEcho);
  const persistence = withEcho.length / frames.length;

  // Koliko je odjek NEPREKIDNO prisutan, od najnovijeg unatrag. Prekid
  // znači da je ovo nova pojava, ne ista koja traje.
  let streak = 0;
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    if (!hasEcho(frames[i]!)) break;
    streak += 1;
  }
  const newest = frames[frames.length - 1]!;
  const echoAgeMin =
    streak <= 1
      ? 0
      : (newest.frameTime - frames[frames.length - streak]!.frameTime) / 60;

  const trendDbzPerHour = slopePerHour(
    withEcho.map((f) => ({ t: f.frameTime, v: frameStrength(f) })),
  );

  // Treperenje: prosječna apsolutna razlika između SUSJEDNIH okvira.
  // Računa se preko svih okvira, i onih bez odjeka (nestajanje JE skok).
  let jitterSum = 0;
  let jitterN = 0;
  for (let i = 1; i < frames.length; i += 1) {
    jitterSum += Math.abs(frameStrength(frames[i]!) - frameStrength(frames[i - 1]!));
    jitterN += 1;
  }
  const jitterDbz = jitterN > 0 ? jitterSum / jitterN : 0;

  // ---- pomak ----
  let speedKmh: number | null = null;
  let fromDirDeg: number | null = null;
  let motionConfidence = 0;

  if (centroids && centroids.length === frames.length) {
    const steps: { dx: number; dy: number; dtH: number }[] = [];
    for (let i = 1; i < frames.length; i += 1) {
      const a = centroids[i - 1];
      const b = centroids[i];
      if (!a || !b) continue;
      const dtH = (frames[i]!.frameTime - frames[i - 1]!.frameTime) / 3600;
      if (dtH <= 0) continue;
      steps.push({ dx: b.xKm - a.xKm, dy: b.yKm - a.yKm, dtH });
    }
    if (steps.length > 0) {
      const vx = steps.reduce((a, s) => a + s.dx / s.dtH, 0) / steps.length;
      const vy = steps.reduce((a, s) => a + s.dy / s.dtH, 0) / steps.length;
      speedKmh = Math.hypot(vx, vy);
      // Smjer ODAKLE dolazi: vektor pomaka okrenut za 180°.
      fromDirDeg = (((Math.atan2(-vx, -vy) * 180) / Math.PI) + 360) % 360;

      /*
       * Pouzdanost pomaka. Dva uvjeta, oba nužna:
       *
       *  1. pomak mora biti VEĆI OD ŠUMA. Na z=7 je piksel ~0.88 km, a
       *     težište se i na mirnom polju pomiče za ~pola piksela. Ispod
       *     3 km/h (0.5 km u 10 min) se ne vjeruje ništa.
       *  2. koraci moraju biti DOSLJEDNI. Ako svaki korak ide u svoju
       *     stranu, to je šum, ne kretanje — mjeri se kao duljina zbroja
       *     kroz zbroj duljina (1 = svi isti smjer, 0 = razilaze se).
       */
      const sumLen = Math.hypot(
        steps.reduce((a, s) => a + s.dx, 0),
        steps.reduce((a, s) => a + s.dy, 0),
      );
      const lenSum = steps.reduce((a, s) => a + Math.hypot(s.dx, s.dy), 0);
      const coherence = lenSum > 0 ? sumLen / lenSum : 0;
      const speedFactor = Math.min(1, Math.max(0, (speedKmh - 3) / 12));
      motionConfidence = coherence * speedFactor;
    }
  }

  return {
    persistence, echoAgeMin, trendDbzPerHour, jitterDbz,
    speedKmh, fromDirDeg, motionConfidence, frames: frames.length,
  };
}

/**
 * CLUTTER SCORE, 0..1 — koliko odjek izgleda kao zemlja, a ne kao kiša.
 *
 * Zemljani odjek (brdo, zgrada, more pri određenom kutu) ima potpis koji
 * se mjeri: stoji na istom mjestu, ne pomiče se, ne raste i ne slabi.
 * Prava kiša se pomiče, jača i slabi. Izmjereno nad Dalmacijom 10.9.:
 * LibreWXR je nad Polačom i Pridragom davao 42–62 dBZ uz 100 %
 * pokrivenost i NEPOMIČAN uzorak kroz okvire, a vani su bili sami oblaci.
 *
 * NAMJERNO NE VRAĆA ODLUKU, nego ocjenu: jaka kiša može privremeno
 * izgledati stabilno (Korenica, 100 % kroz pola sata), pa visok score
 * samo SNIŽAVA pouzdanost, a ne obara tvrdnju sam.
 *
 * Tri doprinosa, svaki 0..1, pa prosjek s težinama:
 *  - NEPOMIČNOST (0.5): prisutan dugo, a ne pomiče se → sumnjivo.
 *  - MIRNOĆA (0.3): nema ni trenda ni treperenja → kiša uvijek malo diše.
 *  - USKOST (0.2): jaka jezgra na malom dijelu kruga → jezgra u oblaku
 *    ili točkasti odjek s tla.
 */
export function clutterScore(stats: RadarStats, t: RadarTemporal): number {
  if (stats.maxDbz === null) return 0;

  // 1. Nepomičnost vrijedi samo ako odjek TRAJE — jedan okvir ne govori
  //    ništa o kretanju. Puna kazna od 30 min prisutnosti bez pomaka.
  const stationary =
    t.echoAgeMin >= 20 && t.motionConfidence < 0.2
      ? Math.min(1, t.echoAgeMin / 30)
      : 0;

  // 2. Mirnoća: ni rasta ni pada ni treperenja. Kiša u 10 min promijeni
  //    barem nekoliko dBZ; brdo ne.
  const calm =
    t.frames >= 3
      ? Math.max(0, 1 - Math.abs(t.trendDbzPerHour) / 20) * Math.max(0, 1 - t.jitterDbz / 6)
      : 0;

  // 3. Uskost: jak signal, malo područja.
  const narrow =
    stats.maxDbz >= 35 && stats.coverage20 < 0.3
      ? Math.min(1, (0.3 - stats.coverage20) / 0.3)
      : 0;

  return Math.min(1, 0.5 * stationary + 0.3 * calm + 0.2 * narrow);
}
