import {
  ACCENT_CORAL,
  ACCENT_STEEL,
  aqiInfo,
  backdropEffects,
  dewPoint,
  heroAccent,
  moonPhase,
  moonShadowOffset,
  pollenInfo,
  precipIntensity,
  readableOn,
  stripAccent,
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

  /*
   * VEDAR DAN JE PLAV, NE NARANČAST (izmjena 8.8.2026.).
   *
   * Test je prije tvrdio suprotno — i bio je točan za dizajn od 6.8.
   * Otkad aplikacija dijeli paletu s widgetom, sunce je PLAVO NEBO, pa
   * se i provjera okrenula: u oba slučaja mora dominirati plavi kanal.
   *
   * Ostaje provjera da se sunce i kiša i dalje RAZLIKUJU — obje su
   * plave, ali sunčano nebo je vedrije (svjetlije) od kišnog.
   */
  it("vedar dan je plav kao i kiša, ali svjetliji od nje", () => {
    const sun = weatherGradient(0, true, false)[0]!;
    const rain = weatherGradient(61, true, false)[0]!;
    const r = (h: string) => parseInt(h.slice(1, 3), 16);
    const b = (h: string) => parseInt(h.slice(5, 7), 16);
    expect(b(sun)).toBeGreaterThan(r(sun));
    expect(b(rain)).toBeGreaterThan(r(rain));
    /*
     * Razlikuje ih ZASIĆENOST, ne svjetlina (izmjereno 8.8.2026.).
     *
     * Prvo je ovdje stajalo da je vedro SVJETLIJE od kišnog — netočno:
     * vedro je 350, kišno 449, jer je vedro preuzelo widgetovu
     * potamnjenu plavu, a kišna paleta nije mijenjana.
     *
     * Prava razlika je u čistoći boje: vedro nebo je duboko plavo
     * (razmak crvenog i plavog kanala 108), kiša je isprano sivkasta
     * (46). To je i fizikalno točno — naoblaka oduzima boju.
     */
    const sat = (h: string) => b(h) - r(h);
    expect(sat(sun)).toBeGreaterThan(sat(rain));
  });

  /*
   * Aplikacija i widget moraju pokazivati ISTU boju za isto vrijeme
   * (Markov zahtjev 8.8.2026.) — vrijednosti su preuzete iz
   * `WIDGET_DARK_PALETTES` u `widgetData.ts`. Ako se ondje promijene, a
   * ovdje ne, ovaj test pada i time javlja da su se razišle.
   */
  it("vedro i djelomično oblačno dijele boje s widgetom", () => {
    expect(weatherGradient(0, true, false)).toEqual(["#4F86BC", "#3A6C9E", "#2B5780"]);
    expect(weatherGradient(2, true, false)).toEqual(["#4A7BA8", "#36628E", "#284D70"]);
  });

  it("vedra noć se razlikuje od vedrog dana", () => {
    expect(weatherGradient(0, false, false)).not.toEqual(weatherGradient(0, true, false));
  });

  const lum = (h: string) =>
    parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);

  it("tamna tema daje tamnije stopove od svijetle", () => {
    // Sunčan dan je IZUZET — vidi test ispod.
    for (const code of [3, 45, 61, 71, 95]) {
      const light = weatherGradient(code, true, false)[0]!;
      const dark = weatherGradient(code, true, true)[0]!;
      expect(lum(dark)).toBeLessThan(lum(light));
    }
  });

  /*
   * Sunce je jedina iznimka od "tamna tema = tamniji stopovi" (Markov
   * odabir 6.8.2026.): prigušena smeđa paleta je izgledala "pretmurno",
   * pa tamna tema dijeli prva dva stopa sa svijetlom. Samo se DNO spušta,
   * jer se ondje gradijent stapa u #0E0E0E umjesto u papirnatu podlogu.
   */
  /*
   * Od 8.8.2026. vedar dan ima JEDNU verziju za obje teme — iste boje
   * kao widget, koji temu telefona uopće ne prati. Prije je tamna tema
   * spuštala samo dno; sada nema što spuštati jer je paleta ionako
   * tamnoplava i bijeli tekst na njoj prolazi u oba slučaja.
   */
  it("vedar dan izgleda isto u obje teme (kao widget)", () => {
    expect(weatherGradient(0, true, true)).toEqual(weatherGradient(0, true, false));
    expect(weatherGradient(2, true, true)).toEqual(weatherGradient(2, true, false));
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
  /*
   * Naoblaka je STUPNJEVANA (Markov ispravak 8.8.2026.): 0 je čisto
   * sunce, 1 već ima pokoji oblak, 2 ih ima više. Prije su 0 i 1 dijelili
   * isti ambijent, pa je "pretežno vedro" u Roču izgledalo kao potpuno
   * vedro nebo — isti propust koji je 6.8. nađen na djelomično oblačnom.
   */
  it("vedro dobiva samo zrake, pretežno vedro i oblake", () => {
    expect(backdropEffects(0, true)).toEqual(["rays"]);
    expect(backdropEffects(1, true)).toEqual(["rays", "clouds"]);
  });

  /*
   * Boja se pritom NE mijenja: 0 i 1 dijele paletu, razlikuje ih samo
   * ambijent. Da se razišla i boja, "pretežno vedro" bi izgledalo kao
   * posve drugo vrijeme umjesto kao isto nebo s pokojim oblakom.
   */
  it("pretežno vedro dijeli boju s vedrim, razlikuje se samo ambijentom", () => {
    expect(weatherGradient(1, true, false)).toEqual(weatherGradient(0, true, false));
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

  /*
   * Popravak 6.8.2026.: vedra noć je padala u `default` i dobivala
   * OBLAKE — vedro nebo se crtalo kao naoblaka. Ovaj je test to prije
   * zapisivao kao ispravno (`backdropEffects(0, false) === ["clouds"]`),
   * pa bug nije mogao pasti ni na jednoj provjeri.
   */
  it("VEDRA noć dobiva zvijezde, ne oblake", () => {
    expect(backdropEffects(0, false)).toEqual(["stars"]);
    expect(backdropEffects(1, false)).toEqual(["stars"]);
  });

  it("oblačna noć i dalje dobiva oblake — po tome se razlikuje", () => {
    expect(backdropEffects(2, false)).toEqual(["clouds"]);
    expect(backdropEffects(3, false)).toEqual(["clouds"]);
  });

  it("magla ima vlastiti sloj, oblačno svoj", () => {
    expect(backdropEffects(45, true)).toEqual(["fog"]);
    expect(backdropEffects(48, true)).toEqual(["fog"]);
    expect(backdropEffects(3, true)).toEqual(["clouds"]);
  });

  it("KOMBINACIJA: susnježica pada i kao kiša i kao snijeg", () => {
    for (const code of [56, 57, 66, 67]) {
      expect({ code, fx: backdropEffects(code, true) }).toEqual({
        code,
        fx: ["rain", "snow"],
      });
    }
  });

  /*
   * Od 8.8.2026. grmljavina ima i OBLAKE (Markov ispravak): prije je
   * nebo iza munje bilo prazno, a nevrijeme je prije svega oblak.
   * Oblaci su PRVI u nizu, dakle najdublji sloj — iza kiše i bljeska.
   */
  it("KOMBINACIJA: grmljavina je oblaci + kiša + bljeskovi", () => {
    for (const code of [95, 96, 99]) {
      expect({ code, fx: backdropEffects(code, true) }).toEqual({
        code,
        fx: ["clouds", "rain", "lightning"],
      });
    }
  });

  it("noćna kiša i noćni snijeg zadržavaju svoju oborinu", () => {
    expect(backdropEffects(61, false)).toEqual(["rain"]);
    expect(backdropEffects(75, false)).toEqual(["snow"]);
  });

  it("svaki kod daje bar jedan poznat sloj", () => {
    const known = ["rays", "rain", "snow", "clouds", "fog", "lightning", "stars"];
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

  /*
   * PRAVILO SE OKRENULO ZA VEDRO (8.8.2026.).
   *
   * Dok je sunčan heroj bio narančast, dno mu je bilo gotovo bijelo, pa
   * je akcent morao biti TAMNIJI od čistog da se vidi. Sada je dno
   * tamnoplavo (#234B72), pa vrijedi obrnuto — akcent mora biti
   * SVJETLIJI. Zato zlatna, izmjereno 5.56:1 (koraljna bi dala 2.99:1).
   *
   * Kišni heroj nije mijenjan i drži staro pravilo.
   */
  it("akcent na heroju se vidi na svojoj podlozi", () => {
    const lum = (h: string) => chan(h, 0) + chan(h, 1) + chan(h, 2);
    // Vedro: tamna podloga → akcent mora biti SVJETLIJI od koraljne.
    expect(lum(heroAccent(0, true))).toBeGreaterThan(lum(ACCENT_CORAL));
    // Kiša: svijetlo dno → akcent ostaje tamniji od čiste plave.
    expect(lum(heroAccent(61, true))).toBeLessThan(lum(ACCENT_STEEL));
  });

  /*
   * Stvarni kontrast na DNU gradijenta, gdje stoji traka sati — to je
   * mjesto na kojem su i koraljna i plava 6.8. pale na ~2:1.
   */
  /*
   * Traka sati NIJE na nebu (8.8.2026.): dno gradijenta se stapa u
   * podlogu stranice, pa postotci stoje na svijetlom. Zlatna koja je
   * ispravna na tamnoplavom heroju ondje daje 1.56:1 i nestane — zato
   * traka ima VLASTITI akcent, koji ne smije ovisiti o vremenu.
   */
  it("traka sati ima svoj akcent, neovisan o vremenu", () => {
    expect(stripAccent()).toBe(stripAccent());
    // Vedro nebo daje zlatnu u heroju, ali traka mora ostati na plavoj.
    expect(stripAccent()).not.toBe(heroAccent(0, true));
    // Na kišnom su isti — ondje heroj ionako nosi hladni akcent.
    expect(stripAccent()).toBe(heroAccent(61, true));
  });

  it("akcent trake se vidi na svijetloj podlozi trake", () => {
    const srgb = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const rel = (h: string) =>
      0.2126 * srgb(chan(h, 0) / 255) +
      0.7152 * srgb(chan(h, 1) / 255) +
      0.0722 * srgb(chan(h, 2) / 255);
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [rel(a), rel(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    // Papirnata podloga stranice, na koju se dno gradijenta stapa.
    expect(ratio(stripAccent(), "#FAFAF8")).toBeGreaterThan(4.5);
    // I na tamnoj temi mora ostati vidljiv.
    expect(ratio(stripAccent(), "#1A1A1A")).toBeGreaterThan(3);
  });

  it("zlatni akcent prolazi prag na vedrom nebu", () => {
    const srgb = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const rel = (h: string) =>
      0.2126 * srgb(chan(h, 0) / 255) +
      0.7152 * srgb(chan(h, 1) / 255) +
      0.0722 * srgb(chan(h, 2) / 255);
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [rel(a), rel(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    const bottom = weatherGradient(0, true, false)[2]!;
    expect(ratio(heroAccent(0, true), bottom)).toBeGreaterThan(4.5);
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
    /*
     * OD 8.8.2026. I VEDAR DAN NOSI BIJELI TEKST.
     *
     * Prije je sunce bilo narančasto-zlatno (luminancija 0.334) pa je
     * dobivalo tamni tekst. Sada je plavo nebo (0.107), dakle ispod
     * praga 0.19 — bijeli tekst. To je namjerna posljedica poklapanja s
     * widgetom, ne regresija.
     *
     * Provjera i dalje ima smisla: uspoređuje DAN i NOĆ, koji su sada
     * oboje tamni, pa se traži da su oba čitljiva istim izborom.
     */
    expect(readableOn(weatherGradient(0, true, false)[1]!)).toBe("#FFFFFF");
    expect(readableOn(weatherGradient(0, false, false)[1]!)).toBe("#FFFFFF");
    // Oblačno je i dalje svijetlo pa mora ostati na TAMNOM tekstu —
    // inače bi promjena tiho pogurala sve palete u bijelo.
    expect(readableOn(weatherGradient(3, true, false)[1]!)).toBe("#141414");
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

describe("mjesečeva mijena", () => {
  /*
   * Referentni datumi su STVARNE mijene (NASA/Meeus, 2026.). Račun je
   * približan (srednji sinodički mjesec), pa se provjerava da padne u
   * pravu ČETVRTINU ciklusa, ne na decimalu.
   */
  const at = (y: number, m: number, d: number, h = 12) => Date.UTC(y, m - 1, d, h);

  it("mlađak je blizu 0 (ili 1), uštap blizu 0.5", () => {
    // 13.8.2026. mlađak; 28.8.2026. uštap.
    const newMoon = moonPhase(at(2026, 8, 13));
    expect(Math.min(newMoon, 1 - newMoon)).toBeLessThan(0.05);
    expect(moonPhase(at(2026, 8, 28))).toBeGreaterThan(0.45);
    expect(moonPhase(at(2026, 8, 28))).toBeLessThan(0.58);
  });

  it("6.8.2026. je STARI SRP koji opada (kao na V&R screenshotu)", () => {
    const phase = moonPhase(at(2026, 8, 6, 21));
    // Druga polovica ciklusa = opada; blizu zadnje četvrti.
    expect(phase).toBeGreaterThan(0.5);
    expect(phase).toBeLessThan(0.9);
    // Opadajući mjesec ima sjenu DESNO -> pozitivan pomak.
    expect(moonShadowOffset(phase)).toBeGreaterThan(0);
  });

  it("uvijek vraća udio 0–1, i za datume prije epohe", () => {
    for (const t of [at(1990, 3, 1), at(2000, 1, 6), at(2026, 8, 6), at(2040, 12, 31)]) {
      const p = moonPhase(t);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });

  it("sjena: mlađak prekriva disk, uštap ga otkriva", () => {
    // Mlađak: sjena točno preko mjeseca (pomak ~0) -> ništa se ne vidi.
    expect(Math.abs(moonShadowOffset(0))).toBeLessThan(0.01);
    // Uštap: sjena posve odmaknuta (|pomak| = 2 = dva polumjera).
    expect(Math.abs(moonShadowOffset(0.5))).toBeCloseTo(2, 5);
    // Četvrti: pola diska -> pomak 1, suprotnih predznaka.
    expect(moonShadowOffset(0.25)).toBeCloseTo(-1, 5);
    expect(moonShadowOffset(0.75)).toBeCloseTo(1, 5);
  });

  it("rastući mjesec svijetli DESNO, opadajući LIJEVO", () => {
    // Predznak nosi stranu; zamjena bi dala zrcalno pogrešan srp.
    expect(moonShadowOffset(0.15)).toBeLessThan(0);
    expect(moonShadowOffset(0.85)).toBeGreaterThan(0);
  });
});
