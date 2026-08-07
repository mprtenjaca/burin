import type { WeatherBundle } from "@/api/types";
import type { TempUnit, WindUnit } from "@/utils/format";
import { clockTime, convertTemp, convertWind, tempUnitSuffix, windUnitLabel } from "@/utils/format";
import { readableOn, weatherGradient, WIND_FLAG_KMH } from "@/utils/weatherLook";
import { codeToCondition } from "@/utils/weatherCodes";

import {
  ambientForWeather,
  filled,
  iconForWeather,
  type WidgetIconName,
} from "./iconNames";
import type { WidgetProps } from "./props";

/**
 * MOST IZMEĐU APLIKACIJE I WIDGETA (7.8.2026.).
 *
 * Widget je zaseban proces: ne vidi AsyncStorage, ne ide na mrežu i ne
 * izvršava naš ostali JS. Zato se SVE računa ovdje — gradijent, boja
 * teksta, jedinice, prijevodi — pa se preko App Groupa pošalje gotov
 * niz vrijednosti.
 *
 * Time paleta i pragovi ostaju na JEDNOM mjestu (`weatherLook.ts`):
 * kad se promijeni boja vremena, widget je dobije bez ijedne izmjene.
 */

/**
 * Koliko unosa unaprijed ide u vremensku crtu.
 *
 * iOS BUDŽETIRA buđenja widgeta (~40–70 dnevno) i sam odlučuje kad će
 * ga osvježiti — snapshot bi zato do večeri prikazivao jutarnju
 * temperaturu. `updateTimeline` unaprijed upiše sate, pa widget ostaje
 * točan i bez ijednog buđenja aplikacije.
 *
 * 12 je odabrano jer pokriva pola dana: dovoljno da widget prebrodi noć
 * bez otvaranja aplikacije, a kratko da se prognoza ne razlikuje previše
 * od stvarnosti na kraju niza.
 */
const TIMELINE_HOURS = 12;

/**
 * PALETE WIDGETA — potamnjene inačice svijetle teme (7.8.2026.).
 *
 * Zašto postoje: widget je malen i gleda se u prolazu, često vani na
 * suncu. Bijeli tekst je ondje čitljiviji i ljepši, ali na svijetlim
 * paletama aplikacije pada na 1.6–2.7:1 — daleko ispod praga 4.5:1.
 *
 * Rješenje NIJE mijenjati boju teksta nego podlogu: iste boje (isti ton),
 * samo spuštene svjetline dok bijeli tekst ne prođe prag. Izmjereno je
 * svako od njih; najniže je djelomično oblačno sa 4.78:1.
 *
 * SUNCE je poseban slučaj: potamnjena žuta postaje pečena narančasta u
 * kojoj sunčan dan izgleda kao prašina (provjereno renderom). Zato vedar
 * dan u widgetu ide u PLAVO NEBO — vidi `sunDay` niže.
 *
 * Vrijedi za OBJE teme telefona: widget ima jednu verziju (vidi
 * `widgetGradient`).
 */
const WIDGET_DARK_PALETTES: Record<string, [string, string, string]> = {
  cloud: ["#5E666E", "#4E555C", "#3E4449"],
  rain: ["#4A6274", "#3D5264", "#324454"],
  snow: ["#54707F", "#48606E", "#3B505D"],
  thunder: ["#4A4F60", "#3E4353", "#333747"],
  /*
   * DJELOMIČNO OBLAČNO je isto PLAVO (Markov odabir 7.8.2026.), samo
   * malo tamnije od vedrog — naoblaka nebo prigušuje, ne pretvara ga u
   * narančasto. Prije je bila pečena narančasta, koja je uz vedro plavo
   * izgledala kao posve drugo vrijeme, a ne kao "isto nebo s oblacima".
   *
   * Sunce se čita iz BIJELOG SJAJA u kutu i iz ikone, ne iz podloge.
   */
  partlyDay: ["#3A6B98", "#2C567E", "#204464"],
  /*
   * VEDAR DAN je PLAVO NEBO u widgetu (Markov odabir 7.8.2026.).
   *
   * Žuto-narančasta iz aplikacije ne trpi bijeli tekst (1.63:1), a
   * potamnjena postaje pečena narančasta u kojoj sunčan dan izgleda kao
   * prašina. Plavo rješava oboje: bijeli tekst prolazi (4.80 / 6.67 /
   * 9.05) i vedar dan se čita kao vedro NEBO, što je i točnije.
   *
   * Sunce ostaje u ikoni i u zrakama — ne u podlozi.
   */
  sunDay: ["#3E76AA", "#2F5F8E", "#234B72"],
};

/**
 * Ključ palete iz WMO koda — isti pragovi kao `paletteKey` u
 * `weatherLook.ts`. Duplicira se svjesno: `weatherLook` taj ključ ne
 * izvozi, a widget treba znati KOJU paletu zamijeniti.
 */
function paletteKeyFor(code: number, isDay: boolean): string {
  if (code >= 95 && code <= 99) return "thunder";
  if (code >= 71 && code <= 86 && code !== 80 && code !== 81 && code !== 82) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 3 || code === 45 || code === 48) return isDay ? "cloud" : "nightCloudy";
  if (code === 2) return isDay ? "partlyDay" : "nightCloudy";
  if (code <= 1) return isDay ? "sunDay" : "nightClear";
  return isDay ? "cloud" : "nightCloudy";
}

/**
 * Gradijent za widget.
 *
 * JEDNA VERZIJA, bez obzira na temu telefona (Markov odabir 7.8.2026.):
 * widget je uvijek taman, pa uvijek nosi bijeli tekst. Tema aplikacije
 * ovdje ne sudjeluje — `weatherGradient` se zove s `dark = true` samo za
 * noćna vremena, koja svoju potamnjenu inačicu već imaju.
 *
 * Tako pločica na početnom zaslonu izgleda isto ujutro i navečer, što je
 * i točnije: korisnik ne mijenja temu zbog widgeta.
 */
function widgetGradient(code: number, isDay: boolean): [string, string, string] {
  const override = WIDGET_DARK_PALETTES[paletteKeyFor(code, isDay)];
  if (override) return override;
  const base = weatherGradient(code, isDay, true);
  return [base[0], base[1], base[2]];
}

/**
 * Ime ikone → putanja u dijeljenom folderu.
 *
 * Ubacuje se kao ARGUMENT, a ne uvozi: prava izvedba (`widgetIcons.ts`)
 * radi `require` na PNG-ove i na nativne module, pa bi uvoz srušio testove
 * ovog modula. Zadana vrijednost vraća prazno, što znači "bez ikone" —
 * tako testovi i Android prolaze bez ijedne nativne ovisnosti.
 */
type IconResolver = (name: WidgetIconName) => string;

const NO_ICONS: IconResolver = () => "";

/**
 * Udari se prikazuju SAMO iznad praga značke (`WIND_FLAG_KMH`, 10 m/s) —
 * inače `null`. Isto pravilo kao `WindFlag` u aplikaciji: značka koja
 * stoji uvijek prestane nositi informaciju.
 *
 * Prag se provjerava u km/h (izvorna jedinica modela), a PRETVARA se tek
 * za prikaz — inače bi se pri m/s pragu upalilo na 10 km/h.
 */
function gustsForWidget(kmh: number | undefined, unit: WindUnit): number | null {
  if (kmh === undefined || kmh < WIND_FLAG_KMH) return null;
  return Math.round(convertWind(kmh, unit));
}

/**
 * `WeatherBundle` → propovi widgeta, za zadani sat.
 *
 * `code`/`isDay`/`temp` se predaju zasebno, a ne čitaju iz `bundle`, jer
 * ista funkcija služi i za SADAŠNJOST (iz `current`) i za BUDUĆE sate
 * (iz `hourly`) — vidi `widgetEntries`.
 */
function toProps(
  bundle: WeatherBundle,
  temp: number,
  code: number,
  isDay: boolean,
  tempUnit: TempUnit,
  windUnit: WindUnit,
  gustsKmh: number | undefined,
  iconPath: IconResolver,
): WidgetProps {
  const stops = widgetGradient(code, isDay);
  const today = bundle.daily[0];
  const deg = (c: number) => Math.round(convertTemp(c, tempUnit));
  const gusts = gustsForWidget(gustsKmh, windUnit);

  const tMax = deg(today?.tMax ?? temp);
  const tMin = deg(today?.tMin ?? temp);

  return {
    place: bundle.place.name,
    temp: deg(temp),
    unit: tempUnitSuffix(tempUnit),
    condition: codeToCondition(code, isDay).label,
    tMax,
    tMin,
    stops,
    // Tekst prati PODLOGU, ne temu — isto pravilo kao heroj od 7.8.2026.
    fg: readableOn(stops[1]),
    gusts,
    windUnit: windUnitLabel(windUnit),
    fetchedAt: clockTime(bundle.fetchedAt),
    icon: iconPath(iconForWeather(code, isDay)),
    iconFill: iconPath(filled(iconForWeather(code, isDay))),
    // Ikona vjetra samo kad ima što pokazati — inače prazno.
    windIcon: gusts !== null ? iconPath("wind") : "",
    ambient: ambientForWeather(code, isDay),
    /*
     * Raspon za `Gauge` na zaključanom zaslonu. Osigurava se da je
     * min < max: kad prognoza dade jednake vrijednosti (ili kad dnevnih
     * podataka nema pa oba padnu na trenutnu temperaturu), `Gauge` s
     * min === max dijeli nulom i luk ostane prazan.
     */
    gaugeMin: tMin,
    gaugeMax: tMax > tMin ? tMax : tMin + 1,
  };
}

/**
 * Niz unosa za `updateTimeline`: sada + sljedećih `TIMELINE_HOURS` sati.
 *
 * Izvezeno zasebno od `pushWidget` da se može testirati bez nativnog
 * modula — `expo-widgets` je nativan i u testovima nije dostupan.
 */
export function widgetEntries(
  bundle: WeatherBundle,
  tempUnit: TempUnit,
  windUnit: WindUnit,
  now: number = Date.now(),
  iconPath: IconResolver = NO_ICONS,
): { date: Date; props: WidgetProps }[] {
  const first = {
    date: new Date(now),
    props: toProps(
      bundle,
      bundle.current.temp,
      bundle.current.code,
      bundle.current.isDay,
      tempUnit,
      windUnit,
      bundle.current.windGusts,
      iconPath,
    ),
  };

  /*
   * Buduće unose nosi `hourly` (sljedeća 24 h, već korigiran mjerenjem).
   * Filtriraju se sati u BUDUĆNOSTI — `hourly[0]` je tekući sat, koji je
   * već pokriven `first`-om iz `current`, a duplikat istog trenutka bi
   * iOS-u dao dva unosa s istim datumom.
   */
  const future = bundle.hourly
    .map((h) => ({ h, at: new Date(h.time).getTime() }))
    .filter(({ at }) => at > now)
    .slice(0, TIMELINE_HOURS)
    .map(({ h, at }) => ({
      date: new Date(at),
      props: toProps(
        bundle,
        h.temp,
        h.code,
        h.isDay,
        tempUnit,
        windUnit,
        h.windGusts,
        iconPath,
      ),
    }));

  return [first, ...future];
}

/**
 * Upiše vrijeme u widget. Zove se nakon uspješnog dohvata.
 *
 * Tiho odustaje ako widget nije dostupan (stari build bez nativnog
 * modula, ili Android): widget je ukras, a **nikad ne smije srušiti
 * aplikaciju**. Isti obrazac kao lijeni uvoz `expo-localization`.
 */
export async function pushWidget(
  bundle: WeatherBundle,
  tempUnit: TempUnit,
  windUnit: WindUnit,
): Promise<void> {
  /*
   * IKONE SU ODVOJENA BRIGA od upisa crte (popravak 7.8.2026.).
   *
   * Prije je sve stajalo u JEDNOM `try`, pa je pad `syncWidgetIcons`
   * (koji dira `expo-file-system`, `expo-asset` i App Group) preskakao i
   * `updateTimeline` ispod sebe. Widget je time ostajao BEZ IJEDNOG
   * PROPA i crtao se kao bijela pločica s "undefined" — greške nije
   * bilo jer ju je `catch` progutao.
   *
   * Sada: ikone smiju pasti, crta se svejedno upisuje (bez ikona).
   */
  let iconPath: IconResolver = NO_ICONS;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const icons = require("./widgetIcons") as {
      syncWidgetIcons: () => Promise<void>;
      widgetIconPath: IconResolver;
    };
    await icons.syncWidgetIcons();
    iconPath = icons.widgetIconPath;
  } catch (e) {
    // Ikone nisu stigle u App Group — widget radi, samo bez njih.
    console.warn("[burin] widget ikone nisu spremne:", e);
  }

  try {
    /*
     * Uvoz je LIJEN (7.8.2026.), jer `BurinWidget` vuče `expo-widgets` i
     * `@expo/ui/swift-ui` — oboje NATIVNO. Uvoz na vrhu datoteke bi
     * srušio testove ovog modula i pao na Androidu, gdje ovog widgeta
     * nema.
     */
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BurinWidget } = require("./BurinWidget") as {
      BurinWidget: { updateTimeline: (e: { date: Date; props: WidgetProps }[]) => void };
    };
    BurinWidget.updateTimeline(widgetEntries(bundle, tempUnit, windUnit, Date.now(), iconPath));
  } catch (e) {
    /*
     * Greška se VIŠE NE GUTA TIHO: widget je ukras i ne smije srušiti
     * aplikaciju, ali kad ne radi mora se vidjeti ZAŠTO. Tiho gutanje je
     * upravo ono zbog čega se "undefined" na pločici tražilo naslijepo.
     */
    console.warn("[burin] widget nije osvježen:", e);
  }
}
