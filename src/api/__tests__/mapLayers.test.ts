import {
  MAP_LAYERS,
  MAP_MAX_ZOOM,
  baseStyleFor,
  isLayerAvailable,
  mapLayerById,
  mapLayerTileUrl,
} from "../mapLayers";
import type { RadarFrame } from "../types";

jest.mock("../owm", () => ({
  hasOwmKey: jest.fn(() => true),
  owmTileUrl: (layer: string, atUnix?: number) =>
    `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=TEST` +
    (atUnix === undefined ? "" : `&date=${Math.floor(atUnix)}`),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const owm = require("../owm") as { hasOwmKey: jest.Mock };

const frame: RadarFrame = { time: 1785885600, path: "/v2/radar/1785885600", isNowcast: false };

describe("MAP_LAYERS", () => {
  it("sadrži četiri sloja iz reference, Radar prvi", () => {
    expect(MAP_LAYERS.map((l) => l.id)).toEqual([
      "radar",
      "temp_new",
      "clouds_new",
      "wind_new",
    ]);
  });

  /**
   * Radar (RainViewer) i Vjetar (vlastite crtice iz Open-Metea) ne traže
   * ključ; samo OWM pločice ga traže.
   */
  it("bez ključa rade Radar i Vjetar", () => {
    expect(MAP_LAYERS.filter((l) => !l.needsKey).map((l) => l.id)).toEqual([
      "radar",
      "wind_new",
    ]);
  });

  /**
   * Regresija (5.8.2026.): besplatni OWM `wind_new` je polje boja bez
   * smjera i izgledao je gotovo isto kao naoblaka. Vjetar se zato crta iz
   * Open-Meteo mreže kao symbol sloj — ne smije se vratiti na pločice.
   */
  it("vjetar se crta kao crtice, ostali kao pločice", () => {
    expect(mapLayerById("wind_new").render).toBe("barbs");
    for (const id of ["radar", "temp_new", "clouds_new"] as const) {
      expect(mapLayerById(id).render).toBe("raster");
    }
  });

  it("svaki sloj ima oznaku izvora i vrstu vremenske crte", () => {
    for (const layer of MAP_LAYERS) {
      expect(layer.attribution.label.length).toBeGreaterThan(0);
      expect(layer.attribution.url).toMatch(/^https:\/\//);
      expect(["frames", "hours"]).toContain(layer.timeline);
    }
  });

  /**
   * Regresija (5.8.2026.): OWM pločice su već poluprozirne u izvoru
   * (izmjereno dekodiranjem piksela: maks. alfa 76/255 za temp, 12/255 za
   * naoblaku). Dodatno množenje `opacity` ispod 1 ih je gasilo — naoblaka
   * je izlazila na ~4 % vidljivosti i sloj je izgledao kao da ne radi.
   */
  it("OWM slojevi se ne prigušuju dodatno (izvor već nosi prozirnost)", () => {
    for (const id of ["temp_new", "clouds_new", "wind_new"] as const) {
      expect(mapLayerById(id).opacity).toBe(1);
    }
  });

  /** clouds_new na z=10 vraća PNG s nula obojenih piksela — rasteže se s niže. */
  it("naoblaka se rasteže s niže razine da se uopće vidi", () => {
    expect(mapLayerById("clouds_new").maxNativeZ).toBeLessThanOrEqual(6);
  });

  /**
   * Regresija (5.8.2026., nađeno NA UREĐAJU): radar je pokazivao sivu
   * pločicu s natpisom "Zoom Level Not Supported" pri približavanju.
   * Izmjereno dekodiranjem: RainViewer od z=8 naviše vraća HTTP 200 i
   * bajt-identičnu sliku (1370 B, md5 2cc6649e) na SVIM koordinatama — a ta
   * slika JE taj natpis. Ranije je ta identičnost protumačena kao "nema
   * novih podataka" pa je `maxNativeZ` bio 8, tj. točno razina natpisa.
   * Stvarni podaci idu do z=7.
   */
  it("radar ne traži razinu na kojoj RainViewer vraća natpis", () => {
    expect(mapLayerById("radar").maxNativeZ).toBeLessThanOrEqual(7);
  });

  /**
   * S MapLibreom granica zooma nije po sloju: iznad `maxNativeZ` se pločica
   * rasteže i sloj nikad ne nestaje. Kamera ipak mora puštati dublje od
   * podataka svakog sloja — inače rastezanje ne bi imalo smisla.
   */
  it("globalni maxZoom kamere je iznad podataka svakog sloja", () => {
    for (const layer of MAP_LAYERS) {
      expect(layer.maxNativeZ).toBeLessThanOrEqual(MAP_MAX_ZOOM);
    }
  });

  it("nepoznat id se svede na Radar (ne pada)", () => {
    // @ts-expect-error namjerno neispravan id
    expect(mapLayerById("nema-me").id).toBe("radar");
  });
});

describe("mapLayerTileUrl", () => {
  it("radar traži aktivni okvir; bez njega nema pločica", () => {
    const radar = mapLayerById("radar");
    expect(mapLayerTileUrl(radar)).toBeNull();
    const url = mapLayerTileUrl(radar, { host: "https://tc.rainviewer.com", frame });
    expect(url).toBe("https://tc.rainviewer.com/v2/radar/1785885600/256/{z}/{x}/{y}/4/1_1.png");
  });

  it("radar koristi glatku shemu boja (gradijent, ne pikseli)", () => {
    const url = mapLayerTileUrl(mapLayerById("radar"), {
      host: "https://tc.rainviewer.com",
      frame,
    });
    expect(url).toContain("/4/1_1.png");
  });

  it("OWM slojevi grade URL iz svog id-a", () => {
    for (const id of ["temp_new", "clouds_new"] as const) {
      expect(mapLayerTileUrl(mapLayerById(id))).toContain(`/map/${id}/`);
    }
  });

  /**
   * Vjetar se crta iz Open-Meteo mreže (symbol sloj), pa nema pločicu —
   * ako bi je imao, vratio bi se OWM-ov bezsmjerni oblak boja.
   */
  it("vjetar nema pločicu (crta se kao symbol sloj)", () => {
    expect(mapLayerTileUrl(mapLayerById("wind_new"))).toBeNull();
  });

  /**
   * Regresija (5.8.2026.): klizanje po satima je mijenjalo samo oznaku, a
   * pločica je ostajala ista — "temperatura se ne mijenja kad pustim
   * snimku". `&date=` na 1.0 pločicama radi (izmjereno: −48 h do +120 h
   * daju različite slike po MD5 hashu), pa se sat s crte MORA proslijediti.
   */
  it("OWM sloj prima vrijeme s vremenske crte kroz &date=", () => {
    const at = 1_785_900_000;
    const url = mapLayerTileUrl(mapLayerById("temp_new"), undefined, at);
    expect(url).toContain(`&date=${at}`);
  });

  it("bez zadanog vremena OWM sloj nema &date (trenutno stanje)", () => {
    expect(mapLayerTileUrl(mapLayerById("temp_new"))).not.toContain("&date=");
  });

  it("radar ignorira vrijeme s crte — nosi ga sam okvir", () => {
    const url = mapLayerTileUrl(
      mapLayerById("radar"),
      { host: "https://h", frame },
      1_785_900_000,
    );
    expect(url).not.toContain("&date=");
  });

  it("svi URL-ovi pločica nose {z}/{x}/{y}", () => {
    const urls = [
      mapLayerTileUrl(mapLayerById("radar"), { host: "https://h", frame }),
      ...(["temp_new", "clouds_new"] as const).map((id) =>
        mapLayerTileUrl(mapLayerById(id)),
      ),
    ];
    for (const url of urls) expect(url).toContain("{z}/{x}/{y}");
  });
});

describe("baseStyleFor", () => {
  /**
   * Naoblaka je u izvoru bijela, strelice vjetra blijede (izmjereno: maks.
   * alfa 12–60 od 255). Na svijetlom stilu se ne razaznaju.
   */
  it("naoblaka dobiva tamni stil", () => {
    expect(baseStyleFor(mapLayerById("clouds_new"))).toContain("dark-matter");
  });

  it("radar, temperatura i vjetar ostaju na svijetlom", () => {
    for (const id of ["radar", "temp_new", "wind_new"] as const) {
      expect(baseStyleFor(mapLayerById(id))).toContain("voyager");
    }
  });

  it("svaki stil je https URL na style.json (GL stil, ne raster predložak)", () => {
    for (const layer of MAP_LAYERS) {
      const url = baseStyleFor(layer);
      expect(url).toMatch(/^https:\/\//);
      expect(url).toMatch(/style\.json$/);
    }
  });
});

describe("isLayerAvailable", () => {
  afterEach(() => owm.hasOwmKey.mockReturnValue(true));

  it("bez ključa ostaju Radar i Vjetar", () => {
    owm.hasOwmKey.mockReturnValue(false);
    expect(MAP_LAYERS.filter(isLayerAvailable).map((l) => l.id)).toEqual([
      "radar",
      "wind_new",
    ]);
  });

  it("s ključem su dostupni svi slojevi", () => {
    owm.hasOwmKey.mockReturnValue(true);
    expect(MAP_LAYERS.every(isLayerAvailable)).toBe(true);
  });
});
