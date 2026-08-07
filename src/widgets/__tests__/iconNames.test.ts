import { iconForWeather, WIDGET_ICON_NAMES } from "../iconNames";

/**
 * Ikone widgeta (7.8.2026.). Čista tablica, pa se testira — pogrešno
 * mapiranje se na uređaju vidi samo ako se to vrijeme baš tada dogodi
 * (snijeg u kolovozu se ne može dočekati).
 */
describe("iconForWeather", () => {
  it("vedro danju je sunce, noću mjesec sa zvijezdama", () => {
    expect(iconForWeather(0, true)).toBe("sun");
    expect(iconForWeather(0, false)).toBe("night");
    expect(iconForWeather(1, true)).toBe("sun");
    expect(iconForWeather(1, false)).toBe("night");
  });

  it("djelomično oblačno danju ima sunce s oblakom", () => {
    expect(iconForWeather(2, true)).toBe("partly");
  });

  it("noćna naoblaka uvijek ide na mjesec s oblakom", () => {
    // Paleta ima JEDNU noćnu oblačnu, ali ikona razlikuje 2 i 3 — oboje
    // noću završi na istoj ikoni, jer mjesec + oblak pokriva oba.
    expect(iconForWeather(2, false)).toBe("night-cloudy");
    expect(iconForWeather(3, false)).toBe("night-cloudy");
  });

  it("magla ima svoju ikonu, ne dijeli je s naoblakom", () => {
    // Magla dijeli PALETU s oblačnim, ali vizualno je posve druga stvar.
    expect(iconForWeather(45, true)).toBe("fog");
    expect(iconForWeather(48, true)).toBe("fog");
    expect(iconForWeather(3, true)).toBe("cloud");
  });

  it("kiša pokriva i rosulju i pljuskove", () => {
    expect(iconForWeather(51, true)).toBe("rain");
    expect(iconForWeather(63, true)).toBe("rain");
    expect(iconForWeather(67, true)).toBe("rain");
    // 80–82 su pljuskovi i NISU snijeg, iako su unutar 71–86.
    expect(iconForWeather(80, true)).toBe("rain");
    expect(iconForWeather(82, true)).toBe("rain");
  });

  it("snijeg pokriva zrnca i snježne pljuskove, ali ne kišne", () => {
    expect(iconForWeather(71, true)).toBe("snow");
    expect(iconForWeather(77, true)).toBe("snow");
    expect(iconForWeather(85, true)).toBe("snow");
    expect(iconForWeather(86, true)).toBe("snow");
  });

  it("grmljavina ima munju", () => {
    expect(iconForWeather(95, true)).toBe("thunder");
    expect(iconForWeather(99, true)).toBe("thunder");
    // I noću — munja je munja, mjesec se ne vidi kroz grmljavinu.
    expect(iconForWeather(95, false)).toBe("thunder");
  });

  it("nepoznat kod ne pada, nego da naoblaku po dobu dana", () => {
    expect(iconForWeather(999, true)).toBe("cloud");
    expect(iconForWeather(999, false)).toBe("night-cloudy");
  });

  it("svaka vraćena ikona postoji u popisu datoteka", () => {
    /*
     * Ovo je prava zaštita: ime koje nije u `WIDGET_ICON_NAMES` znači da
     * PNG ne postoji, pa bi widget tražio datoteku koje nema i ostao bez
     * ikone — bez ijedne greške u konzoli.
     */
    const codes = [0, 1, 2, 3, 45, 48, 51, 61, 71, 80, 85, 95, 99, 999];
    for (const code of codes) {
      for (const isDay of [true, false]) {
        expect(WIDGET_ICON_NAMES).toContain(iconForWeather(code, isDay));
      }
    }
  });
});
