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
