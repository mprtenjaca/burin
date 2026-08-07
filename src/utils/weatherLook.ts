import { t } from "@/i18n";

/**
 * Izgled izveden iz vremena: gradijent heroja + opisne ocjene metrika.
 * Sve su čiste funkcije — testiraju se u __tests__/weatherLook.test.ts.
 */

/** Tri stopa gradijenta, od vrha prema sredini ekrana. */
export type GradientStops = [string, string, string];

type Palette = { light: GradientStops; dark: GradientStops };

/**
 * Palete po "obitelji" vremena (dizajn v7, 6.8.2026.). Svijetla tema se
 * stapa u podlogu stranice, tamna u #0E0E0E — završni stop dodaje
 * HeroBackdrop, ovdje su samo obojeni dijelovi.
 *
 * SVIJETLA TEMA JE PRODUBLJENA (Markov ispravak 6.8.2026., drugi krug):
 * treći stopovi su bili gotovo na podlozi (#F1F1EE), pa je donja trećina
 * heroja izgledala "previše bijelo" — boja je nestajala prije nego je
 * gradijent uopće stigao do fade sloja. Sada svaki treći stop drži još
 * vidljiv ton svoje obitelji, a u podlogu ga gasi tek fade.
 *
 * Tamna tema je namjerno NEDIRANA — Marko ju je potvrdio kao dobru.
 */
const PALETTES = {
  sunDay: {
    /*
     * Po Markovom promptu (6.8.2026.): topla zlatno-žuta na vrhu prelazi
     * u bogatu narančastu, pa blijedi prema gotovo bijelom dnu (završni
     * prijelaz u pageBg dodaje HeroBackdrop). Smjer gradijenta je
     * DIJAGONALAN — vidi HeroBackdrop.
     */
    light: ["#F4C542", "#ED7F2B", "#EBA765"],
    /*
     * Tamna tema dijeli PRVA DVA stopa sa svijetlom (Markov odabir
     * 6.8.2026.): prigušena inačica (#B4671E → #8A5220 → #4F3418) je
     * izgledala blatnjavo-smeđe i "pretmurno" — sunce mora biti sunce i
     * po noćnoj temi aplikacije.
     *
     * Samo TREĆI stop odstupa: svijetla tema tu ide u gotovo bijelo
     * (#F6CE93) jer se stapa u papirnatu podlogu, a tamna mora stići do
     * #0E0E0E. Bez toga bi na dnu heroja bio oštar rez blijedog u crno.
     */
    dark: ["#F4C542", "#ED7F2B", "#8A4A1E"],
  },
  partlyDay: {
    light: ["#ECA45B", "#E8B074", "#DDB894"],
    dark: ["#9A6530", "#74522C", "#443320"],
  },
  cloud: {
    light: ["#97A0A8", "#A9B2B9", "#BCC4CA"],
    dark: ["#4A5158", "#383E44", "#24282C"],
  },
  rain: {
    light: ["#7E97AC", "#95ABBE", "#AEC0CE"],
    dark: ["#43596C", "#35485A", "#22303D"],
  },
  snow: {
    light: ["#A9C3D4", "#BAD0DE", "#CCDEE9"],
    dark: ["#3E5468", "#32455A", "#223040"],
  },
  thunder: {
    light: ["#6B7287", "#7E8497", "#979CAD"],
    dark: ["#3F4459", "#333748", "#20222E"],
  },
  nightClear: {
    /*
     * NOĆ JE TAMNA I U SVIJETLOJ TEMI (Markov ispravak 6.8.2026.).
     *
     * Tema opisuje sučelje, ne doba dana — noćni heroj ne smije biti
     * svijetloplav samo zato što je aplikacija u svijetloj temi. Izmjereno
     * je i da je stari kraj (#7887A8) davao bijelom tekstu 3.6:1, ispod
     * praga čitljivosti; sada drži iznad 7:1 cijelom visinom.
     *
     * Zvijezde su drugi razlog: na svijetloplavoj podlozi se ne vide.
     *
     * Potamnjeno dvaput (drugi krug: 2E3A57 → 232C44), jer je i prva
     * inačica na uređaju još izgledala presvijetlo plavo.
     */
    light: ["#232C44", "#2E3A57", "#3C4A6B"],
    dark: ["#2A3550", "#222B42", "#161D2E"],
  },
  nightCloudy: {
    // Oblačna noć prati vedru (vidi gore) — noć je tamna u obje teme.
    light: ["#282D38", "#343A47", "#434A5A"],
    dark: ["#333844", "#282C36", "#191C23"],
  },
} satisfies Record<string, Palette>;

type PaletteKey = keyof typeof PALETTES;

/** WMO kod + doba dana → obitelj palete. Nepoznat kod = oblačno. */
function paletteKey(code: number, isDay: boolean): PaletteKey {
  if (code >= 95 && code <= 99) return "thunder";
  if (code >= 71 && code <= 86 && code !== 80 && code !== 81 && code !== 82) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 3 || code === 45 || code === 48) return isDay ? "cloud" : "nightCloudy";
  if (code === 2) return isDay ? "partlyDay" : "nightCloudy";
  if (code <= 1) return isDay ? "sunDay" : "nightClear";
  return isDay ? "cloud" : "nightCloudy";
}

export function weatherGradient(
  code: number,
  isDay: boolean,
  dark: boolean,
): GradientStops {
  const palette = PALETTES[paletteKey(code, isDay)];
  return dark ? palette.dark : palette.light;
}

/**
 * Ambijentalni sloj preko gradijenta heroja (dorada 6.8.2026.). Svaki
 * tip crta drugu "atmosferu" — vidi `HeroBackdrop`:
 *
 *  - `rays`   sunčane zrake: mirne kose crte koje dišu, uz rijetke bljeske
 *  - `rain`   kiša: isprekidane zrake koje klize niz dijagonalu
 *  - `snow`   pahulje koje padaju i njišu se
 *  - `clouds` oblačno: mekane mrlje koje plove i mijenjaju gustoću
 *  - `fog`    magla: gusti slojevi koji se valjaju preko ekrana
 *
 * Vezano uz ISTU paletu kao gradijent, pa se dodavanje vremena rješava
 * na jednom mjestu. Čista funkcija — testira se.
 */
export type BackdropEffect =
  | "rays"
  | "rain"
  | "snow"
  | "clouds"
  | "fog"
  | "lightning"
  | "stars";

/**
 * Jačina oborine — kiša ne pada svugdje jednako brzo (dorada 6.8.2026.):
 * rosulja je gotovo mirna, pljusak juri. Množi brzinu klizanja zraka.
 */
export type PrecipIntensity = "light" | "moderate" | "heavy";

/** WMO: 51/53/56/61/66/71/73/80 su slabiji, 65/67/75/82/95+ najjači. */
export function precipIntensity(code: number): PrecipIntensity {
  // Slaba rosulja, ledena rosulja, slaba kiša/snijeg, slabi pljuskovi.
  if ([51, 53, 56, 61, 66, 71, 73, 80].includes(code)) return "light";
  // Jaka kiša/snijeg, jaki pljuskovi, grmljavina s tučom.
  if ([65, 67, 75, 82, 96, 99].includes(code)) return "heavy";
  return "moderate";
}

/** WMO 45 i 48: magla i magla s injem — jedini pravi "fog" kodovi. */
const FOG_CODES = [45, 48];

/**
 * SUSNJEŽICA — ledena rosulja (56, 57) i ledena kiša (66, 67). Padaju
 * i kapi i zrnca, pa dobivaju OBA sloja (Markov zahtjev 6.8.2026.:
 * pokriti osnovne kombinacije, bez pretjerivanja).
 */
const SLEET_CODES = [56, 57, 66, 67];

/**
 * Slojevi pozadine za dano vrijeme — može ih biti VIŠE (kombinacije).
 * Redoslijed je redoslijed crtanja: prvi je najniži.
 *
 * Pokrivene kombinacije (namjerno samo osnovne):
 *  - susnježica  = kiša + snijeg
 *  - grmljavina  = kiša + bljeskovi
 *
 * Čista funkcija — testira se.
 */
export function backdropEffects(code: number, isDay: boolean): BackdropEffect[] {
  // Magla ima vlastiti sloj — s oblačnim je dijelila kod, a izgleda
  // posve drukčije (gusto i valjajuće, ne rijetko i plovuće).
  if (FOG_CODES.includes(code)) return ["fog"];
  if (SLEET_CODES.includes(code)) return ["rain", "snow"];

  const key = paletteKey(code, isDay);
  switch (key) {
    case "sunDay":
      return ["rays"];
    /*
     * DJELOMIČNO OBLAČNO = zrake + oblaci (popravak 6.8.2026.).
     *
     * Prije je vraćalo samo `["rays"]`, isto kao čisto sunce, pa se na
     * uređaju vidjelo kao "vedro, samo malo manje vedro" — u pozadini
     * NIJE BILO NI JEDNOG OBLAKA, a stanje se zove djelomično oblačno.
     * Oblaci ovdje dolaze u manjoj gustoći (vidi `density` u CloudsLayer).
     */
    case "partlyDay":
      return ["rays", "clouds"];
    /*
     * VEDRA NOĆ = zvijezde + mjesec (popravak 6.8.2026.).
     *
     * Prije je padala u `default` i dobivala OBLAKE — vedro nebo se
     * crtalo kao naoblaka, iako je paleta (`nightClear`) cijelo vrijeme
     * bila ispravna. Isti propust kao kod djelomično oblačnog, samo
     * obrnut: ondje je nedostajao oblak, ovdje je bio višak.
     *
     * Mjesec je dio `StarsLayer`, ne zaseban efekt: nikad ne stoji bez
     * zvijezda, a zaseban sloj bi značio drugi SVG i drugu petlju za
     * jedan krug.
     */
    case "nightClear":
      return ["stars"];
    case "thunder":
      return ["rain", "lightning"];
    case "rain":
      return ["rain"];
    case "snow":
      return ["snow"];
    // Oblačno i obje noćne palete: mekane mrlje, bez sunca i oborine.
    default:
      return ["clouds"];
  }
}

// ---- mjesečeva mijena ----

/**
 * Sinodički mjesec (mjena do mjene) u danima — 29.530588853, standardna
 * astronomska vrijednost.
 */
const SYNODIC_MONTH = 29.530588853;

/**
 * Referentni MLAĐAK: 6.1.2000. 18:14 UTC. Klasična epoha za ovaj račun
 * (Meeusov "Astronomical Algorithms"), dovoljno točna za crtež — greška
 * je reda nekoliko sati na desetljeće, a srp se po satu ne mijenja.
 */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 86_400_000;

/**
 * Mjesečeva mijena kao udio ciklusa 0–1 (6.8.2026.).
 *
 *   0.00  mlađak (nevidljiv)
 *   0.25  prva četvrt (osvijetljena DESNA polovica)
 *   0.50  uštap (pun)
 *   0.75  zadnja četvrt (osvijetljena LIJEVA polovica)
 *
 * Namjerno se računa, a ne crta fiksni srp: mjesec na ekranu bi inače
 * proturječio onome što se vidi kroz prozor. Čista funkcija — testira se.
 */
export function moonPhase(at: number = Date.now()): number {
  const days = at / 86_400_000 - KNOWN_NEW_MOON;
  const phase = (days / SYNODIC_MONTH) % 1;
  // JS `%` čuva predznak, a za datume prije epohe treba pozitivan udio.
  return phase < 0 ? phase + 1 : phase;
}

/**
 * Geometrija srpa za crtež (6.8.2026.).
 *
 * Mjesec se crta kao PUNI krug preko kojeg ide krug SJENE u boji neba.
 * `shadowOffset` je pomak sjene u polumjerima: 0 ju stavlja točno preko
 * mjeseca (mlađak, ništa se ne vidi), 2 ju odmiče posve (uštap).
 *
 * Predznak nosi stranu: pri rastućem mjesecu sjena je LIJEVO (svijetli
 * desni rub), pri opadajućem DESNO — kako se stvarno vidi na nebu.
 */
export function moonShadowOffset(phase: number): number {
  // Udaljenost od uštapa: 0 = pun, 1 = mlađak.
  const fromFull = Math.abs(phase - 0.5) * 2;
  const magnitude = 2 * (1 - fromFull);
  // Prva polovica ciklusa raste (sjena lijevo), druga opada (desno).
  return phase < 0.5 ? -magnitude : magnitude;
}

/** Koraljno narančasti akcent — instrumenti u karticama, hladne pozadine. */
export const ACCENT_CORAL = "#EE6E3C";
/** Čelično plavi akcent — na toplim (narančastim) pozadinama heroja. */
export const ACCENT_STEEL = "#4C8FDF";

/**
 * Akcent na HEROJU prati VRSTU vremena (Markova odluka 6.8.2026.):
 * sunčano i svijetlo → topla narančasta, hladno/kišno/tamno → plava.
 *
 * (Ranije je bilo obrnuto — plava na narančastom heroju, da se koraljna
 * ne utopi. Ali kiša JEST plava tema, pa boja sada nosi značenje.)
 *
 * Nijanse su tamnije od čistih akcenata: izmjereno 6.8.2026. da na
 * svijetlim dnima heroja (gdje traka sati stoji) i koraljna i plava
 * padnu na ~2:1 kontrasta — presvijetlo za postotke oborine.
 * Instrumenti u karticama ostaju čisto koraljni; kartice su neutralne.
 */
const HERO_WARM = "#D4531F";
const HERO_COOL = "#2C6FC4";

export function heroAccent(code: number, isDay: boolean): string {
  const key = paletteKey(code, isDay);
  // Sunčano i djelomično oblačan dan su jedine "tople" pozadine.
  return key === "sunDay" || key === "partlyDay" ? HERO_WARM : HERO_COOL;
}

/**
 * Boje Meteoalarm razina (2 žuto / 3 narančasto / 4 crveno) — žuta i
 * narančasta iz postojećih skala (UV/AQI), crvena ista kao njihov vrh.
 */
export const WARNING_COLORS: Record<2 | 3 | 4, string> = {
  2: "#F5C518",
  3: "#F58A2E",
  4: "#E63946",
};

export function warningColor(level: 2 | 3 | 4): string {
  return WARNING_COLORS[level];
}

/**
 * Boja teksta NA podlozi upozorenja: na žutoj bijela ne prolazi prag
 * kontrasta (pravilo za starije korisnike), pa žuta dobiva tamni tekst.
 */
export function warningFg(level: 2 | 3 | 4): string {
  return level === 2 ? "#141414" : "#FFFFFF";
}

/**
 * Čitljiva boja teksta na proizvoljnoj hex podlozi (relativna luminancija
 * po WCAG-u). Heroj to ne treba — tamo tekst prati temu, a gradijenti su
 * po temi birani — ali značka na karti da: ista značka stoji nad svijetlim
 * dnevnim i nad tamnim noćnim gradijentom.
 */
export function readableOn(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#141414";
  const channel = (i: number) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  /*
   * Granica 0.19 je točka u kojoj su WCAG kontrasti tamnog i bijelog
   * teksta jednaki: (L+0.05)/0.0556 = 1.05/(L+0.05) → L ≈ 0.19. Raniji
   * prag 0.45 je na bogatoj narančastoj (#ED7F2B, L=0.33) birao bijeli
   * tekst s kontrastom 2.7:1 umjesto tamnog sa 6.9:1.
   */
  return luminance > 0.19 ? "#141414" : "#FFFFFF";
}

// ---- jačina vjetra (značka zastave) ----

/**
 * Jačina vjetra za značku "zastava" (6.8.2026.). Priobalju je bura glavni
 * podatak, pa se vidi već u listama gradova — ne treba otvarati mjesto.
 *
 * Pragovi su Markov odabir, isti kao Vrijeme&Radar: ispod 10 m/s NEMA
 * značke (inače bi stajala gotovo uvijek i prestala nositi informaciju),
 * 10–17 m/s bijela, od 17 m/s crvena. 17.2 m/s je i granica 8 Beauforta
 * (olujno), pa se skala poklapa s pomorskom prognozom.
 *
 * ULAZ JE km/h jer `WeatherBundle.windSpeed` stoji u km/h (`convertWind`
 * pretvara IZ km/h) — miješanje jedinica bi značku upalilo pri 10 km/h.
 */
export type WindStrength = "calm" | "strong" | "storm";

/** 10 m/s u km/h — granica na kojoj se značka pojavljuje. */
export const WIND_FLAG_KMH = 36;
/** 17 m/s u km/h — granica na kojoj zastava postaje crvena (8 Bf). */
export const WIND_STORM_KMH = 61.2;

export function windStrength(speedKmh: number): WindStrength {
  if (speedKmh >= WIND_STORM_KMH) return "storm";
  if (speedKmh >= WIND_FLAG_KMH) return "strong";
  return "calm";
}

/**
 * Boje značke vjetrulje (`WindFlag`):
 *  - `strong` je boja RUKAVA — bijel je uvijek, kao prava vjetrulja
 *  - `storm` je boja PRUGA I STUPA kad je bura olujna; ista crvena kao
 *    Meteoalarm razina 4, da "crveno" kroz aplikaciju znači jedno
 *
 * Pri samo jakom vjetru pruge su sive (definirano u `WindFlag`) — rukav
 * ostaje bijel u oba slučaja.
 */
export const WIND_FLAG_COLORS: Record<Exclude<WindStrength, "calm">, string> = {
  strong: "#FAFAF8",
  storm: WARNING_COLORS[4],
};

/**
 * Rosište po Magnusovoj formuli (WMO koeficijenti). Ulaz: °C i % vlage.
 */
export function dewPoint(tempC: number, humidityPct: number): number {
  const b = 17.62;
  const c = 243.12;
  const gamma = Math.log(Math.max(1, humidityPct) / 100) + (b * tempC) / (c + tempC);
  return (c * gamma) / (b - gamma);
}

/** WHO razredi UV indeksa. */
export function uvLabel(uv: number): string {
  if (uv < 3) return t.uvLabels.low;
  if (uv < 6) return t.uvLabels.moderate;
  if (uv < 8) return t.uvLabels.high;
  if (uv < 11) return t.uvLabels.veryHigh;
  return t.uvLabels.extreme;
}

/** Opisna ocjena vidljivosti (km). */
export function visibilityLabel(km: number): string {
  if (km >= 20) return t.visibilityLabels.excellent;
  if (km >= 8) return t.visibilityLabels.good;
  if (km >= 2) return t.visibilityLabels.moderate;
  return t.visibilityLabels.poor;
}

// ---- pelud ----

/** Vrste koje Open-Meteo (CAMS) daje za Europu, grains/m³. */
export type PollenSpecies = "alder" | "birch" | "grass" | "mugwort" | "olive" | "ragweed";

export type PollenLevels = Partial<Record<PollenSpecies, number>>;

/** 0 = nema, 1 niska ... 4 vrlo visoka. */
export type PollenGrade = 0 | 1 | 2 | 3 | 4;

/**
 * Pragovi grains/m³ za [nisku, umjerenu, visoku] granicu — iznad zadnje
 * je "vrlo visoka". PO VRSTI, jer alergena snaga nije ista: ambrozija i
 * pelin izazivaju simptome na deseterostruko manjim koncentracijama od
 * breze. Vrijednosti su orijentacijske (CAMS je model, ne mjerenje —
 * napomena stoji u Izvorima); poredak razreda je ono što se testira.
 */
const POLLEN_THRESHOLDS: Record<PollenSpecies, [number, number, number]> = {
  alder: [10, 50, 150],
  birch: [10, 50, 150],
  grass: [5, 25, 80],
  mugwort: [10, 30, 80],
  olive: [10, 50, 150],
  ragweed: [8, 25, 60],
};

/** Boje razreda peludi: ista ljestvica kao UV (zeleno→ljubičasto bez ekstrema). */
export const POLLEN_COLORS = ["#7BC96F", "#F5E12E", "#F58A2E", "#E63946"] as const;

function pollenGrade(species: PollenSpecies, value: number): PollenGrade {
  if (value < 0.5) return 0;
  const [low, moderate, high] = POLLEN_THRESHOLDS[species];
  if (value <= low) return 1;
  if (value <= moderate) return 2;
  if (value <= high) return 3;
  return 4;
}

export type PollenInfo = {
  /** Najviši razred među vrstama — ukupna ocjena kartice. */
  grade: PollenGrade;
  color?: string;
  /** Aktivne vrste, najjača prva; `fraction` 0–1 za trakicu. */
  species: { key: PollenSpecies; grade: PollenGrade; fraction: number }[];
};

export type PollenSpeciesInfo = {
  key: PollenSpecies;
  grade: PollenGrade;
  fraction: number;
};

/**
 * SVE vrste s razredom i udjelom 0–1 za skalu — aktivne najjače prve, pa
 * vrste na nuli. Podstranica peluda prikazuje kompletnu listu (i "Nema"),
 * dok kartica na početnoj kroz `pollenInfo` uzima samo aktivne.
 */
export function pollenSpecies(levels: PollenLevels): PollenSpeciesInfo[] {
  return (Object.keys(POLLEN_THRESHOLDS) as PollenSpecies[])
    .map((key) => {
      const value = levels[key];
      const grade = value === undefined ? (0 as PollenGrade) : pollenGrade(key, value);
      const [, , high] = POLLEN_THRESHOLDS[key];
      return {
        key,
        grade,
        // Skala se puni prema granici "vrlo visoke" te vrste.
        fraction: Math.min(1, (value ?? 0) / high),
      };
    })
    .sort((a, b) => b.fraction - a.fraction);
}

/**
 * Ocjena peludi za bento karticu. Vrste ispod praga detekcije se
 * izostavljaju; kad su sve na nuli, `grade` je 0 i kartica se uopće ne
 * prikazuje (zimi nema prazne kartice).
 */
export function pollenInfo(levels: PollenLevels): PollenInfo {
  const species = pollenSpecies(levels).filter((s) => s.grade > 0);
  const grade = species.reduce<PollenGrade>(
    (max, s) => (s.grade > max ? s.grade : max),
    0,
  );
  return {
    grade,
    color: grade > 0 ? POLLEN_COLORS[grade - 1] : undefined,
    species,
  };
}

/** Boje segmenata AQI skale (EEA razredi), od dobrog prema izrazito lošem. */
export const AQI_COLORS = [
  "#2EE6A8",
  "#A8E063",
  "#F5E12E",
  "#F58A2E",
  "#E63946",
] as const;

/**
 * Ocjena kvalitete zraka: EEA europski AQI (isti pragovi kao stari AqiRow).
 * `fraction` je položaj markera na skali 0–1 (skala pokriva 0–100+).
 */
export function aqiInfo(aqi: number): { label: string; color: string; fraction: number } {
  const classes: { max: number; label: string; color: string }[] = [
    { max: 20, label: t.aqi.good, color: AQI_COLORS[0] },
    { max: 40, label: t.aqi.fair, color: AQI_COLORS[1] },
    { max: 60, label: t.aqi.moderate, color: AQI_COLORS[2] },
    { max: 80, label: t.aqi.poor, color: AQI_COLORS[3] },
    { max: 100, label: t.aqi.veryPoor, color: AQI_COLORS[4] },
  ];
  const cls =
    classes.find((c) => aqi <= c.max) ??
    { max: Infinity, label: t.aqi.extremelyPoor, color: AQI_COLORS[4] };
  return { label: cls.label, color: cls.color, fraction: Math.min(1, aqi / 100) };
}
