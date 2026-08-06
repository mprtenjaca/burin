import { EMMA_REGIONS, emmaRegionName, regionsForPlace } from "../emmaRegions";

describe("regionsForPlace", () => {
  it("poznata mjesta padaju u svoju kopnenu regiju", () => {
    // [ime, lat, lon, očekivana kopnena regija]
    const cases: [string, number, number, string][] = [
      ["Zagreb", 45.815, 15.982, "HR002"],
      ["Osijek", 45.554, 18.695, "HR005"],
      ["Karlovac", 45.487, 15.548, "HR003"],
      ["Gospić", 44.546, 15.375, "HR004"],
      ["Knin", 44.04, 16.2, "HR001"],
      ["Zadar", 44.119, 15.232, "HR001"],
      ["Polača", 44.006, 15.505, "HR001"],
      ["Rijeka", 45.327, 14.442, "HR006"],
      ["Pula", 44.867, 13.85, "HR006"],
      ["Split", 43.508, 16.44, "HR008"],
      ["Makarska", 43.297, 17.017, "HR008"],
      ["Dubrovnik", 42.651, 18.094, "HR007"],
      ["Varaždin", 46.306, 16.336, "HR002"],
      ["Slavonski Brod", 45.16, 18.016, "HR005"],
    ];
    for (const [name, lat, lon, expected] of cases) {
      expect({ name, region: regionsForPlace(lat, lon)[0] }).toEqual({
        name,
        region: expected,
      });
    }
  });

  it("obalna mjesta dobivaju i pomorski pojas, duboko kopno ne", () => {
    expect(regionsForPlace(43.508, 16.44)).toContain("HR805"); // Split
    expect(regionsForPlace(44.119, 15.232)).toContain("HR804"); // Zadar
    expect(regionsForPlace(44.294, 15.441)).toContain("HR803"); // Starigrad
    expect(regionsForPlace(45.081, 13.64)).toContain("HR801"); // Rovinj
    expect(regionsForPlace(42.651, 18.094)).toContain("HR806"); // Dubrovnik

    const zagreb = regionsForPlace(45.815, 15.982);
    const osijek = regionsForPlace(45.554, 18.695);
    expect(zagreb).toEqual(["HR002"]);
    expect(osijek).toEqual(["HR005"]);
  });

  /**
   * Nađeno na uređaju 6.8.2026.: grad u ČILEU je prikazivao crveni
   * meteoalarm za Hrvatsku, jer je "najbliže sidro" uvijek nešto vraćalo.
   * Feed je hrvatski — izvan dosega DHMZ-a upozorenja NE SMIJE biti.
   */
  it("mjesta izvan Hrvatske ne dobivaju hrvatska upozorenja", () => {
    const abroad: [string, number, number][] = [
      ["Santiago (Čile)", -33.45, -70.67],
      ["Punta Arenas (Čile)", -53.16, -70.91],
      ["London", 51.51, -0.13],
      ["Berlin", 52.52, 13.4],
      ["Rim", 41.9, 12.5],
      ["Istanbul", 41.01, 28.98],
      ["New York", 40.71, -74.01],
      ["Sydney", -33.87, 151.21],
    ];
    for (const [name, lat, lon] of abroad) {
      expect({ name, regions: regionsForPlace(lat, lon) }).toEqual({
        name,
        regions: [],
      });
    }
  });

  it("hrvatska mjesta i rubni pojas i dalje dobivaju regiju", () => {
    // Krajnje točke zemlje: Međimurje, Ilok, Prevlaka, Savudrija.
    for (const [lat, lon] of [
      [46.48, 16.4],
      [45.22, 19.38],
      [42.39, 18.52],
      [45.49, 13.5],
    ] as const) {
      expect(regionsForPlace(lat, lon).length).toBeGreaterThan(0);
    }
  });

  it("prva vraćena regija je uvijek kopnena", () => {
    for (const r of EMMA_REGIONS) {
      const first = regionsForPlace(r.anchor.lat, r.anchor.lon)[0]!;
      const kind = EMMA_REGIONS.find((x) => x.id === first)?.kind;
      expect(kind).toBe("land");
    }
  });
});

describe("emmaRegionName", () => {
  it("vraća hrvatska imena, a za nepoznato undefined", () => {
    expect(emmaRegionName("HR001")).toBe("kninska regija");
    expect(emmaRegionName("HR803")).toBe("Velebitski kanal");
    expect(emmaRegionName("XX999")).toBeUndefined();
  });
});
