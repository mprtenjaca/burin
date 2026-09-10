import { en } from "../en";
import { hr } from "../hr";

/**
 * Rječnici (6.8.2026.). Typecheck već jamči da engleski ima SVAKI ključ
 * hrvatskog (tipiziran je kao `Dict`), pa ovdje ide ono što tip ne vidi:
 * prazne vrijednosti, zaboravljeni hrvatski tekst u engleskom i duljina
 * nizova koji se indeksiraju brojem.
 *
 * `index.ts` se namjerno NE uvozi — povukao bi `expo-localization`, koji
 * je nativni modul i srušio bi ovaj suite (isto pravilo kao AsyncStorage
 * u `MapTimeline`).
 */

/** Rekurzivno skupi sve tekstualne vrijednosti uz putanju do njih. */
function flatten(obj: unknown, path = ""): [string, string][] {
  if (typeof obj === "string") return [[path, obj]];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => flatten(v, `${path}[${i}]`));
  if (obj && typeof obj === "object") {
    return Object.entries(obj).flatMap(([k, v]) => flatten(v, path ? `${path}.${k}` : k));
  }
  return [];
}

describe("rječnici", () => {
  it("nijedan prijevod nije prazan", () => {
    for (const [dictName, dict] of [["hr", hr], ["en", en]] as const) {
      for (const [path, value] of flatten(dict)) {
        expect(`${dictName}.${path}: "${value}"`).toBe(
          `${dictName}.${path}: "${value.trim()}"`,
        );
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("engleski nema zaostalih hrvatskih dijakritika", () => {
    /*
     * Najčešća greška pri prevođenju je preskočen ključ, koji ostane na
     * hrvatskom. Dijakritika (čćžšđ) to uhvati bez popisa riječi.
     *
     * Iznimka: `languageHr` je NAMJERNO "Hrvatski" — imena jezika stoje
     * u tom jeziku, pa hrvatski red ostaje prepoznatljiv i na engleskom
     * sučelju.
     */
    const suspicious = flatten(en)
      .filter(([path]) => path !== "settings.languageHr")
      .filter(([, value]) => /[čćžšđ]/i.test(value));
    expect(suspicious).toEqual([]);
  });

  it("nizovi indeksirani brojem imaju jednaku duljinu u oba jezika", () => {
    // Indeks je kut/45° odnosno Date.getDay() — kraći niz daje undefined.
    expect(en.windDirs).toHaveLength(hr.windDirs.length);
    expect(en.dayNames).toHaveLength(hr.dayNames.length);
    expect(en.dayNamesShort).toHaveLength(hr.dayNamesShort.length);
    expect(hr.windDirs).toHaveLength(8);
    expect(hr.dayNames).toHaveLength(7);
  });

  it("engleske kratice smjerova NISU kopija hrvatskih", () => {
    /*
     * Hrvatski "I" je istok, engleski "E"; hrvatski "S" je sjever, a
     * engleski "S" je JUG. Kopiran niz bi engleskom korisniku pokazivao
     * točno suprotan smjer, a tip toga ne vidi — oboje je string[].
     */
    expect(en.windDirs).toEqual(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
    expect(en.windDirs[0]).not.toBe(hr.windDirs[0]);
  });

  it("dani u tjednu su prevedeni, ne hrvatski", () => {
    // Konkretno ono što se vidjelo na ekranu upozorenja: "čet", "pet".
    expect(en.dayNamesShort).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(en.dayNames[4]).toBe("Thursday");
  });
});

/*
 * NAZIV VREMENA NE SMIJE TVRDITI VIŠE OD KODA (10.9.2026.).
 *
 * Prva verzija ovog bloka zabranjivala je da DVA razreda dijele naziv.
 * Marko je 10.9. svjesno odabrao suprotno: 51/53 = „Slaba kiša" (kao
 * 61), 55 = „Kiša" (kao 63), 56/57 = „Ledena kiša" (kao 66/67), 77 =
 * „Slab snijeg" (kao 71) — jer su „sitna kiša" i „zrnca" zvučali strano.
 * Razlika ostaje u IKONI (`CloudDrizzle` vs `CloudRain`) i u gustoći
 * ambijenta, pa se vidi iako se ne izgovara.
 *
 * Zato test više ne traži jedinstvenost, nego ono što je stvarno štetno:
 * naziv NE SMIJE tvrditi JAČU pojavu od one koju kod nosi. Sitna oborina
 * smije se zvati „Slaba kiša" (isto ili slabije), ali nikad „Jaka kiša".
 */
describe("nazivi vremena ne tvrde više od koda", () => {
  const dicts = { hr, en };
  /** Rang jačine po nazivu: 0 = slabo, 2 = jako. -1 = nije stupnjevano. */
  const rank = (label: string): number => {
    const l = label.toLowerCase();
    if (/\b(jak|jaka|jaki|heavy)\b/.test(l)) return 2;
    if (/\b(slab|slaba|slabi|light|scattered|mjestimice)\b/.test(l)) return 0;
    return 1;
  };

  for (const [lang, dict] of Object.entries(dicts)) {
    const c = dict.conditions as Record<string, string>;

    it(`${lang}: sitna oborina se ne izdaje za JAČU pojavu`, () => {
      /*
       * 51/53 ne smiju zvucati JAKO. Ne usporeduje se s 61 jer rang mjeri
       * PRIDJEV, a engleski "Drizzle" pridjeva nema (rang 1) dok je
       * "Light rain" rang 0 - to ne znaci da rosulja zvuci jace, nego da
       * je neutralna. Stvarno stetno bi bilo da nosi "jaka".
       */
      expect(rank(c.drizzle!)).toBeLessThan(2);
      // 55 je najjaca SITNA oborina, ali nikad JACA od 65 (jaka kisa).
      // Jednakost je dopustena: en ima "Heavy drizzle" i "Heavy rain" -
      // isti pridjev, razlicita pojava (pojavu razlikuje sama rijec).
      expect(rank(c.drizzleHeavy!)).toBeLessThanOrEqual(rank(c.rainHeavy!));
      // 77 (zrnca, po definiciji slabo) ne smije zvucati jace od 73
      expect(rank(c.snowGrains!)).toBeLessThanOrEqual(rank(c.snow!));
    });

    it(`${lang}: stupnjevi unutar iste pojave rastu`, () => {
            expect(rank(c.rainLight!)).toBeLessThan(rank(c.rainHeavy!));
      expect(rank(c.snowLight!)).toBeLessThan(rank(c.snowHeavy!));
      expect(rank(c.showersLight!)).toBeLessThan(rank(c.showersHeavy!));
    });

    it(`${lang}: 95 ne obećava nevrijeme, 96/99 ga smije`, () => {
      // WMO 95 je "slight or moderate" - "nevrijeme"/"severe" tu ne stoji
      expect(c.thunderstorm!.toLowerCase()).not.toContain("nevrijeme");
      expect(c.thunderstorm!.toLowerCase()).not.toContain("severe");
    });
  }
});
