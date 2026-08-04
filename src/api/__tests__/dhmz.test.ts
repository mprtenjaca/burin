import { findNearestStation, parseDhmzXml } from "../dhmz";

/** Stvarna struktura feeda s vrijeme.hr (provjereno 4.8.2026.). */
const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Hrvatska>
<DatumTermin><Datum>04.08.2026</Datum><Termin>16</Termin></DatumTermin>
<Grad autom="1"><GradIme>Daruvar</GradIme><Lat>45.592</Lat><Lon>17.210</Lon>
<Podatci><Temp>37.9</Temp><Vlaga>19</Vlaga><Tlak>1013.9</Tlak><TlakTend>-1.3</TlakTend>
<VjetarSmjer>S</VjetarSmjer><VjetarBrzina>2.0</VjetarBrzina>
<Vrijeme>povjetarac</Vrijeme><VrijemeZnak>-</VrijemeZnak></Podatci></Grad>
<Grad autom="0"><GradIme>Zagreb-Maksimir</GradIme><Lat>45.822</Lat><Lon>16.034</Lon>
<Podatci><Temp>36.2</Temp><Vlaga>25</Vlaga><Tlak>-</Tlak><TlakTend>-</TlakTend>
<VjetarSmjer>-</VjetarSmjer><VjetarBrzina>-</VjetarBrzina>
<Vrijeme>-</Vrijeme><VrijemeZnak>-</VrijemeZnak></Podatci></Grad>
</Hrvatska>`;

describe("parseDhmzXml", () => {
  it("parsira postaje s koordinatama i mjerenjima", () => {
    const report = parseDhmzXml(VALID_XML);
    expect(report).not.toBeNull();
    expect(report!.stations).toHaveLength(2);
    expect(report!.measuredAt).toBe("04.08.2026. 16:00");

    const daruvar = report!.stations[0]!;
    expect(daruvar.name).toBe("Daruvar");
    expect(daruvar.lat).toBeCloseTo(45.592);
    expect(daruvar.temp).toBe(37.9);
    expect(daruvar.humidity).toBe(19);
    expect(daruvar.pressure).toBe(1013.9);
    expect(daruvar.pressureTrend).toBe(-1.3);
    expect(daruvar.windDir).toBe("S");
    expect(daruvar.windSpeed).toBe(2);
    expect(daruvar.conditionText).toBe("povjetarac");
  });

  it("vrijednosti '-' postaju undefined, nikad NaN", () => {
    const report = parseDhmzXml(VALID_XML);
    const zg = report!.stations[1]!;
    expect(zg.pressure).toBeUndefined();
    expect(zg.pressureTrend).toBeUndefined();
    expect(zg.windDir).toBeUndefined();
    expect(zg.windSpeed).toBeUndefined();
    expect(zg.conditionText).toBeUndefined();
    expect(zg.temp).toBe(36.2);
  });

  it("neispravan XML vraća null umjesto iznimke", () => {
    expect(parseDhmzXml("ovo nije xml")).toBeNull();
    expect(parseDhmzXml("<Hrvatska><Grad>")).toBeNull();
    expect(parseDhmzXml("<Drugo><Nesto/></Drugo>")).toBeNull();
    expect(parseDhmzXml("")).toBeNull();
  });
});

describe("findNearestStation", () => {
  it("nalazi najbližu postaju s udaljenošću", () => {
    const report = parseDhmzXml(VALID_XML)!;
    // Zagreb centar -> najbliži je Zagreb-Maksimir (~4 km), ne Daruvar
    const obs = findNearestStation(45.815, 15.982, report);
    expect(obs).not.toBeNull();
    expect(obs!.stationName).toBe("Zagreb-Maksimir");
    expect(obs!.distanceKm).toBeLessThan(10);
    expect(obs!.measuredAt).toBe("04.08.2026. 16:00");
  });

  it("vraća null za prazan popis", () => {
    expect(
      findNearestStation(45.8, 16, { stations: [], measuredAt: "" }),
    ).toBeNull();
  });
});
