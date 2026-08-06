import {
  cleanRegionName,
  feedNameForCountry,
  hasMeteoalarmFeed,
} from "../meteoalarmEurope";

describe("feedNameForCountry", () => {
  it("poznate zemlje daju ime feeda, nepoznate undefined", () => {
    expect(feedNameForCountry("HR")).toBe("croatia");
    expect(feedNameForCountry("at")).toBe("austria");
    expect(feedNameForCountry("DE")).toBe("germany");
    expect(feedNameForCountry("GB")).toBe("united-kingdom");
    // Bez feeda (provjereno 6.8.2026.): Albanija, S. Makedonija, svijet.
    expect(feedNameForCountry("AL")).toBeUndefined();
    expect(feedNameForCountry("US")).toBeUndefined();
    expect(feedNameForCountry("CL")).toBeUndefined();
    expect(feedNameForCountry(undefined)).toBeUndefined();
  });

  it("hasMeteoalarmFeed prati istu tablicu", () => {
    expect(hasMeteoalarmFeed("SI")).toBe(true);
    expect(hasMeteoalarmFeed("JP")).toBe(false);
  });
});

describe("cleanRegionName", () => {
  it("skida administrativne riječi koje geokoder ne poznaje", () => {
    // Sve izmjereno na živom geokoderu 6.8.2026.: sirovo ime ne pogađa,
    // očišćeno pogađa.
    expect(cleanRegionName("Gospic region")).toBe("Gospic");
    expect(cleanRegionName("Kreis Goslar")).toBe("Goslar");
    expect(cleanRegionName("Eisenstadt (Stadt)")).toBe("Eisenstadt");
    expect(cleanRegionName("Velebit channel region")).toBe("Velebit");
  });

  it("imena bez tih riječi ostaju netaknuta", () => {
    expect(cleanRegionName("Piemonte")).toBe("Piemonte");
    expect(cleanRegionName("Lienz")).toBe("Lienz");
  });
});
