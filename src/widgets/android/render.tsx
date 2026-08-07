import type { WeatherBundle } from "@/api/types";
import type { TempUnit, WindUnit } from "@/utils/format";

import { widgetEntries } from "../widgetData";
import { AndroidMedium, AndroidSmall } from "./BurinAndroidWidget";

/**
 * CRTANJE ANDROID WIDGETA — jedno mjesto za oba pozivatelja (8.8.2026.).
 *
 * Postoji jer widget sada stiže s DVIJE strane:
 *  - `widgetTaskHandler` — kad ga Android probudi sam (svakih 30 min,
 *    pri dodavanju na zaslon, nakon restarta)
 *  - `pushWidget` → `requestWidgetUpdate` — kad aplikacija dohvati novo
 *    vrijeme ili korisnik promijeni grad
 *
 * Dok je crtež živio samo u handleru, drugi put ga nije imao odakle
 * pozvati, pa je widget na promjenu grada ostajao na starom mjestu do
 * sljedećeg buđenja. Sad oba puta prolaze kroz istu funkciju, pa se
 * izgled ne može razići.
 *
 * Čitanje podataka je namjerno OVDJE, a ne u pozivatelju: `requestWidgetUpdate`
 * poziva `renderWidget` za SVAKU instancu na zaslonu, pa bi prosljeđivanje
 * paketa značilo da ga netko mora pročitati prije i držati. Ovako je
 * jedini ulaz `widgetInfo`, a podaci su uvijek oni s diska — isti izvor
 * koji vidi i headless zadatak kad aplikacija ne radi.
 */

/** Zustandov `persist` omata stanje u `{ state, version }`. */
type Persisted<T> = { state: T; version?: number };

/**
 * Zadnji poznati paket za trenutno odabrano mjesto.
 *
 * Vraća `null` kad još ništa nije spremljeno (svježa instalacija) — tada
 * se widget ne crta i Android ostavi ono što je već na zaslonu.
 */
export async function readBundle(): Promise<WeatherBundle | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require("@react-native-async-storage/async-storage")
      .default as typeof import("@react-native-async-storage/async-storage").default;

    const [rawWeather, rawCities] = await Promise.all([
      AsyncStorage.getItem("burin:last-weather"),
      AsyncStorage.getItem("burin:cities"),
    ]);
    if (!rawWeather) return null;

    const weather = JSON.parse(rawWeather) as Persisted<{
      byPlaceId: Record<string, WeatherBundle>;
    }>;
    const byId = weather.state?.byPlaceId ?? {};

    /*
     * Mjesto se bira kao u aplikaciji: prvo odabrano, pa prvo spremljeno.
     * Kad ni jedno nije poznato, uzima se bilo koje iz keša — bolje
     * pokazati neko vrijeme nego prazan widget.
     */
    let id: string | undefined;
    if (rawCities) {
      const cities = JSON.parse(rawCities) as Persisted<{
        selected: { id: string } | null;
        saved: { id: string }[];
      }>;
      id = cities.state?.selected?.id ?? cities.state?.saved?.[0]?.id;
    }

    const chosen = (id && byId[id]) || Object.values(byId)[0];
    return chosen ?? null;
  } catch {
    // Neispravan JSON ili nedostupan disk — widget se ne mijenja.
    return null;
  }
}

/** Jedinice iz postavki; zadane su °C i m/s, kao u aplikaciji. */
export async function readUnits(): Promise<{ tempUnit: TempUnit; windUnit: WindUnit }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require("@react-native-async-storage/async-storage")
      .default as typeof import("@react-native-async-storage/async-storage").default;

    const raw = await AsyncStorage.getItem("burin:settings");
    if (!raw) return { tempUnit: "C", windUnit: "ms" };
    const s = JSON.parse(raw) as Persisted<{ tempUnit?: TempUnit; windUnit?: WindUnit }>;
    return {
      tempUnit: s.state?.tempUnit ?? "C",
      windUnit: s.state?.windUnit ?? "ms",
    };
  } catch {
    return { tempUnit: "C", windUnit: "ms" };
  }
}

/**
 * Širina po imenu widgeta. Android daje stvarne dimenzije u
 * `widgetInfo`, ali one dolaze u dp i mijenjaju se s launcherom — ove
 * vrijednosti su početne, a `width` iz `widgetInfo` ih gazi kad postoji.
 */
const DEFAULT_WIDTH: Record<string, number> = {
  BurinSmall: 158,
  BurinMedium: 338,
};

/*
 * Ikone kao `require` — Metro ih tako pakira i `ImageWidget` ih prima
 * izravno. Ključ je AMBIJENT, ne ime ikone: ambijent je već izračunat u
 * `widgetEntries`, pa se ne mora drugi put mapirati WMO kod.
 */
const ANDROID_ICONS: Record<string, number> = {
  rays: require("../../../assets/widget/sun.png"),
  partly: require("../../../assets/widget/partly.png"),
  clouds: require("../../../assets/widget/cloud.png"),
  rain: require("../../../assets/widget/rain.png"),
  snow: require("../../../assets/widget/snow.png"),
  stars: require("../../../assets/widget/night.png"),
};

const WIND_ICON = require("../../../assets/widget/wind.png");

/**
 * Widget za zadanu instancu, ili `null` kad podataka još nema.
 *
 * `null` znači "ne crtaj" — pozivatelj tada ne dira zaslon, pa Android
 * ostavi zadnji poznati izgled umjesto da ga zamijeni praznom pločicom.
 */
export async function renderAndroidWidget(info: {
  widgetName: string;
  width?: number;
}): Promise<React.JSX.Element | null> {
  const name = info.widgetName;
  const width = info.width || DEFAULT_WIDTH[name] || 158;

  const bundle = await readBundle();
  if (!bundle) return null;

  const { tempUnit, windUnit } = await readUnits();

  /*
   * `widgetEntries` je ISTA funkcija koju koristi iOS — dijeljeni izvor
   * istine za boje, jedinice i pragove. Ovdje treba samo PRVI unos:
   * Android widget se crta u trenutku, pa mu vremenska crta ne treba.
   *
   * Ikone se ne prosljeđuju (`undefined` → prazne putanje): na Androidu
   * se učitavaju izravno iz paketa aplikacije preko `require`, jer
   * headless zadatak vidi assete kao i ostatak JS-a.
   */
  const [entry] = widgetEntries(bundle, tempUnit, windUnit, Date.now());
  if (!entry) return null;

  const withIcons = {
    ...entry.props,
    icon: ANDROID_ICONS[entry.props.ambient] ?? null,
    windIcon: entry.props.hasGusts ? WIND_ICON : null,
    // `readableOn` uvijek vraća #141414 ili #FFFFFF — oboje je hex oblik
    // koji knjižnica traži, ali TS to iz `string` ne može zaključiti.
    fg: entry.props.fg as `#${string}`,
  };

  return name === "BurinMedium" ? (
    <AndroidMedium props={withIcons} width={width} />
  ) : (
    <AndroidSmall props={withIcons} width={width} />
  );
}
