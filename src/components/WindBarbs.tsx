import type { DataDrivenPropertyValueSpecification } from "@maplibre/maplibre-gl-style-spec";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useState } from "react";

import { MAP_LABELS_LAYER_ID } from "@/api/mapLayers";
import { type Bounds, type WindGridPoint, windFeatures } from "@/api/windGrid";

/**
 * Sloj vjetra — kratke crtice koje **klize u smjeru strujanja**.
 *
 * Kako: geometrija su kratke putanje kroz polje vjetra (`windFeatures`), a
 * crta se isprekidano (`line-dasharray`). Pomicanjem uzorka crtica kroz
 * kadrove crtice putuju duž putanje — isti dojam kao na Vrijeme&Radaru, bez
 * ijedne dodatne točke podataka.
 *
 * Zašto dasharray, a ne pomicanje geometrije: geometrija bi se morala slati
 * nativnom sloju 8 puta u sekundi (stotine linija), dok je `line-dasharray`
 * obična promjena stila koju GL primjenjuje odmah.
 */

/** Bijelo za slab vjetar, prema mint i žuto za olujni — kao legenda. */
const SPEED_COLOR: DataDrivenPropertyValueSpecification<string> = [
  "interpolate",
  ["linear"],
  ["get", "speed"],
  0,
  "rgba(255,255,255,0.85)",
  25,
  "#B9F2E2",
  45,
  "#2EE6A8",
  70,
  "#F5E12E",
];

/** Jači vjetar = deblja crtica; raste sa zoomom da ostane vidljiva. */
const SPEED_WIDTH: DataDrivenPropertyValueSpecification<number> = [
  "interpolate",
  ["linear"],
  ["zoom"],
  5,
  ["interpolate", ["linear"], ["get", "speed"], 0, 0.8, 70, 1.8],
  10,
  ["interpolate", ["linear"], ["get", "speed"], 0, 1.6, 70, 3.6],
];

/**
 * Kadrovi animacije. Uzorak je uvijek isti par (crtica 1.2, razmak 3.0), a
 * pomak se dobiva PRAZNIM vodećim segmentom koji raste kroz kadrove: dio
 * crtice se "pojede" s početka pa cijeli niz izgleda kao da klizi naprijed.
 *
 * Ukupna duljina ciklusa mora biti ista u SVAKOM kadru (ovdje 4.2), inače
 * crtice mijenjaju razmak i animacija pulsira umjesto da teče. Zadnji kadar
 * se poklapa s prvim, pa je petlja neprimjetna.
 */
const DASH_CRTICA = 1.2;
const DASH_RAZMAK = 3.0;
const DASH_CIKLUS = DASH_CRTICA + DASH_RAZMAK;
/** Koliko kadrova čini jedan puni pomak — više je glađe, ali skuplje. */
const DASH_KADROVA = 6;

/**
 * Uzorak za jedan kadar: `[prazno, crtica, ostatak]`. Vodeći prazni
 * segment raste kroz kadrove pa niz izgleda kao da klizi naprijed.
 * Svi članovi su ≥ 0 i zbroj je uvijek `DASH_CIKLUS` — negativna duljina
 * ili promjenjiv zbroj bi natjerali crtice da pulsiraju.
 */
function dashFrame(index: number): number[] {
  const pomak = (index / DASH_KADROVA) * DASH_CIKLUS;
  if (pomak <= 0) return [DASH_CRTICA, DASH_RAZMAK];

  // Crtica koja bi "iscurila" s početka vraća se na kraj ciklusa.
  const vidljivo = Math.min(DASH_CRTICA, Math.max(0, DASH_CIKLUS - pomak));
  const rep = DASH_CRTICA - vidljivo;
  const razmak = DASH_CIKLUS - pomak - vidljivo;
  return razmak >= 0
    ? [0, pomak, vidljivo, razmak]
    : // Pomak je prešao ciklus: crtica je opet na početku.
      [rep, DASH_CIKLUS - rep];
}

const DASH_FRAMES: number[][] = Array.from({ length: DASH_KADROVA }, (_, i) =>
  dashFrame(i),
);

/**
 * Kadrovi REPA: isti ciklus i isti pomak kao glava, ali kraća crtica koja
 * zaostaje za njom.
 *
 * `TAIL_LAG` je koliko rep kasni; time se rep nalazi IZA glave i zajedno
 * čine jedan potez koji se prema naprijed puni. Zbroj svakog kadra mora
 * ostati `DASH_CIKLUS` — inače rep i glava putuju različitim brzinama i
 * razilaze se.
 */
const TAIL_LAG = 0.55;

function tailFrame(index: number): number[] {
  const pomak = ((index / DASH_KADROVA) * DASH_CIKLUS + TAIL_LAG) % DASH_CIKLUS;
  const vidljivo = Math.min(TAIL_CRTICA, Math.max(0, DASH_CIKLUS - pomak));
  const rep = TAIL_CRTICA - vidljivo;
  const razmak = DASH_CIKLUS - pomak - vidljivo;
  return razmak >= 0
    ? [0, pomak, vidljivo, razmak]
    : [rep, DASH_CIKLUS - rep];
}

const TAIL_FRAMES: number[][] = Array.from({ length: DASH_KADROVA }, (_, i) =>
  tailFrame(i),
);

/** Rep je upola tanji od glave — potez se time sužava prema natrag. */
const TAIL_WIDTH: DataDrivenPropertyValueSpecification<number> = [
  "interpolate",
  ["linear"],
  ["zoom"],
  5,
  ["interpolate", ["linear"], ["get", "speed"], 0, 0.4, 70, 0.9],
  10,
  ["interpolate", ["linear"], ["get", "speed"], 0, 0.8, 70, 1.8],
];

/** Brzina animacije. 130 ms je izmjereno kao "teče", a ne "trza". */
const FRAME_MS = 130;

/**
 * REP CRTICE — odatle se čita SMJER (Markov zahtjev 8.8.2026.).
 *
 * Crtica jednake debljine se čita u oba smjera: vidi se KUDA teče zrak,
 * ali ne i NA KOJU STRANU. Referenca to rješava potezom koji je straga
 * tanak, a prema naprijed pun.
 *
 * Dva pokušaja koja su ODBAČENA jer bi se tiho ne nacrtala:
 *
 *  1. `symbol` sloj s vrškom „▶" duž crte. CARTO poslužuje glifove samo
 *     za osnovni ASCII — raspon 9472–9727 se preuzme, ali je PRAZAN (u
 *     fontu nema ni U+25B6 ni „→"). Provjereno dekodiranjem `.pbf`-a.
 *  2. `line-gradient` (prozirno straga → puno sprijeda). Specifikacija
 *     ga IZRIČITO zabranjuje uz crtice: `"requires": [{"!":
 *     "line-dasharray"}]`. Zajedno bi gradijent jednostavno otpao.
 *
 * Radi zato DRUGI SLOJ crtica ispod glavnog: isti ciklus i isti pomak,
 * ali kraća crtica koja stoji IZA glave i tanja je. Oko time vidi potez
 * koji se prema naprijed puni — bez ijednog dodatnog znaka i bez sukoba
 * sa specifikacijom.
 */
const TAIL_CRTICA = 0.55;

export function WindBarbs({
  grid,
  timeIso,
  bounds,
  animate = true,
}: {
  grid: WindGridPoint[];
  timeIso?: string;
  /** Kadar karte — duljina strujnica prati razinu približavanja. */
  bounds?: Bounds | null;
  /** Isključuje kretanje (npr. za statične preglede). */
  animate?: boolean;
}) {
  const features = useMemo(
    () => (timeIso ? windFeatures(grid, timeIso, bounds ?? undefined) : null),
    [grid, timeIso, bounds],
  );

  const [frame, setFrame] = useState(0);
  const hasFeatures = (features?.features.length ?? 0) > 0;

  useEffect(() => {
    if (!animate || !hasFeatures) return;
    const timer = setInterval(
      () => setFrame((f) => (f + 1) % DASH_FRAMES.length),
      FRAME_MS,
    );
    return () => clearInterval(timer);
  }, [animate, hasFeatures]);

  if (!features || !hasFeatures) return null;

  return (
    <GeoJSONSource id="wind-grid" data={features}>
      {/*
        REP ide PRVI, dakle ispod glave: tanji je i blijedi, pa se čita
        kao mjesto s kojeg je potez došao. Zajedno s glavom daje crticu
        koja se prema naprijed puni — odatle se vidi SMJER (vidi
        `TAIL_CRTICA`).
      */}
      <Layer
        type="line"
        id="wind-grid-tails"
        beforeId={MAP_LABELS_LAYER_ID}
        layout={{ "line-cap": "round" }}
        paint={{
          "line-color": SPEED_COLOR,
          // Upola tanji od glave — potez se time sužava prema natrag.
          "line-width": TAIL_WIDTH,
          "line-opacity": 0.5,
          "line-dasharray": TAIL_FRAMES[frame]!,
        }}
      />
      <Layer
        type="line"
        id="wind-grid-lines"
        beforeId={MAP_LABELS_LAYER_ID}
        layout={{ "line-cap": "round" }}
        paint={{
          "line-color": SPEED_COLOR,
          "line-width": SPEED_WIDTH,
          "line-opacity": 0.95,
          "line-dasharray": DASH_FRAMES[frame]!,
        }}
      />
    </GeoJSONSource>
  );
}
