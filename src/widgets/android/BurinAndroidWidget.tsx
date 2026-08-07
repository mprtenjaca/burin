import type { ImageRequireSource } from "react-native";
import { FlexWidget, ImageWidget, OverlapWidget, SvgWidget, TextWidget } from "react-native-android-widget";

import type { WidgetProps } from "../props";

/**
 * Propovi za Android — isti podaci, dvije razlike u TIPOVIMA.
 *
 * `icon`/`windIcon` su ovdje `require`-ovi (brojevi), ne putanje: Android
 * headless zadatak vidi assete kao i ostatak JS-a, pa ih učitava izravno
 * iz paketa. iOS mora ići preko App Groupa, gdje su to putanje do
 * datoteka — otud različit tip za istu stvar.
 *
 * `fg` je sužen na hex oblik jer knjižnica traži `ColorProp`
 * (`#rrggbb`), a ne bilo koji string.
 */
type AndroidProps = Omit<WidgetProps, "icon" | "windIcon" | "fg"> & {
  icon: ImageRequireSource | null;
  windIcon: ImageRequireSource | null;
  fg: `#${string}`;
};

/**
 * ANDROID WIDGET (7.8.2026.) — parnjak `BurinWidget.tsx` za iOS.
 *
 * Isti podaci (`WidgetProps`), isti izgled, druga knjižnica: Android ide
 * kroz `react-native-android-widget`, jer `expo-widgets` na Androidu ima
 * samo KOSTUR — njegov `ExpoWidgetsGlanceWidget.kt` crta doslovno
 * `Text(widgetName)` i ništa više (provjereno u izvoru 7.8.2026.).
 *
 * Dvije razlike u odnosu na iOS, obje u NAŠU korist:
 *  - `SvgWidget` prima SVG kao string, pa se gradijent i ambijent crtaju
 *    kao prava grafika umjesto slaganja od pravokutnika
 *  - handler se izvršava u JS-u, pa čita AsyncStorage izravno — nema App
 *    Groupa ni kopiranja ikona
 */

/** Visina pločice u dp; Android je ne fiksira kao iOS, ali crtež treba broj. */
const H = 158;

/**
 * Gradijent + ambijent kao JEDAN SVG.
 *
 * `backgroundGradient` u knjižnici prima samo DVIJE boje (`from`/`to`), a
 * naša paleta ima tri stopa — pa bi srednji otpao i prijelaz bi izgubio
 * karakter. SVG nema to ograničenje.
 *
 * Ambijent se crta u istom SVG-u, ne kao zaseban sloj: tako se kose crte
 * mogu obrezati `clipPath`-om na oblik pločice, bez dodatnog spremnika.
 */
function backdropSvg(props: AndroidProps, width: number): string {
  const [a, b, c] = props.stops;
  const amb = ambientSvg(props.ambient, width);
  return `<svg width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="${a}"/>
      <stop offset="0.4" stop-color="${b}"/>
      <stop offset="0.7" stop-color="${c}"/>
      <stop offset="1" stop-color="${c}"/>
    </linearGradient>
    <clipPath id="tile"><rect width="${width}" height="${H}" rx="22"/></clipPath>
  </defs>
  <g clip-path="url(#tile)">
    <rect width="${width}" height="${H}" fill="url(#bg)"/>
    ${amb}
  </g>
</svg>`;
}

/**
 * Ambijentalni sloj — ISTI raspored kao na iOS-u, u SVG obliku.
 *
 * Koordinate su ondje relativne prema SREDIŠTU pločice (`offset`), a
 * ovdje prema gornjem lijevom kutu, pa se pomiču za `cx`/`cy`. Nagib je
 * isti 29° (`SLOPE = 0.55` u aplikaciji), duljina 226 px isto izračunata:
 * 158 / cos(29°) = 181 px plus rezerva.
 */
function ambientSvg(kind: string, width: number): string {
  const cx = width / 2;
  const cy = H / 2;
  const W = "#FFFFFF";

  /** Kosa traka: pravokutnik zarotiran oko vlastitog središta. */
  const streak = (x: number, y: number, len: number, w: number, o: number) =>
    `<rect x="${(cx + x - w / 2).toFixed(1)}" y="${(cy + y - len / 2).toFixed(1)}" width="${w}" height="${len}" fill="${W}" opacity="${o}" transform="rotate(29 ${(cx + x).toFixed(1)} ${(cy + y).toFixed(1)})"/>`;

  /** Točka; `blur` je opcionalan (oblaci, sjaj, pahulje). */
  const dot = (x: number, y: number, r: number, o: number, col = W, blur = 0) =>
    `<circle cx="${(cx + x).toFixed(1)}" cy="${(cy + y).toFixed(1)}" r="${r}" fill="${col}" opacity="${o}"${blur ? ` filter="url(#b${blur})"` : ""}/>`;

  /*
   * Zamućenja se deklariraju unaprijed, jer SVG filter mora postojati
   * prije upotrebe. Koriste se samo one vrijednosti koje slojevi traže.
   */
  const blurs = [9, 10, 11, 12, 13, 16, 20, 26, 34]
    .map((n) => `<filter id="b${n}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n / 2}"/></filter>`)
    .join("");

  const FL = 226;
  let body = "";

  if (kind === "rays") {
    body =
      dot(190, -30, 72, 0.2, W, 34) + dot(168, -24, 40, 0.14, W, 20) +
      streak(74, 0, FL, 11, 0.24) + streak(98, 0, FL, 6, 0.19) +
      streak(118, 0, FL, 9, 0.22) + streak(140, 0, FL, 4, 0.16) +
      streak(156, 0, FL, 3, 0.14);
  } else if (kind === "rain") {
    const kapi: [number, number, number, number, number][] = [
      [8, -34, 30, 2.4, 0.22], [24, 6, 24, 2.2, 0.18], [40, -48, 32, 2.4, 0.23],
      [54, -12, 26, 2.2, 0.19], [70, 26, 22, 2, 0.17], [84, -38, 30, 2.4, 0.23],
      [100, 2, 26, 2.2, 0.19], [116, -24, 28, 2.4, 0.22], [132, 22, 22, 2, 0.17],
      [148, -44, 30, 2.2, 0.21], [164, -8, 24, 2.2, 0.19],
    ];
    body = kapi.map((k) => streak(k[0], k[1], k[2], k[3], k[4])).join("");
  } else if (kind === "stars") {
    const zvijezde: [number, number, number, number][] = [
      [-58, -48, 1.9, 0.28], [-34, -18, 1.3, 0.18], [-8, -54, 1.7, 0.25],
      [16, -30, 1.2, 0.16], [44, -50, 2, 0.28], [64, -22, 1.3, 0.18],
      [-48, 12, 1.2, 0.15], [30, 8, 1.4, 0.17], [96, -44, 1.5, 0.22],
      [126, -16, 1.2, 0.15],
    ];
    body = zvijezde.map((z) => dot(z[0], z[1], z[2], z[3])).join("");
  } else if (kind === "snow") {
    const pahulje: [number, number, number, number][] = [
      [-62, -42, 4, 0.28], [-30, -2, 3.2, 0.22], [-4, -48, 4.4, 0.28],
      [26, 18, 3.4, 0.21], [54, -30, 3.8, 0.26], [20, -16, 2.6, 0.19],
      [-44, 26, 2.8, 0.2], [92, 2, 3.4, 0.23], [124, -36, 3, 0.21],
    ];
    body = pahulje.map((p) => dot(p[0], p[1], p[2], p[3])).join("");
  } else if (kind === "partly") {
    // Oblak desno (bijele mrlje) + sjena ispod njega.
    body =
      dot(104, 2, 38, 0.1, "#000000", 20) +
      dot(96, -18, 30, 0.17, W, 12) + dot(128, -30, 24, 0.16, W, 11) +
      dot(70, -28, 20, 0.14, W, 10) + dot(166, -52, 18, 0.1, W, 9);
  } else if (kind === "clouds") {
    body =
      dot(-70, -40, 28, 0.07, "#000000", 16) + dot(-24, -52, 21, 0.055, "#000000", 12) +
      dot(56, -38, 32, 0.065, "#000000", 16) + dot(116, -48, 23, 0.05, "#000000", 12);
  }

  return body ? `<defs>${blurs}</defs>${body}` : "";
}

/**
 * MALI WIDGET (2×2). Raspored prati iOS: mjesto i ikona gore, velika
 * brojka, opis, pa dnevni raspon.
 *
 * `OverlapWidget` je Androidov `ZStack` — slaže djecu jedno preko drugog,
 * pa podloga ide prva, a sadržaj preko nje.
 */
export function AndroidSmall({ props, width }: { props: AndroidProps; width: number }) {
  return (
    <OverlapWidget style={{ width, height: H }}>
      <SvgWidget svg={backdropSvg(props, width)} style={{ width, height: H }} />
      <FlexWidget
        style={{
          width,
          height: H,
          flexDirection: "column",
          paddingHorizontal: 14,
          paddingVertical: 14,
        }}
      >
        <FlexWidget style={{ flexDirection: "row", width: "match_parent" }}>
          <TextWidget text={props.place} style={{ fontSize: 13, color: props.fg, fontWeight: "600" }} />
          <FlexWidget style={{ flex: 1 }} />
          {props.icon !== null && <ImageWidget image={props.icon} imageWidth={20} imageHeight={20} />}
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />

        <TextWidget
          text={`${props.temp}${props.unit}`}
          style={{ fontSize: 44, color: props.fg, fontWeight: "700" }}
        />
        <TextWidget text={props.condition} style={{ fontSize: 13, color: props.fg, fontWeight: "500" }} />

        <FlexWidget style={{ flex: 1 }} />

        <TextWidget
          text={`${props.tMax}${props.unit} / ${props.tMin}${props.unit}`}
          style={{ fontSize: 12, color: props.fg }}
        />
      </FlexWidget>
    </OverlapWidget>
  );
}

/** SREDNJI WIDGET (4×2) — isto plus udari vjetra i vrijeme dohvata desno. */
export function AndroidMedium({ props, width }: { props: AndroidProps; width: number }) {
  return (
    <OverlapWidget style={{ width, height: H }}>
      <SvgWidget svg={backdropSvg(props, width)} style={{ width, height: H }} />
      <FlexWidget
        style={{
          width,
          height: H,
          flexDirection: "row",
          paddingHorizontal: 14,
          paddingVertical: 14,
        }}
      >
        <FlexWidget style={{ flexDirection: "column", height: "match_parent" }}>
          <FlexWidget style={{ flexDirection: "row" }}>
            {props.icon !== null && <ImageWidget image={props.icon} imageWidth={18} imageHeight={18} />}
            <TextWidget
              text={` ${props.place}`}
              style={{ fontSize: 14, color: props.fg, fontWeight: "600" }}
            />
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />

          <TextWidget
            text={`${props.temp}${props.unit}`}
            style={{ fontSize: 52, color: props.fg, fontWeight: "700" }}
          />
          <TextWidget text={props.condition} style={{ fontSize: 14, color: props.fg, fontWeight: "500" }} />
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />

        <FlexWidget style={{ flexDirection: "column", height: "match_parent", alignItems: "flex-end" }}>
          <TextWidget
            text={`${props.tMax}${props.unit} / ${props.tMin}${props.unit}`}
            style={{ fontSize: 13, color: props.fg }}
          />
          <FlexWidget style={{ flex: 1 }} />
          {props.gusts !== null && (
            <FlexWidget style={{ flexDirection: "row" }}>
              {props.windIcon !== null && <ImageWidget image={props.windIcon} imageWidth={16} imageHeight={16} />}
              <TextWidget
                text={` ${props.gusts} ${props.windUnit}`}
                style={{ fontSize: 15, color: props.fg, fontWeight: "700" }}
              />
            </FlexWidget>
          )}
          <TextWidget text={props.fetchedAt} style={{ fontSize: 11, color: props.fg }} />
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}
