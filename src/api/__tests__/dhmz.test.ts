import { findNearbyStations, findNearestStation, parseDhmzXml } from "../dhmz";

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

  it("preferira gradsku postaju pred aerodromom (stvarni Split, 4.8.2026.)", () => {
    // Aerodrom je čak neznatno bliži centru, ali mjeri 1.6 °C manje jer je
    // u ravnici izvan grada — Vrijeme&Radar zato koristi gradsku postaju.
    const report = {
      measuredAt: "04.08.2026. 23:00",
      stations: [
        { name: "Split-aerodrom", lat: 43.539, lon: 16.301, temp: 28.0 },
        { name: "Split-Marjan", lat: 43.508, lon: 16.426, temp: 29.6 },
      ],
    };
    const obs = findNearestStation(43.508, 16.44, report);
    expect(obs!.stationName).toBe("Split-Marjan");
    expect(obs!.temp).toBe(29.6);
  });

  it("findNearbyStations vraća 3 najbliže, sortirane", () => {
    const report = {
      measuredAt: "04.08.2026. 23:00",
      stations: [
        { name: "Daleka", lat: 45.5, lon: 16.5, temp: 20 },
        { name: "Blizu1", lat: 43.51, lon: 16.44, temp: 29 },
        { name: "Blizu2", lat: 43.6, lon: 16.4, temp: 28 },
        { name: "Srednja", lat: 43.9, lon: 16.2, temp: 26 },
      ],
    };
    const list = findNearbyStations(43.508, 16.44, report);
    expect(list).toHaveLength(3);
    expect(list[0]!.stationName).toBe("Blizu1");
    expect(list[0]!.distanceKm).toBeLessThan(list[1]!.distanceKm);
    expect(list[1]!.distanceKm).toBeLessThan(list[2]!.distanceKm);
  });

  it("findNearbyStations preskače aerodrome kad ima dovoljno gradskih", () => {
    const report = {
      measuredAt: "04.08.2026. 23:00",
      stations: [
        { name: "Zadar-aerodrom", lat: 44.097, lon: 15.363, temp: 22.4 },
        { name: "Zadar", lat: 44.13, lon: 15.206, temp: 26.3 },
        { name: "Šibenik", lat: 43.728, lon: 15.906, temp: 27 },
        { name: "Knin", lat: 44.041, lon: 16.207, temp: 24.8 },
      ],
    };
    const list = findNearbyStations(43.95, 15.72, report);
    expect(list.map((o) => o.stationName)).not.toContain("Zadar-aerodrom");
    expect(list).toHaveLength(3);
  });

  it("findNearbyStations koristi aerodrom kad nema dovoljno gradskih", () => {
    const report = {
      measuredAt: "04.08.2026. 23:00",
      stations: [
        { name: "Zadar-aerodrom", lat: 44.097, lon: 15.363, temp: 22.4 },
        { name: "Zadar", lat: 44.13, lon: 15.206, temp: 26.3 },
      ],
    };
    const list = findNearbyStations(43.95, 15.72, report);
    expect(list).toHaveLength(2);
    expect(list.map((o) => o.stationName)).toContain("Zadar-aerodrom");
  });

  it("findNearbyStations ignorira postaje bez temperature", () => {
    const report = {
      measuredAt: "04.08.2026. 23:00",
      stations: [
        { name: "Bez temp", lat: 43.51, lon: 16.44, temp: undefined },
        { name: "S temp", lat: 43.6, lon: 16.4, temp: 28 },
      ],
    };
    const list = findNearbyStations(43.508, 16.44, report);
    expect(list).toHaveLength(1);
    expect(list[0]!.stationName).toBe("S temp");
  });

  it("aerodrom se koristi kad je jedina postaja u blizini", () => {
    const report = {
      measuredAt: "04.08.2026. 23:00",
      stations: [{ name: "Zadar-aerodrom", lat: 44.097, lon: 15.363, temp: 22.4 }],
    };
    const obs = findNearestStation(43.95, 15.72, report);
    expect(obs!.stationName).toBe("Zadar-aerodrom");
  });
});
