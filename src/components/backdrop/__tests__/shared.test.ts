import { DENSITY_BY_INTENSITY, SPEED_BY_INTENSITY, thin } from "../shared";

/*
 * `shared.ts` uvozi `Platform` iz react-nativea (za IS_LOW_END), pa je
 * jest-expo preset dovoljan — nema nativnih modula.
 */

describe("DENSITY_BY_INTENSITY", () => {
  /**
   * Markov nalaz 9.9.2026.: „kiša i jaki pljuskovi nema razlike u
   * količini crtica" i „dodaj još pahulja, učestalije". Do tada je jačina
   * mijenjala SAMO brzinu (`SPEED_BY_INTENSITY`); ovo je drugi kanal.
   */
  it("raste s jačinom, jaka je puna", () => {
    expect(DENSITY_BY_INTENSITY.light).toBeLessThan(DENSITY_BY_INTENSITY.moderate);
    expect(DENSITY_BY_INTENSITY.moderate).toBeLessThan(DENSITY_BY_INTENSITY.heavy);
    expect(DENSITY_BY_INTENSITY.heavy).toBe(1);
  });

  /** Rosulja mora ostati vidljiva — ispod trećine bi bila prazan ekran. */
  it("slaba nije prazna", () => {
    expect(DENSITY_BY_INTENSITY.light).toBeGreaterThanOrEqual(0.3);
  });

  /**
   * Brzina i količina idu u ISTOM smjeru: jaka je brža (manji množitelj
   * trajanja) I gušća. Da se raziđu, pljusak bi jurio s malo kapi ili
   * rosulja mililia s puno — oboje laže o jačini.
   */
  it("brzina i količina se slažu po jačini", () => {
    const order = ["light", "moderate", "heavy"] as const;
    for (let i = 1; i < order.length; i++) {
      expect(SPEED_BY_INTENSITY[order[i]!]).toBeLessThan(SPEED_BY_INTENSITY[order[i - 1]!]);
      expect(DENSITY_BY_INTENSITY[order[i]!]).toBeGreaterThan(DENSITY_BY_INTENSITY[order[i - 1]!]);
    }
  });
});

describe("thin", () => {
  const items = Array.from({ length: 10 }, (_, i) => i);

  it("vraća sve kad je tražen broj ≥ duljina", () => {
    expect(thin(items, 10)).toEqual(items);
    expect(thin(items, 99)).toEqual(items);
  });

  it("vraća točno traženi broj, ravnomjerno raspoređen", () => {
    expect(thin(items, 5)).toEqual([0, 2, 4, 6, 8]);
    expect(thin(items, 4)).toHaveLength(4);
  });

  /**
   * Ključno za kišu i snijeg: prorijeđene čestice ČUVAJU izvorni indeks
   * (`thin` vraća elemente, ne nove indekse), pa uzorak/faza/položaj po
   * njemu ostaju isti. Bez toga se pri prorjeđivanju vraća vodoravni
   * prazan „val" (nađeno na uređaju 6.8.2026.).
   */
  it("čuva identitet elemenata, ne renumerira ih", () => {
    const tagged = items.map((i) => ({ i }));
    const out = thin(tagged, 3);
    for (const o of out) expect(tagged).toContain(o);
    expect(out.map((o) => o.i)).toEqual([0, 3, 6]);
  });

  it("ne pada na praznom nizu ni nuli", () => {
    expect(thin([], 5)).toEqual([]);
    expect(thin(items, 0)).toEqual([]);
  });
});
