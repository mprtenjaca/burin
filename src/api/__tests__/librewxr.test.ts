import { fetchLibreFrames, libreTileUrl } from "../librewxr";

jest.mock("../client", () => ({ fetchJson: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const client = require("../client") as { fetchJson: jest.Mock };

/**
 * Isječak PRAVOG odgovora (`api.librewxr.net/public/weather-maps.json`,
 * dohvaćeno 9.9.2026. u 14:06). Skraćen na 2 prošla + 2 buduća okvira;
 * vremena i putanje su izvorne. Kad LibreWXR promijeni oblik odgovora,
 * ovaj test pukne prvi — isto načelo kao `__fixtures__/stampar-zagreb.html`.
 */
const REAL_RESPONSE = {
  version: "2.0",
  generated: 1788955587,
  host: "https://api.librewxr.net",
  radar: {
    past: [
      { time: 1788948600, path: "/v2/radar/1788948600" },
      { time: 1788955200, path: "/v2/radar/1788955200" },
    ],
    nowcast: [
      { time: 1788955800, path: "/v2/radar/1788955800" },
      { time: 1788958800, path: "/v2/radar/1788958800" },
    ],
    colorSchemes: [
      { id: 1, name: "Rainviewer Original" },
      { id: 2, name: "Universal Blue" },
    ],
  },
  satellite: { infrared: [{ time: 1788951600, path: "/v2/satellite/1788951600" }] },
};

describe("fetchLibreFrames", () => {
  beforeEach(() => client.fetchJson.mockReset());

  it("spaja prošle i buduće okvire, budući označeni", async () => {
    client.fetchJson.mockResolvedValue(REAL_RESPONSE);
    const { frames, host } = await fetchLibreFrames();

    expect(host).toBe("https://api.librewxr.net");
    expect(frames.map((f) => f.isNowcast)).toEqual([false, false, true, true]);
    expect(frames.map((f) => f.time)).toEqual([
      1788948600, 1788955200, 1788955800, 1788958800,
    ]);
  });

  /**
   * CIJELA SVRHA SLOJA (9.9.2026.).
   *
   * RainViewer je 1.1.2026. ukinuo nowcast i njegov niz je od tada prazan
   * — zbog toga radar u aplikaciji ne može u budućnost, i zbog toga ovaj
   * izvor postoji. Ako ovdje ostanu samo prošli okviri, Radar+ ne nudi
   * ništa što radar već nema.
   */
  it("nowcast donosi budućnost, ne samo prošlost", async () => {
    client.fetchJson.mockResolvedValue(REAL_RESPONSE);
    const { frames } = await fetchLibreFrames();

    const future = frames.filter((f) => f.isNowcast);
    expect(future.length).toBeGreaterThan(0);
    // Budući okviri moraju biti KASNIJE od svih izmjerenih.
    const lastPast = Math.max(
      ...frames.filter((f) => !f.isNowcast).map((f) => f.time),
    );
    for (const f of future) expect(f.time).toBeGreaterThan(lastPast);
  });

  it("okviri su kronološki — crta ne smije skakati", async () => {
    client.fetchJson.mockResolvedValue(REAL_RESPONSE);
    const { frames } = await fetchLibreFrames();
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]!.time).toBeGreaterThan(frames[i - 1]!.time);
    }
  });

  /**
   * Javna instanca je bez SLA: smije vratiti samo prošlost (ili ništa) i
   * player s tim mora raditi — isto pravilo kao kod RainViewera, koji
   * nowcast više NIKAD ne vraća.
   */
  it("preživi odgovor bez nowcasta", async () => {
    client.fetchJson.mockResolvedValue({
      host: "https://api.librewxr.net",
      radar: { past: [{ time: 1788948600, path: "/v2/radar/1788948600" }] },
    });
    const { frames } = await fetchLibreFrames();
    expect(frames).toHaveLength(1);
    expect(frames[0]!.isNowcast).toBe(false);
  });

  it("preživi odgovor bez radara", async () => {
    client.fetchJson.mockResolvedValue({ host: "https://api.librewxr.net" });
    const { frames } = await fetchLibreFrames();
    expect(frames).toEqual([]);
  });
});

describe("libreTileUrl", () => {
  /**
   * `{z}/{x}/{y}` ostaju MapLibre predlošci — URL se NE interpolira u
   * JS-u nego ga rasterski izvor puni sam.
   */
  it("ostavlja MapLibre predloške i nosi shemu boja", () => {
    const url = libreTileUrl("https://api.librewxr.net", "/v2/radar/123", 512);
    expect(url).toBe("https://api.librewxr.net/v2/radar/123/512/{z}/{x}/{y}/1/1_1.png");
  });

  it("veličina pločice ide u URL", () => {
    expect(libreTileUrl("https://h", "/p", 256)).toContain("/p/256/");
    expect(libreTileUrl("https://h", "/p", 512)).toContain("/p/512/");
  });
});
