import { convertWind } from "../format";
import { WIND_FLAG_KMH, WIND_STORM_KMH, windStrength } from "../weatherLook";

/**
 * Značka vjetra se čita iz `WeatherBundle.windSpeed`, a on je u km/h.
 * Ovi testovi štite točno tu granicu: prag je zadan u m/s (10 i 17), pa
 * bi miješanje jedinica upalilo značku pri 10 km/h — deset puta prerano.
 */
describe("značka vjetra prema jedinicama iz prognoze", () => {
  it("10 m/s je prag, izražen u km/h kako podaci dolaze", () => {
    // Prognoza daje km/h; korisnik ih vidi kao m/s.
    expect(convertWind(WIND_FLAG_KMH, "ms")).toBeCloseTo(10, 1);
    expect(convertWind(WIND_STORM_KMH, "ms")).toBeCloseTo(17, 1);
  });

  it("tipične hrvatske vrijednosti daju očekivanu značku", () => {
    // Mirno ljetno popodne — 3 m/s.
    expect(windStrength(11)).toBe("calm");
    // Umjereno jugo, 8 m/s — još bez značke.
    expect(windStrength(29)).toBe("calm");
    // Bura 12 m/s — bijela zastava.
    expect(windStrength(43)).toBe("strong");
    // Jaka bura 20 m/s — crvena.
    expect(windStrength(72)).toBe("storm");
    // Orkanski udar 35 m/s — crvena, bez gornje granice.
    expect(windStrength(126)).toBe("storm");
  });

  it("nula i besmislen ulaz ne ruše skalu", () => {
    expect(windStrength(0)).toBe("calm");
    expect(windStrength(-5)).toBe("calm");
  });
});
