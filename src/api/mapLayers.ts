import { t } from "@/i18n";

import { hasOwmKey, owmTileUrl } from "./owm";
import type { RadarFrame } from "./types";

/**
 * Bazna podloga karte: CARTO vektorski GL stil (MapLibre). Bez ključa,
 * identičan izgled na iOS-u i Androidu, imena gradova iz samog stila.
 *
 * Izmjereno 5.8.2026.: oba stila 200 bez ključa (voyager 107 kB, dark 70 kB),
 * po 93 sloja, glyphs i sprite uključeni.
 *
 * Voyager: mekano zeleno kopno, plavo more — najbliže referenci
 * (Vrijeme&Radar). Zamjena stila je jedan red.
 */
export const MAP_BASE_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

/**
 * Tamni stil. Naoblaka i vjetar su u izvoru gotovo bijeli/blijedi
 * (izmjereno: maks. alfa 12–60 od 255), pa se na svijetloj podlozi ne vide.
 * Na tamnoj imaju kontrast.
 */
export const MAP_BASE_STYLE_URL_DARK =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export const MAP_BASE_ATTRIBUTION = {
  label: "© OpenStreetMap, © CARTO",
  url: "https://carto.com/attributions",
};

/**
 * Sloj stila ISPRED kojeg se umeću vremenske pločice (`beforeId`). Time boje
 * završe IZNAD terena i cesta, a ISPOD granica država i svih imena — imena
 * gradova ostaju čitljiva preko radara/temperature, kao u referenci.
 *
 * Izmjereno 5.8.2026.: `boundary_country_outline` postoji u OBA stila i u
 * oba je prvi sloj bloka granice+imena (voyager idx 65/93, dark 64/93).
 */
export const MAP_LABELS_LAYER_ID = "boundary_country_outline";

/**
 * Granice zooma kamere — GLOBALNE, ne po sloju. MapLibre pločice iznad
 * `maxNativeZ` sam rasteže i nikad ne traži nepostojeću razinu, pa razlog
 * za tvrdu granicu po sloju ("zoom level not supported") više ne postoji.
 * 12 je granica smisla: vremenski podaci su grublji od pločice već na 8.
 */
export const MAP_MIN_ZOOM = 4;
export const MAP_MAX_ZOOM = 12;

export type MapLayerId = "radar" | "temp_new" | "clouds_new" | "wind_new";

/** Odakle vremenska crta uzima korake za ovaj sloj. */
export type TimelineKind = "frames" | "hours";

/**
 * Kako se sloj crta: `raster` su pločice iz vanjskog izvora, `barbs` je
 * vlastiti symbol sloj crtica iz Open-Meteo mreže (vidi `windGrid.ts`).
 */
export type RenderKind = "raster" | "barbs";

export type MapLayer = {
  id: MapLayerId;
  label: string;
  /** Traži EXPO_PUBLIC_OWM_API_KEY; bez njega je čip onemogućen. */
  needsKey: boolean;
  render: RenderKind;
  opacity: number;
  /**
   * Pojačanje boje pločice, −1…1 (`raster-saturation` / `raster-contrast`).
   *
   * Zašto uopće: OWM pločice su poluprozirne U IZVORU — izmjereno 5.8.2026.
   * dekodiranjem piksela da `temp_new` ima alfu 76/255 na SVAKOM pikselu,
   * dakle najjača boja je na 30 % vidljivosti. `raster-opacity` to ne može
   * popraviti (1.0 je maksimum), pa boja izlazi isprano u odnosu na
   * referencu. Zasićenje i kontrast vraćaju snagu boje bez diranja alfe.
   */
  saturation?: number;
  contrast?: number;
  /**
   * Najviša razina na kojoj izvor IMA podatke (`maxzoom` na RasterSource).
   * Iznad nje MapLibre glatko rasteže roditeljsku pločicu — sloj nikad ne
   * nestaje i nikad se ne traži nepostojeća pločica.
   */
  maxNativeZ: number;
  attribution: { label: string; url: string };
  timeline: TimelineKind;
};

/**
 * Svi slojevi karte na jednom mjestu. Dodavanje sloja = jedan unos ovdje
 * (+ string u i18n); ekran karte i vremenska crta se ne diraju.
 *
 * Redoslijed je redoslijed čipova: Radar prvi jer je jedini bez ključa.
 */
export const MAP_LAYERS: MapLayer[] = [
  {
    id: "radar",
    label: t.map.layerRadar,
    needsKey: false,
    render: "raster",
    opacity: 0.7,
    /*
     * 7, NE 8. Izmjereno 5.8.2026. dekodiranjem pločica: RainViewer od z=8
     * naviše vraća HTTP 200 i bajt-identičnu sliku (1370 B, md5 2cc6649e) na
     * SVIM koordinatama — a ta slika je siva pločica s natpisom "Zoom Level
     * Not Supported". Ranije je ta identičnost protumačena kao "nema novih
     * podataka" i `maxNativeZ` je bio 8, pa je karta zumiranjem dohvaćala
     * upravo natpis. Stvarni podaci idu do z=7 (provjereno na Zadru,
     * Zagrebu, Osijeku i Splitu).
     *
     * Iznad 7 MapLibre rasteže pločicu sa z=7 — radar ostaje na ekranu.
     */
    maxNativeZ: 7,
    attribution: { label: t.map.radarAttribution, url: "https://www.rainviewer.com" },
    timeline: "frames",
  },
  /*
   * PROZIRNOST: OWM pločice su već poluprozirne u samom izvoru — izmjereno
   * 5.8.2026. dekodiranjem piksela (Zadar, z=8): temp_new maks. alfa 76/255,
   * wind_new 45/255, clouds_new samo 12/255. Dodatno množenje `opacity`
   * ispod 1 ih je gasilo: naoblaka je izlazila na ~4 % stvarne vidljivosti,
   * pa su "vjetar i naoblaka" izgledali kao da ne rade. Zato 1.0 — izvor
   * sam nosi svoju prozirnost i podloga ostaje čitljiva.
   *
   * ZOOM: clouds_new na z=10 vraća PNG s NULA obojenih piksela. Zato se
   * pločica vuče s niže razine i rasteže, čime sloj uopće ima površinu.
   */
  {
    id: "temp_new",
    label: t.map.layerTemperature,
    needsKey: true,
    render: "raster",
    opacity: 1,
    // Izvor je na alfi 76/255 (30 %) — bez ovoga je karta blijeda u odnosu
    // na referencu (Vrijeme&Radar). Zasićenje vraća boju, kontrast razdvaja
    // susjedne razrede temperature.
    saturation: 0.55,
    contrast: 0.25,
    maxNativeZ: 12,
    attribution: { label: t.map.owmAttribution, url: "https://openweathermap.org" },
    timeline: "hours",
  },
  {
    id: "clouds_new",
    label: t.map.layerClouds,
    needsKey: true,
    render: "raster",
    opacity: 1,
    // Najslabiji izvor od svih (alfa 12/255 ≈ 5 %) — traži najviše kontrasta
    // da se naoblaka uopće razazna kao površina, a ne kao izmaglica.
    contrast: 0.4,
    // Iznad 6 se gubi (z=10 je prazan), pa se rasteže s niže razine.
    maxNativeZ: 6,
    attribution: { label: t.map.owmAttribution, url: "https://openweathermap.org" },
    timeline: "hours",
  },
  {
    id: "wind_new",
    label: t.map.layerWind,
    /*
     * VLASTITI SLOJ, ne OWM pločica. Besplatni OWM `wind_new` je POLJE BOJA
     * (izmjereno 5.8.2026.) i izgleda gotovo isto kao naoblaka — bez smjera,
     * bez strujanja; strelice postoje samo u Maps 2.0 sloju `WND`, koji na
     * besplatnom ključu vraća 401.
     *
     * Zato se vjetar crta iz Open-Meteo mreže točaka (`windGrid.ts`) kao
     * symbol sloj koničnih crtica. Ne treba ključ, a MapLibre stotine
     * rotiranih ikona crta na GPU-u bez troška — s `react-native-maps`
     * markerima to nije bilo izvedivo.
     */
    needsKey: false,
    render: "barbs",
    opacity: 1,
    // Crtice su vektorske — nema pločice pa ni granice rastezanja.
    maxNativeZ: MAP_MAX_ZOOM,
    attribution: { label: t.map.omAttribution, url: "https://open-meteo.com" },
    timeline: "hours",
  },
];

export function mapLayerById(id: MapLayerId): MapLayer {
  return MAP_LAYERS.find((l) => l.id === id) ?? MAP_LAYERS[0]!;
}

/**
 * GL stil podloge za dani sloj. Naoblaka je u izvoru bijela pa se na
 * svijetloj podlozi ne razaznaje — jedina traži tamni stil. Vjetar je od
 * prelaska na vlastite crtice sam sebi kontrast (crtice se boje po brzini),
 * pa ostaje na svijetloj podlozi gdje su imena mjesta čitljivija.
 */
export function baseStyleFor(layer: MapLayer): string {
  return layer.id === "clouds_new" ? MAP_BASE_STYLE_URL_DARK : MAP_BASE_STYLE_URL;
}

/** Je li sloj upotrebljiv u ovoj instalaciji (OWM slojevi traže ključ). */
export function isLayerAvailable(layer: MapLayer): boolean {
  return !layer.needsKey || hasOwmKey();
}

/**
 * URL predložak pločica za sloj.
 *
 * Radar traži aktivni okvir — bez njega vraća null i sloj se ne renderira
 * (a crta ostaje vidljiva). OWM slojevi primaju `atUnix` s vremenske crte,
 * pa se pločica mijenja kad se kliže po satima.
 */
export function mapLayerTileUrl(
  layer: MapLayer,
  radar?: { host: string; frame: RadarFrame },
  atUnix?: number,
): string | null {
  // Vjetar je symbol sloj iz Open-Meteo mreže — nema pločicu.
  if (layer.render !== "raster") return null;

  if (layer.id === "radar") {
    if (!radar) return null;
    // Shema boja 4 + gladak prijelaz (1_1) — gradijent, ne pikseli.
    return `${radar.host}${radar.frame.path}/256/{z}/{x}/{y}/4/1_1.png`;
  }
  return owmTileUrl(layer.id, atUnix);
}
