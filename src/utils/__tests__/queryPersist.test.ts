import { QUERY_PREFIX, shouldPersistQuery } from "@/utils/queryPersist";

/**
 * Što smije na disk, a što ne (10.9.2026.). Najvažnija je zabrana kamera:
 * njihovi URL-ovi nose token koji istječe za 10 minuta, pa bi spremljen
 * odgovor nakon restarta vraćao 401 i prazne okvire — greška koja bi se
 * vidjela tek na uređaju, danima kasnije.
 */
describe("shouldPersistQuery", () => {
  it("vremenski upiti idu na disk", () => {
    for (const key of ["om-current", "om-forecast", "om-aqi", "om-sea", "model-bias", "dhmz", "meteoalarm", "meteoalarm-nearby"]) {
      expect(shouldPersistQuery([key, "zadar"])).toBe(true);
    }
  });

  it("kamere (token), Štampar (razvoj) i radarski okviri (10 min) NE idu", () => {
    expect(shouldPersistQuery(["windy-webcams", "44.12", "15.23", "Zadar"])).toBe(false);
    expect(shouldPersistQuery(["stampar-pollen", 24])).toBe(false);
    expect(shouldPersistQuery(["librewxr-frames"])).toBe(false);
  });

  it("prefiks je vlastiti, da GC ne dira tuđe ključeve u AsyncStorageu", () => {
    expect(QUERY_PREFIX.startsWith("burin:")).toBe(true);
  });
});
