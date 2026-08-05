import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

/**
 * Plava podloga za sloj vjetra, izvedena iz CARTO Positron GL stila.
 *
 * Zašto vlastiti stil: bijele/svijetle strujnice na svijetloj podlozi se ne
 * vide, a na dark-matter stilu izgledaju sivo i mrtvo. Referenca
 * (Vrijeme&Radar) koristi ujednačenu plavu plohu s narančastim cestama —
 * strujnice tada imaju maksimalan kontrast, a karta ostaje čitljiva.
 *
 * Stil se ne preuzima kao gotov JSON jer takav CARTO ne nudi; uzima se
 * Positron i preboje mu se plohe. `boundary_country_outline` (sidro za
 * `beforeId`) ostaje na svom mjestu, pa vremenski slojevi i dalje idu ispod
 * imena mjesta.
 */

const MORE = "#5B8CC4";
const KOPNO = "#7BA7D7";
const CESTA = "#F0A868";
const CESTA_RUB = "#D98B4A";

/** Boje ploha po id-u sloja; sve ostalo se preuzima iz Positrona. */
const FILL_OVERRIDES: Record<string, string> = {
  background: KOPNO,
  landcover: KOPNO,
  landuse: KOPNO,
  landuse_residential: KOPNO,
  park_national_park: KOPNO,
  park_nature_reserve: KOPNO,
  water: MORE,
  water_shadow: MORE,
};

/**
 * Gradi plavi stil iz preuzetog Positrona. Izvezeno radi testova.
 */
export function buildWindStyle(base: StyleSpecification): StyleSpecification {
  const layers = base.layers.map((layer) => {
    const paint: Record<string, unknown> = { ...(layer.paint ?? {}) };

    if (layer.type === "background" && FILL_OVERRIDES[layer.id]) {
      paint["background-color"] = FILL_OVERRIDES[layer.id];
      paint["background-opacity"] = 1;
    }

    if (layer.type === "fill" && FILL_OVERRIDES[layer.id]) {
      paint["fill-color"] = FILL_OVERRIDES[layer.id];
      // Positron mnoge plohe crta poluprozirno; ovdje smiju biti pune.
      paint["fill-opacity"] = 1;
    }

    // Ceste u narančasto — jedini topli element, kao u referenci.
    if (layer.type === "line" && layer.id.startsWith("road_")) {
      paint["line-color"] = layer.id.includes("_case") ? CESTA_RUB : CESTA;
    }

    // Granice i obale: tanke tamne crte da se otoci razaznaju od mora.
    if (layer.type === "line" && layer.id.startsWith("boundary_")) {
      paint["line-color"] = "rgba(20,40,70,0.55)";
    }

    // Imena mjesta: bijela s tamnim obrubom — čitljiva na plavom.
    if (layer.type === "symbol") {
      paint["text-color"] = "#FFFFFF";
      paint["text-halo-color"] = "rgba(20,40,70,0.75)";
      paint["text-halo-width"] = 1.2;
    }

    return { ...layer, paint } as (typeof base.layers)[number];
  });

  return { ...base, layers };
}

const POSITRON_URL = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

let cached: StyleSpecification | null = null;

/**
 * Dohvaća i preboji Positron. Rezultat se pamti u memoriji — stil se ne
 * mijenja kroz sesiju, a prebacivanje čipa ga ne smije svaki put povlačiti.
 */
export async function fetchWindStyle(): Promise<StyleSpecification> {
  if (cached) return cached;
  const res = await fetch(POSITRON_URL);
  if (!res.ok) throw new Error(`Stil karte: HTTP ${res.status}`);
  cached = buildWindStyle((await res.json()) as StyleSpecification);
  return cached;
}
