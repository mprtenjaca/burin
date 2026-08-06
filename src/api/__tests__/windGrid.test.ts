import { gridPoints, parseWindGrid, stepDegFor, windFeatures } from "../windGrid";

const BOUNDS = { west: 15, south: 44, east: 16, north: 45 };

describe("gridPoints", () => {
  it("sve točke padaju unutar zadanog kadra", () => {
    for (const p of gridPoints(BOUNDS)) {
      expect(p.lon).toBeGreaterThan(BOUNDS.west);
      expect(p.lon).toBeLessThan(BOUNDS.east);
      expect(p.lat).toBeGreaterThan(BOUNDS.south);
      expect(p.lat).toBeLessThan(BOUNDS.north);
    }
  });

  /**
   * Izmjereno 5.8.2026.: 154 točke = URL 2.3 kB, HTTP 200 za 364 ms — jedan
   * upit. Gornja granica čuva od mreže koja bi probila duljinu URL-a; donja
   * od rijetke mreže u kojoj se strujanje ne vidi.
   */
  it("mreža je dovoljno gusta za rojenje crtica, a stane u jedan upit", () => {
    const points = gridPoints(BOUNDS);
    expect(points.length).toBeGreaterThanOrEqual(100);
    expect(points.length).toBeLessThanOrEqual(250);
  });

  it("točke su različite (mreža, ne jedna točka ponovljena)", () => {
    const points = gridPoints(BOUNDS);
    const unique = new Set(points.map((p) => `${p.lat},${p.lon}`));
    expect(unique.size).toBe(points.length);
  });

  /**
   * Izmjereno 6.8.2026.: Open-Meteo za točke razmaknute 0.008° vraća
   * IDENTIČNE vrijednosti (model je na ~0.1°). Gušća mreža od toga je
   * čisti trošak — stotine istovjetnih strujnica jedna na drugoj.
   */
  it("pri jakom približavanju se mreža prorjeđuje, ne steže", () => {
    const tight = { west: 15.0, south: 44.0, east: 15.05, north: 44.05 };
    const wide = gridPoints(BOUNDS);
    const near = gridPoints(tight);
    expect(near.length).toBeLessThan(wide.length);
    // Uvijek ostaje mreža (bar 2×2) — interpolacija treba susjede.
    expect(near.length).toBeGreaterThanOrEqual(4);
    for (const p of near) {
      expect(p.lon).toBeGreaterThan(tight.west);
      expect(p.lon).toBeLessThan(tight.east);
    }
  });
});

describe("stepDegFor", () => {
  it("duljina strujnice prati širinu kadra", () => {
    const wide = stepDegFor({ west: 14, south: 44, east: 18, north: 46 });
    const near = stepDegFor({ west: 15.0, south: 44.0, east: 15.1, north: 44.1 });
    expect(near).toBeLessThan(wide);
  });

  it("strujnica nikad ne prelazi kadar ni ne nestane", () => {
    // Na jakom zoomu je fiksna duljina prelazila 80 % širine ekrana.
    const span = 0.1;
    const step = stepDegFor({ west: 15, south: 44, east: 15 + span, north: 44.1 });
    expect(step * 6).toBeLessThan(span);
    expect(step).toBeGreaterThan(0);

    // Bez kadra i s besmislenim kadrom ostaje zadana vrijednost.
    expect(stepDegFor()).toBeGreaterThan(0);
    expect(stepDegFor({ west: 15, south: 44, east: 15, north: 44 })).toBeGreaterThan(0);
  });
});

describe("parseWindGrid", () => {
  const point = {
    latitude: 44.5,
    longitude: 15.5,
    hourly: {
      time: ["2026-08-05T12:00", "2026-08-05T13:00"],
      wind_speed_10m: [12.4, null],
      wind_direction_10m: [225, 230],
    },
  };

  it("niz odgovora (više točaka) se čita", () => {
    const grid = parseWindGrid([point, { ...point, latitude: 45 }]);
    expect(grid).toHaveLength(2);
    expect(grid[0]!.lat).toBe(44.5);
  });

  it("jedan objekt (jedna točka) se također čita", () => {
    expect(parseWindGrid(point)).toHaveLength(1);
  });

  it("null vrijednosti postaju undefined, ne 0", () => {
    const grid = parseWindGrid(point);
    expect(grid[0]!.speeds[0]).toBe(12.4);
    expect(grid[0]!.speeds[1]).toBeUndefined();
  });

  it("točka bez satnog niza se izbacuje (ne ruši sloj)", () => {
    expect(parseWindGrid([{ latitude: 1, longitude: 1 }])).toHaveLength(0);
  });
});

describe("windFeatures", () => {
  const TIME = "2026-08-05T12:00";

  /** Mreža 3×3 s jednakim vjetrom u svim točkama. */
  function uniformGrid(speed: number, direction: number) {
    const points = [];
    for (const lat of [44, 44.5, 45]) {
      for (const lon of [15, 15.5, 16]) {
        points.push({
          latitude: lat,
          longitude: lon,
          hourly: {
            time: [TIME],
            wind_speed_10m: [speed],
            wind_direction_10m: [direction],
          },
        });
      }
    }
    return parseWindGrid(points);
  }

  it("rezultat su LINIJE, ne točke (strujnice se savijaju)", () => {
    const fc = windFeatures(uniformGrid(20, 0), TIME);
    expect(fc.features[0]!.geometry.type).toBe("LineString");
    expect(fc.features[0]!.geometry.coordinates.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * Meteorološki smjer kaže ODAKLE vjetar puše; strujnica ide KAMO teče.
   * Bez okretanja za 180° sve crte teku na krivu stranu — greška koju je
   * lako previdjeti jer karta i dalje "izgleda uredno".
   */
  it("sjeverni vjetar (0°) teče prema JUGU", () => {
    const fc = windFeatures(uniformGrid(20, 0), TIME);
    const coords = fc.features[0]!.geometry.coordinates;
    const [, prvaLat] = coords[0]!;
    const [, zadnjaLat] = coords[coords.length - 1]!;
    expect(zadnjaLat).toBeLessThan(prvaLat);
  });

  it("istočni vjetar (90°) teče prema ZAPADU", () => {
    const fc = windFeatures(uniformGrid(20, 90), TIME);
    const coords = fc.features[0]!.geometry.coordinates;
    const [prvaLon] = coords[0]!;
    const [zadnjaLon] = coords[coords.length - 1]!;
    expect(zadnjaLon).toBeLessThan(prvaLon);
  });

  it("brzina ide u svojstva (boja i debljina se računaju iz nje)", () => {
    const fc = windFeatures(uniformGrid(20, 0), TIME);
    expect(fc.features[0]!.properties!.speed).toBeCloseTo(20, 1);
  });

  it("tišina se ne crta (ispod 0.5 km/h nema strujnice)", () => {
    expect(windFeatures(uniformGrid(0.1, 0), TIME).features).toHaveLength(0);
  });

  it("sat kojeg nema u nizu daje praznu kolekciju, ne pad", () => {
    expect(windFeatures(uniformGrid(20, 0), "2026-08-05T23:00").features).toHaveLength(0);
  });

  it("koordinate su [lon, lat] i kreću iz točke mreže", () => {
    const fc = windFeatures(uniformGrid(20, 0), TIME);
    const [lon, lat] = fc.features[0]!.geometry.coordinates[0]!;
    expect(lon).toBeGreaterThan(14);
    expect(lon).toBeLessThan(17);
    expect(lat).toBeGreaterThan(43);
    expect(lat).toBeLessThan(46);
  });

  /**
   * Prosjek smjerova 350° i 10° u stupnjevima daje 180° — točno suprotno od
   * stvarnog (0°). Zato se interpolira preko u/v komponenti.
   */
  it("smjer se interpolira preko komponenti, ne stupnjeva", () => {
    const grid = parseWindGrid([
      {
        latitude: 44,
        longitude: 15,
        hourly: { time: [TIME], wind_speed_10m: [20], wind_direction_10m: [350] },
      },
      {
        latitude: 44.2,
        longitude: 15,
        hourly: { time: [TIME], wind_speed_10m: [20], wind_direction_10m: [10] },
      },
    ]);
    const fc = windFeatures(grid, TIME);
    const coords = fc.features[0]!.geometry.coordinates;
    // Oba vjetra su ~sjeverna → strujnica MORA ići prema jugu.
    expect(coords[coords.length - 1]![1]).toBeLessThan(coords[0]![1]);
  });
});
