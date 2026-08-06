import {
  ACCENT_CORAL,
  ACCENT_STEEL,
  aqiInfo,
  backdropEffects,
  dewPoint,
  heroAccent,
  pollenInfo,
  precipIntensity,
  readableOn,
  uvLabel,
  visibilityLabel,
  warningColor,
  warningFg,
  weatherGradient,
  WIND_FLAG_COLORS,
  WIND_FLAG_KMH,
  WIND_STORM_KMH,
  windStrength,
} from "../weatherLook";

const HEX = /^#[0-9A-F]{6}$/i;

describe("weatherGradient", () => {
  it("vraća tri hex stopa za svaku kombinaciju", () => {
    for (const code of [0, 2, 3, 45, 61, 71, 95, 999]) {
      for (const isDay of [true, false]) {
        for (const dark of [true, false]) {
          const stops = weatherGradient(code, isDay, dark);
          expect(stops).toHaveLength(3);
          for (const s of stops) expect(s).toMatch(HEX);
        }
      }
    }
  });

  it("sunčan dan je topao (narančast), kiša hladna (plavo-siva)", () => {
    const sun = weatherGradient(0, true, false)[0]!;
    const rain = weatherGradient(61, true, false)[0]!;
    // Toplo = crveni kanal dominira; hladno = plavi.
    const r = (h: string) => parseInt(h.slice(1, 3), 16);
    const b = (h: string) => parseInt(h.slice(5, 7), 16);
    expect(r(sun)).toBeGreaterThan(b(sun));
    expect(b(rain)).toBeGreaterThan(r(rain));
  });

  it("vedra noć se razlikuje od vedrog dana", () => {
    expect(weatherGradient(0, false, false)).not.toEqual(weatherGradient(0, true, false));
  });

  it("tamna tema daje tamnije stopove od svijetle", () => {
    const light = weatherGradient(0, true, false)[0]!;
    const dark = weatherGradient(0, true, true)[0]!;
    const lum = (h: string) =>
      parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    expect(lum(dark)).toBeLessThan(lum(light));
  });

  it("nepoznat WMO kod pada na oblačno, ne ruši se", () => {
    expect(weatherGradient(999, true, false)).toEqual(weatherGradient(3, true, false));
  });

  it("magla i oblačno dijele paletu; grmljavina ima svoju", () => {
    expect(weatherGradient(45, true, false)).toEqual(weatherGradient(3, true, false));
    expect(weatherGradient(95, true, false)).not.toEqual(weatherGradient(61, true, false));
  });
});

describe("backdropEffects", () => {
  it("vedro i pretežno vedro dobivaju SAMO zrake", () => {
    expect(backdropEffects(0, true)).toEqual(["rays"]);
    expect(backdropEffects(1, true)).toEqual(["rays"]);
  });

  /*
   * Popravak 6.8.2026.: kod 2 je prije vraćao samo `["rays"]`, isto kao
   * čisto sunce, pa se "djelomično oblačno" na uređaju vidjelo kao
   * "vedro, samo malo manje vedro" — bez ijednog oblaka u pozadini.
   */
  it("DJELOMIČNO oblačan dan dobiva zrake I oblake", () => {
    expect(backdropEffects(2, true)).toEqual(["rays", "clouds"]);
  });

  it("pravo oblačno ostaje bez zraka — po tome se razlikuje", () => {
    expect(backdropEffects(3, true)).toEqual(["clouds"]);
  });

  it("kiša, rosulja i pljuskovi dobivaju kišu", () => {
    for (const code of [51, 61, 65, 80, 82]) {
      expect({ code, fx: backdropEffects(code, true) }).toEqual({
        code,
        fx: ["rain"],
      });
    }
  });

  it("snijeg i SNJEŽNI pljuskovi dobivaju pahulje, kišni ne", () => {
    for (const code of [71, 73, 75, 77, 85, 86]) {
      expect({ code, fx: backdropEffects(code, true) }).toEqual({
        code,
        fx: ["snow"],
      });
    }
    // 80–82 su KIŠNI pljuskovi — ne smiju pasti u snijeg.
    expect(backdropEffects(80, true)).toEqual(["rain"]);
  });

  it("magla ima vlastiti sloj, oblačno svoj", () => {
    expect(backdropEffects(45, true)).toEqual(["fog"]);
    expect(backdropEffects(48, true)).toEqual(["fog"]);
    expect(backdropEffects(3, true)).toEqual(["clouds"]);
    expect(backdropEffects(0, false)).toEqual(["clouds"]);
    expect(backdropEffects(2, false)).toEqual(["clouds"]);
  });

  it("KOMBINACIJA: susnježica pada i kao kiša i kao snijeg", () => {
    for (const code of [56, 57, 66, 67]) {
      expect({ code, fx: backdropEffects(code, true) }).toEqual({
        code,
        fx: ["rain", "snow"],
      });
    }
  });

  it("KOMBINACIJA: grmljavina je kiša + bljeskovi", () => {
    for (const code of [95, 96, 99]) {
      expect({ code, fx: backdropEffects(code, true) }).toEqual({
        code,
        fx: ["rain", "lightning"],
      });
    }
  });

  it("noćna kiša i noćni snijeg zadržavaju svoju oborinu", () => {
    expect(backdropEffects(61, false)).toEqual(["rain"]);
    expect(backdropEffects(75, false)).toEqual(["snow"]);
  });

  it("svaki kod daje bar jedan poznat sloj", () => {
    const known = ["rays", "rain", "snow", "clouds", "fog", "lightning"];
    for (let code = 0; code <= 99; code++) {
      for (const isDay of [true, false]) {
        const fx = backdropEffects(code, isDay);
        expect(fx.length).toBeGreaterThan(0);
        for (const f of fx) expect(known).toContain(f);
      }
    }
    expect(backdropEffects(999, true).length).toBeGreaterThan(0);
  });
});

describe("precipIntensity", () => {
  it("rosulja i slaba oborina su 'light'", () => {
    for (const code of [51, 53, 56, 61, 66, 71, 73, 80]) {
      expect({ code, i: precipIntensity(code) }).toEqual({ code, i: "light" });
    }
  });

  it("jaka kiša/snijeg, jaki pljuskovi i tuča su 'heavy'", () => {
    for (const code of [65, 67, 75, 82, 96, 99]) {
      expect({ code, i: precipIntensity(code) }).toEqual({ code, i: "heavy" });
    }
  });

  it("ostalo je 'moderate'", () => {
    expect(precipIntensity(63)).toBe("moderate");
    expect(precipIntensity(0)).toBe("moderate");
    expect(precipIntensity(999)).toBe("moderate");
  });

  it("jača oborina nikad nije sporija od slabije", () => {
    const rank = { light: 0, moderate: 1, heavy: 2 };
    // Unutar iste obitelji: slaba < umjerena < jaka.
    expect(rank[precipIntensity(61)]).toBeLessThan(rank[precipIntensity(63)]);
    expect(rank[precipIntensity(63)]).toBeLessThan(rank[precipIntensity(65)]);
    expect(rank[precipIntensity(71)]).toBeLessThan(rank[precipIntensity(75)]);
  });
});

describe("heroAccent", () => {
  /** Kanal iz hex-a — za provjeru je li boja topla ili hladna. */
  const chan = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const isWarm = (h: string) => chan(h, 0) > chan(h, 2);

  it("sunčane (svijetle) pozadine dobivaju TOPLI akcent", () => {
    expect(isWarm(heroAccent(0, true))).toBe(true);
    expect(isWarm(heroAccent(2, true))).toBe(true);
  });

  it("kišne, oblačne i noćne pozadine dobivaju HLADNI akcent", () => {
    for (const [code, isDay] of [
      [61, true],
      [3, true],
      [0, false],
      [95, true],
      [75, true],
    ] as const) {
      expect({ code, isDay, warm: isWarm(heroAccent(code, isDay)) }).toEqual({
        code,
        isDay,
        warm: false,
      });
    }
  });

  it("akcent na heroju je tamniji od čistih akcenata (čitljivost)", () => {
    // Izmjereno: čiste boje na svijetlom dnu heroja padnu na ~2:1.
    const lum = (h: string) => chan(h, 0) + chan(h, 1) + chan(h, 2);
    expect(lum(heroAccent(0, true))).toBeLessThan(lum(ACCENT_CORAL));
    expect(lum(heroAccent(61, true))).toBeLessThan(lum(ACCENT_STEEL));
  });
});

describe("dewPoint (Magnus)", () => {
  it("na 100 % vlage rosište je jednako temperaturi", () => {
    expect(dewPoint(20, 100)).toBeCloseTo(20, 1);
  });

  it("25 °C i 50 % vlage daje ~13.9 °C", () => {
    expect(dewPoint(25, 50)).toBeCloseTo(13.9, 0);
  });

  it("suh zrak daje rosište duboko ispod temperature", () => {
    expect(dewPoint(30, 20)).toBeLessThan(10);
  });
});

describe("uvLabel", () => {
  it("prati WHO razrede", () => {
    expect(uvLabel(0)).toBe("Nizak");
    expect(uvLabel(2.9)).toBe("Nizak");
    expect(uvLabel(3)).toBe("Umjeren");
    expect(uvLabel(6)).toBe("Visok");
    expect(uvLabel(8)).toBe("Vrlo visok");
    expect(uvLabel(11)).toBe("Ekstreman");
  });
});

describe("visibilityLabel", () => {
  it("stupnjuje po kilometrima", () => {
    expect(visibilityLabel(24)).toBe("Odlična");
    expect(visibilityLabel(10)).toBe("Dobra");
    expect(visibilityLabel(3)).toBe("Umjerena");
    expect(visibilityLabel(0.5)).toBe("Slaba");
  });
});

describe("aqiInfo", () => {
  it("EEA razredi: ocjena, boja i položaj markera", () => {
    const good = aqiInfo(15);
    expect(good.label).toBe("Dobra");
    expect(good.color).toMatch(HEX);
    expect(good.fraction).toBeGreaterThanOrEqual(0);
    expect(good.fraction).toBeLessThan(0.25);

    const bad = aqiInfo(95);
    expect(bad.label).not.toBe("Dobra");
    expect(bad.fraction).toBeGreaterThan(0.7);
    expect(bad.fraction).toBeLessThanOrEqual(1);
  });

  it("vrijednosti iznad skale se stežu na 1", () => {
    expect(aqiInfo(400).fraction).toBe(1);
  });
});

describe("warningColor / warningFg", () => {
  it("razine nose žutu/narančastu/crvenu, žuta dobiva tamni tekst", () => {
    expect(warningColor(2)).toMatch(HEX);
    expect(warningColor(3)).toMatch(HEX);
    expect(warningColor(4)).toBe("#E63946");
    expect(warningFg(2)).toBe("#141414"); // kontrast na žutoj
    expect(warningFg(4)).toBe("#FFFFFF");
  });
});

describe("windStrength", () => {
  it("ispod 10 m/s nema značke", () => {
    expect(windStrength(0)).toBe("calm");
    expect(windStrength(20)).toBe("calm");
    // 35 km/h = 9.7 m/s — još uvijek ispod praga.
    expect(windStrength(35.9)).toBe("calm");
  });

  it("od 10 m/s bijela, od 17 m/s crvena zastava", () => {
    expect(windStrength(WIND_FLAG_KMH)).toBe("strong");
    expect(windStrength(50)).toBe("strong");
    expect(windStrength(WIND_STORM_KMH - 0.1)).toBe("strong");
    expect(windStrength(WIND_STORM_KMH)).toBe("storm");
    expect(windStrength(120)).toBe("storm");
  });

  it("pragovi odgovaraju 10 i 17 m/s (ulaz je km/h)", () => {
    expect(WIND_FLAG_KMH / 3.6).toBeCloseTo(10, 1);
    expect(WIND_STORM_KMH / 3.6).toBeCloseTo(17, 1);
  });

  it("olujna zastava dijeli crvenu s najvišom razinom upozorenja", () => {
    expect(WIND_FLAG_COLORS.storm).toBe(warningColor(4));
    expect(WIND_FLAG_COLORS.strong).toMatch(HEX);
  });
});

describe("readableOn", () => {
  it("tamni tekst na svijetloj podlozi i obrnuto", () => {
    expect(readableOn("#FFFFFF")).toBe("#141414");
    expect(readableOn("#000000")).toBe("#FFFFFF");
  });

  /**
   * Značka na karti nosi gradijent vremena — ista komponenta stoji nad
   * sunčanim zlatom i nad noćnim indigom, pa tekst mora pratiti podlogu.
   */
  it("svaka paleta heroja daje čitljiv tekst na srednjem stopu", () => {
    for (const code of [0, 2, 3, 61, 71, 95]) {
      for (const isDay of [true, false]) {
        const mid = weatherGradient(code, isDay, false)[1]!;
        expect(["#141414", "#FFFFFF"]).toContain(readableOn(mid));
      }
    }
    // Sunčan dan je svijetao (tamni tekst), vedra noć tamna (bijeli).
    expect(readableOn(weatherGradient(0, true, false)[1]!)).toBe("#141414");
    expect(readableOn(weatherGradient(0, false, false)[1]!)).toBe("#FFFFFF");
  });

  it("neispravan hex ne ruši ništa", () => {
    expect(readableOn("xyz")).toBe("#141414");
    expect(readableOn("")).toBe("#141414");
  });
});

describe("pollenInfo", () => {
  it("sve na nuli: razred 0, bez vrsta — kartica se ne prikazuje", () => {
    const info = pollenInfo({ grass: 0, ragweed: 0.2 });
    expect(info.grade).toBe(0);
    expect(info.species).toHaveLength(0);
    expect(info.color).toBeUndefined();
  });

  it("današnji Zadar (ambrozija 5.3, trava 2.5): niska, ambrozija prva", () => {
    const info = pollenInfo({ grass: 2.5, ragweed: 5.3, alder: 0, birch: 0 });
    expect(info.grade).toBe(1);
    expect(info.species.map((s) => s.key)).toEqual(["ragweed", "grass"]);
  });

  it("ukupna ocjena je najviši razred; ambrozija je alergenija od breze", () => {
    // 30 grains/m³ breze je tek niska; ista koncentracija ambrozije visoka.
    const birch = pollenInfo({ birch: 30 });
    const ragweed = pollenInfo({ ragweed: 30 });
    expect(ragweed.grade).toBeGreaterThan(birch.grade);

    const mixed = pollenInfo({ birch: 30, ragweed: 100 });
    expect(mixed.grade).toBe(4);
    expect(mixed.species[0]!.key).toBe("ragweed");
  });

  it("fraction se steže na 1, razredi rastu s koncentracijom", () => {
    const info = pollenInfo({ grass: 10_000 });
    expect(info.species[0]!.fraction).toBe(1);
    expect(info.grade).toBe(4);

    expect(pollenInfo({ grass: 3 }).grade).toBe(1);
    expect(pollenInfo({ grass: 15 }).grade).toBe(2);
    expect(pollenInfo({ grass: 50 }).grade).toBe(3);
  });
});
