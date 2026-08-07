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

/**
 * BIJELO → JANTARNO, BEZ ZELENE (Markov ispravak 8.8.2026.).
 *
 * Prije je skala išla kroz mint i jarko zelenu (#2EE6A8). Na plavoj
 * podlozi sloja vjetra zelena se čitala kao vlastita informacija —
 * podsjećala je na oborinu ili vegetaciju — umjesto kao "jače puše".
 *
 * Sada je to jedna svjetlosna skala: bijela za slab vjetar, preko
 * blijedožute do jantarne za olujni. Boja time raste u JEDNOM smjeru
 * (toplije = jače) i ne uvodi drugi ton koji se natječe s podlogom.
 */
const SPEED_COLOR: DataDrivenPropertyValueSpecification<string> = [
  "interpolate",
  ["linear"],
  ["get", "speed"],
  0,
  "rgba(255,255,255,0.85)",
  25,
  "rgba(255,255,255,0.95)",
  45,
  "#FFE9A8",
  70,
  "#FFC24D",
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

/** Brzina animacije. 130 ms je izmjereno kao "teče", a ne "trza". */
const FRAME_MS = 130;

/**
 * SMJER STRUJNICA — TRI ODBAČENA POKUŠAJA (8.8.2026.).
 *
 * Crtica jednake debljine se čita u oba smjera: vidi se KUDA teče zrak,
 * ali ne i NA KOJU STRANU. Traženo je da se, kao na referenci, potez
 * prema naprijed puni. Nijedno od ovoga ne radi:
 *
 *  1. `symbol` sloj s vrškom „▶" duž crte — CARTO poslužuje glifove samo
 *     za osnovni ASCII. Raspon 9472–9727 se preuzme, ali je PRAZAN
 *     (dekodiran `.pbf`: nema ni U+25B6 ni „→"). Vršak se ne bi nacrtao.
 *  2. `line-gradient` (prozirno straga → puno sprijeda) — specifikacija
 *     ga IZRIČITO zabranjuje uz crtice: `"requires": [{"!":
 *     "line-dasharray"}]`. Gradijent bi tiho otpao.
 *  3. DRUGI sloj crtica (kraći i tanji rep ispod glave) — izgledao je
 *     ispravno u kodu i prošao typecheck, ali je NA UREĐAJU srušio
 *     ekran karte (`WindBarbs` → `Layer`). Dva `line-dasharray` sloja
 *     nad istim `GeoJSONSource`, oba mijenjana svakih 130 ms, nativni
 *     sloj ne podnosi.
 *
 * Zato sloj OSTAJE na jednoj crti bez oznake smjera. Smjer se za sada
 * čita iz kretanja crtica; prava strelica traži vlastitu sličicu
 * registriranu u stilu karte (`Image` + `icon-image`), što je zaseban
 * zahvat jer se stil gradi u letu (`buildWindStyle`).
 */

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
