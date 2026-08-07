import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import type { WeatherBundle } from "@/api/types";
import type { TempUnit, WindUnit } from "@/utils/format";

import { widgetEntries } from "../widgetData";
import { AndroidMedium, AndroidSmall } from "./BurinAndroidWidget";

/**
 * ANDROID WIDGET — obrada zahtjeva sustava (7.8.2026.).
 *
 * Ovo se izvršava BEZ APLIKACIJE, u headless JS zadatku koji Android
 * pokrene po svom rasporedu. Zato ovdje NEMA hookova, storea ni React
 * konteksta — sve se čita izravno iz AsyncStoragea.
 *
 * To je i glavna razlika od iOS-a: ondje widget ne može pokrenuti naš JS,
 * pa mu aplikacija unaprijed gura gotove podatke (`updateTimeline`).
 * Ovdje se podaci čitaju u trenutku crtanja, pa su uvijek svježi koliko
 * je svjež zadnji dohvat.
 */

/** Zustandov `persist` omata stanje u `{ state, version }`. */
type Persisted<T> = { state: T; version?: number };

/**
 * Zadnji poznati paket za trenutno odabrano mjesto.
 *
 * Vraća `null` kad još ništa nije spremljeno (svježa instalacija) — tada
 * se widget ne crta i Android ostavi ono što je već na zaslonu.
 */
async function readBundle(): Promise<WeatherBundle | null> {
  try {
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
async function readUnits(): Promise<{ tempUnit: TempUnit; windUnit: WindUnit }> {
  try {
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

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const name = props.widgetInfo.widgetName;
  const width = props.widgetInfo.width || DEFAULT_WIDTH[name] || 158;

  // Brisanje ne treba crtež.
  if (props.widgetAction === "WIDGET_DELETED") return;

  const bundle = await readBundle();
  if (!bundle) return;

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
  if (!entry) return;

  const withIcons = {
    ...entry.props,
    icon: ANDROID_ICONS[entry.props.ambient] ?? null,
    windIcon: entry.props.gusts !== null ? WIND_ICON : null,
    // `readableOn` uvijek vraća #141414 ili #FFFFFF — oboje je hex oblik
    // koji knjižnica traži, ali TS to iz `string` ne može zaključiti.
    fg: entry.props.fg as `#${string}`,
  };

  props.renderWidget(
    name === "BurinMedium" ? (
      <AndroidMedium props={withIcons} width={width} />
    ) : (
      <AndroidSmall props={withIcons} width={width} />
    ),
  );
}

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
