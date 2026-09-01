import type { WeatherBundle } from "@/api/types";
import { setActiveLanguage } from "@/i18n";
import { quipFor, quipKey, type QuipInput } from "@/utils/quips";
import { WIND_FLAG_KMH, WIND_STORM_KMH } from "@/utils/weatherLook";

/**
 * Rečenice o vremenu (`quips.ts`).
 *
 * Težište NIJE na tekstu — tekst je stvar ukusa i mijenjat će se. Testira
 * se ODABIR: redoslijed prioriteta (ekstrem prije neba), pragovi vezani
 * uz značku bure, i to da rečenica ne skače pri svakom renderu.
 */

/** Miran vedar dan — polazište koje svaki test kvari u jednom polju. */
const CALM: QuipInput = {
  code: 0,
  isDay: true,
  temp: 20,
  gustsKmh: 5,
  precip24: 0,
};

describe("quipKey — prioritet", () => {
  it("vrućina nadglasava vedro nebo", () => {
    // Isti WMO kod 0, dva posve različita dana — to je cijeli razlog
    // zašto se ne bira samo po kodu.
    expect(quipKey({ ...CALM, temp: 36 })).toBe("scorching");
    expect(quipKey({ ...CALM, temp: 20 })).toBe("nice");
  });

  it("hladnoća nadglasava vedro nebo", () => {
    expect(quipKey({ ...CALM, temp: -5 })).toBe("freezing");
    expect(quipKey({ ...CALM, temp: 1 })).toBe("cold");
  });

  it("nevrijeme nadglasava i vrućinu", () => {
    // 36 °C uz grmljavinu ne smije dati "jebački vruće".
    expect(quipKey({ ...CALM, code: 95, temp: 36 })).toBe("thunder");
    expect(quipKey({ ...CALM, code: 96, temp: 36 })).toBe("hail");
  });

  it("bura nadglasava kišu", () => {
    expect(quipKey({ ...CALM, code: 63, gustsKmh: 70 })).toBe("bura");
  });

  it("jaka kiša nadglasava toplinu, ali ne i buru", () => {
    expect(quipKey({ ...CALM, code: 65, temp: 30 })).toBe("rainHeavy");
    expect(quipKey({ ...CALM, code: 65, temp: 30, gustsKmh: 70 })).toBe("bura");
  });
});

describe("quipKey — pragovi", () => {
  it("bura kreće TOČNO na pragu značke (8 Bf)", () => {
    // Ako se pragovi raziđu, rečenica bi govorila "bura" dok značka šuti.
    expect(quipKey({ ...CALM, gustsKmh: WIND_STORM_KMH })).toBe("bura");
    expect(quipKey({ ...CALM, gustsKmh: WIND_STORM_KMH - 0.1 })).not.toBe("bura");
  });

  it("vjetrovito kreće na pragu vjetrulje", () => {
    expect(quipKey({ ...CALM, gustsKmh: WIND_FLAG_KMH })).toBe("windy");
    expect(quipKey({ ...CALM, gustsKmh: WIND_FLAG_KMH - 0.1 })).not.toBe("windy");
  });

  it("puno oborine daje jaku kišu i kad je kod blaži", () => {
    // Kod 61 je "slaba kiša", ali 20 mm u 24 h nije slab dan.
    expect(quipKey({ ...CALM, code: 61, precip24: 2 })).toBe("rain");
    expect(quipKey({ ...CALM, code: 61, precip24: 20 })).toBe("rainHeavy");
  });
});

describe("quipKey — nebo", () => {
  it("vedra noć nije isto što i vedar dan", () => {
    expect(quipKey({ ...CALM, isDay: false })).toBe("clearNight");
  });

  it("nepoznat kod ne ruši odabir", () => {
    expect(quipKey({ ...CALM, code: 1234 })).toBe("clear");
  });

  it.each([
    [3, "overcast"],
    [2, "cloudy"],
    [45, "fog"],
    [48, "fog"],
    [75, "snowHeavy"],
    [73, "snow"],
    [53, "drizzle"],
  ] as const)("kod %i → %s", (code, key) => {
    expect(quipKey({ ...CALM, code })).toBe(key);
  });
});

/** Minimalan bundle — samo polja koja `quipFor` stvarno čita. */
function bundleWith(
  placeId = "hr-split",
  over: Partial<WeatherBundle["current"]> = {},
  fetchedAt = Date.parse("2026-08-10T12:00:00"),
): WeatherBundle {
  return {
    place: { id: placeId, name: "Split", lat: 43.5, lon: 16.4 },
    current: {
      temp: 36,
      feelsLike: 36,
      code: 0,
      isDay: true,
      windSpeed: 3,
      windGusts: 5,
      windDir: 90,
      humidity: 40,
      pressure: 1013,
      cloudCover: 0,
      precipitation: 0,
      ...over,
    },
    hourly: [],
    hourlyAll: [],
    daily: [],
    fetchedAt,
  } as unknown as WeatherBundle;
}

describe("quipFor", () => {
  beforeEach(() => setActiveLanguage("hr"));

  it("ista rečenica unutar istog sata — ne trepće pri renderu", () => {
    // Nasumičan odabir bi mijenjao tekst na svaki render — skrol,
    // promjena teme i povratak u aplikaciju bi tekst tjerali da trepće.
    const a = quipFor(bundleWith());
    const b = quipFor(bundleWith());
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("rečenica se VRTI kroz dan, ne stoji od jutra do mraka", () => {
    // Sat je dio sjemena: inače bi se cijeli popis vidio tek kroz tjedan.
    const said = new Set(
      Array.from({ length: 24 }, (_, h) =>
        quipFor(bundleWith("hr-split", {}, Date.parse(`2026-08-10T${String(h).padStart(2, "0")}:00:00`))),
      ),
    );
    expect(said.size).toBeGreaterThan(1);
  });

  it("mjesto ULAZI u odabir — gradovi s istim vremenom se razilaze", () => {
    // Da mjesto ispadne iz sjemena, svi bi gradovi istog dana imali
    // DOSLOVNO istu rečenicu i popis bi izgledao ko ispis greške.
    //
    // Dvije rečenice ne moraju se razlikovati (popis je konačan, pa se
    // dva grada smiju poklopiti), ali preko dvadeset gradova mora dati
    // više od jedne — inače mjesto očito ne utječe na odabir.
    const ids = Array.from({ length: 20 }, (_, i) => `hr-grad-${i}`);
    const said = new Set(ids.map((id) => quipFor(bundleWith(id))));
    expect(said.size).toBeGreaterThan(1);
  });

  it("prati jezik sučelja", () => {
    const hr = quipFor(bundleWith());
    setActiveLanguage("en");
    const en = quipFor(bundleWith());
    expect(en).not.toBe(hr);
    // Engleski parnjak ne smije ostati na hrvatskom tekstu.
    expect(en).toMatch(/[a-z]/i);
  });

  it("svaka kategorija daje rečenicu na OBA jezika", () => {
    /*
     * Prazna lista za neku kategoriju pala bi tek NA UREĐAJU, i to
     * praznom karticom — `pick` bi vratio `undefined`. Zato se svaka
     * kategorija stvarno dosegne kroz `quipFor` na oba jezika.
     *
     * Ulazi su birani tako da svaki padne u točno jednu kategoriju;
     * provjera `size` ispod čuva da popis ostane potpun kad se doda nova.
     */
    const cases: QuipInput[] = [
      { ...CALM, temp: 36 }, // scorching
      { ...CALM, temp: 30 }, // hot
      { ...CALM, temp: -5 }, // freezing
      { ...CALM, temp: 1 }, // cold
      { ...CALM, gustsKmh: 70 }, // bura
      { ...CALM, gustsKmh: 40 }, // windy
      { ...CALM, code: 95 }, // thunder
      { ...CALM, code: 96 }, // hail
      { ...CALM, code: 75 }, // snowHeavy
      { ...CALM, code: 73 }, // snow
      { ...CALM, code: 65 }, // rainHeavy
      { ...CALM, code: 63 }, // rain
      { ...CALM, code: 53 }, // drizzle
      { ...CALM, code: 45 }, // fog
      { ...CALM, code: 3 }, // overcast
      { ...CALM, code: 2 }, // cloudy
      { ...CALM, isDay: false }, // clearNight
      { ...CALM }, // nice
      { ...CALM, temp: 10 }, // clear
    ];

    // Svih 19 kategorija mora biti pokriveno — inače test ne provjerava
    // ono što tvrdi da provjerava.
    expect(new Set(cases.map(quipKey)).size).toBe(19);

    for (const lang of ["hr", "en"] as const) {
      setActiveLanguage(lang);
      for (const c of cases) {
        const said = quipFor(
          bundleWith("hr-split", {
            code: c.code,
            isDay: c.isDay,
            temp: c.temp,
            windGusts: c.gustsKmh,
          }),
        );
        // `toBeTruthy` bi propustio prazan string — traži se pravi tekst.
        expect(typeof said).toBe("string");
        expect(said.length).toBeGreaterThan(10);
      }
    }
  });
});
