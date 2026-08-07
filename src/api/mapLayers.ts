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
  /**
   * Veličina pločice u pikselima — MORA odgovarati onome što URL traži
   * (8.8.2026.).
   *
   * Radar ide na 512 (RainViewer nudi obje veličine, a veća nosi 3.5×
   * više detalja pri istom zoomu — vidi `mapLayerTileUrl`). OWM slojevi
   * su 256 i druge veličine nemaju.
   *
   * Ako se ova brojka raziđe s URL-om, MapLibre pločicu skalira u krivi
   * okvir: 512 stisnut u 256 izgleda gore nego izvorni 256.
   */
  tileSize: 256 | 512;
  /**
   * Najdublje približavanje DOPUŠTENO na ovom sloju (8.8.2026.).
   *
   * Odvojeno od `maxNativeZ`: ono kaže dokle izvor IMA podatke, ovo dokle
   * korisnik SMIJE ići. Iznad `maxNativeZ` MapLibre rasteže jedan piksel
   * podatka preko sve više ekrana — na z=12 to je 32×32 px po pikselu,
   * odakle one stepenaste kocke na radaru.
   *
   * Radar se zato zaustavlja odmah iznad svoje granice: mrlja ostaje
   * glatka umjesto da se raspadne u kvadrate. Slojevi koji nemaju taj
   * problem (ili nemaju pločicu) idu do `MAP_MAX_ZOOM`.
   */
  maxUserZoom: number;
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
    // Jedini sloj na 512 — RainViewer ih nudi, i nose 3.5× više detalja.
    tileSize: 512,
    /*
     * STAJE NA 9, iako karta ide do 12 (Markov nalaz 8.8.2026.:
     * „radar je izmuljan kad priblizim").
     *
     * Podaci staju na z=7. Svaka razina iznad toga učetverostručuje
     * površinu po jednom pikselu podatka: z=8 → 2×2 px, z=10 → 8×8,
     * **z=12 → 32×32 px**. Odatle stepenaste kocke na snimci — nije
     * greška u glačanju (`1_1` je uključen i provjeren) nego čisto
     * rastezanje.
     *
     * 9 je granica jer pločica od 512 px već nosi jednu razinu viška
     * (512@z7 ima gustoću 256@z8), pa je stvarno rastezanje na z=9
     * samo 2×2 px — još uvijek glatko. Iznad toga se raspada.
     */
    maxUserZoom: 9,
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
    /*
     * POJAČANO NA MAKSIMUM (Markov nalaz 8.8.2026.: „temperaturni layer je
     * blijed").
     *
     * Izmjereno dekodiranjem pločice: alfa je **76/255 (30 %) na SVAKOM
     * pikselu**, dakle 70 % onoga što se vidi dolazi od podloge karte, ne
     * od temperature. To je ograničenje besplatnog OWM izvora — pločica je
     * takva kakva jest, a `raster-opacity` iznad 1.0 ne ide.
     *
     * Provjerene i odbačene ideje:
     *  - TAMNA podloga (kao kod naoblake): kroma ostaje ista (77 → 76),
     *    boja samo potamni umjesto da oživi.
     *  - Još jače zasićenje: iznad ~1.0 se boje počnu lomiti u susjedne
     *    razrede (žuto → zeleno), pa karta laže o temperaturi.
     *
     * 0.9 / 0.45 je najviše što se dobiva bez tih nuspojava. Karta je i
     * dalje blijeda u odnosu na V&R — oni ne koriste besplatni OWM.
     */
    saturation: 0.9,
    contrast: 0.45,
    maxNativeZ: 12,
    tileSize: 256,
    // Podaci sežu do 12, koliko i karta — nema rastezanja ni razloga za rez.
    maxUserZoom: MAP_MAX_ZOOM,
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
    tileSize: 256,
    /*
     * Naoblaka je MEKANA po prirodi (velike plohe bez oštrih rubova), pa
     * rastezanje na njoj ne daje kocke kao na radaru — ali ni tu nema
     * smisla ići do kraja. 9 je isti rez kao na radaru.
     */
    maxUserZoom: 9,
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
    // Nema pločice; vrijednost je ovdje samo da tip ostane potpun.
    tileSize: 256,
    // Crtice su vektorske — ostaju oštre na svakoj razini.
    maxUserZoom: MAP_MAX_ZOOM,
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
    /*
     * PLOČICA OD 512 px, NE 256 (Markov ispravak 8.8.2026.).
     *
     * Na uređaju je oluja pri približavanju bila razmrljana u kvadrate,
     * dok je ista na RainViewerovoj karti ostajala oštra. Uzrok nije
     * `maxNativeZ` (RainViewer stvarno nema podatke iznad z=7 — vidi
     * ispod) nego VELIČINA pločice: tražili smo najmanju.
     *
     * Izmjereno dohvaćanjem iste pločice u obje veličine (z=7, Zadar):
     *   256 px →  6073 B, 3869 neprozirnih piksela
     *   512 px → 17030 B, 13687 neprozirnih piksela
     * Ista paleta (65 boja), 3.5× više pokrivenih piksela — dakle PRAVI
     * detalj, ne naduvana slika. MapLibre time rasteže mnogo bolji
     * izvornik i mrlje ostaju glatke.
     *
     * Zid na z=8 vrijedi i dalje, i na obje veličine: pločice na z=8 i
     * z=9 su BAJT-IDENTIČNE (isti md5), što je onaj natpis „Zoom Level
     * Not Supported". Zato `maxNativeZ` ostaje 7.
     *
     * Uz ovo `tileSize` na `RasterSource` mora biti 512 — inače bi
     * MapLibre pločicu od 512 px stisnuo u okvir od 256 i pogoršao
     * stvar umjesto da je popravi.
     */
    return `${radar.host}${radar.frame.path}/512/{z}/{x}/{y}/4/1_1.png`;
  }
  return owmTileUrl(layer.id, atUnix);
}
