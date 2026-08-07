import type { CurrentWeather, DailyPoint, HourlyPoint, WeatherBundle } from "@/api/types";

import { widgetEntries } from "../widgetData";

/**
 * Podaci za widget (7.8.2026.). Čista logika, bez nativnog modula —
 * `widgetData` zato izvozi `widgetEntries` odvojeno od `pushWidget`,
 * koji dira `expo-widgets` i u testu nije dostupan.
 *
 * `BurinWidget.tsx` se NE uvozi ovdje ni posredno: on vuče
 * `@expo/ui/swift-ui`, koji je nativan. Zato je `widgetEntries` u
 * `widgetData.ts`, a ne u datoteci widgeta.
 */

const NOW = Date.parse("2026-08-07T12:00:00");

/**
 * Sat u nizu `hourly`, u LOKALNOM ISO obliku kakav vraća Open-Meteo
 * ("2026-08-07T13:00", bez zone).
 *
 * Gradi se ručno iz lokalnih komponenti, NE preko `toISOString()`: taj
 * vraća UTC, pa bi u zoni +02:00 sat "13:00" ispao kao "11:00" i onda se
 * pri parsiranju pročitao kao 11:00 LOKALNO — dakle sat u prošlost.
 * Filtar budućih sati bi ih tada sve odbacio, a test bi krivo pokazivao
 * na kod (provjereno 7.8.2026.).
 */
function hour(offset: number, temp: number, code = 0, isDay = true): HourlyPoint {
  const at = new Date(NOW + offset * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  const iso =
    `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}` +
    `T${p(at.getHours())}:${p(at.getMinutes())}`;
  return {
    time: iso,
    temp,
    feelsLike: temp,
    code,
    isDay,
    precip: 0,
    precipProb: 0,
    windSpeed: 5,
    windDir: 0,
    windGusts: 10,
    humidity: 50,
    pressure: 1013,
    cloudCover: 0,
    uv: 3,
    visibility: 20000,
  };
}

const current: CurrentWeather = {
  temp: 24,
  feelsLike: 25,
  code: 0,
  isDay: true,
  windSpeed: 10,
  windGusts: 18,
  windDir: 180,
  humidity: 50,
  pressure: 1013,
  cloudCover: 10,
  precipitation: 0,
};

const today: DailyPoint = {
  date: "2026-08-07",
  code: 0,
  tMin: 18,
  tMax: 30,
  sunrise: "2026-08-07T05:50",
  sunset: "2026-08-07T20:10",
  precipSum: 0,
  precipProbMax: 0,
  uvMax: 8,
  windMax: 20,
};

function bundle(over: Partial<WeatherBundle> = {}): WeatherBundle {
  return {
    place: { id: "44.000,15.000", name: "Polača", lat: 44, lon: 15 },
    current,
    hourly: [hour(0, 24), hour(1, 25), hour(2, 23)],
    hourlyAll: [],
    daily: [today],
    fetchedAt: NOW,
    ...over,
  };
}

describe("widgetEntries", () => {
  it("prvi unos nosi TRENUTNO stanje", () => {
    const [first] = widgetEntries(bundle(), "C", "ms", NOW);
    expect(first.props.temp).toBe(24);
    expect(first.props.place).toBe("Polača");
    expect(first.date.getTime()).toBe(NOW);
  });

  it("preskače sate u prošlosti i tekući sat (bez dvostrukog datuma)", () => {
    /*
     * `hourly[0]` je tekući sat i već ga pokriva unos iz `current`. Dva
     * unosa s istim datumom su za iOS neispravna crta.
     */
    const entries = widgetEntries(bundle(), "C", "ms", NOW);
    const times = entries.map((e) => e.date.getTime());
    expect(new Set(times).size).toBe(times.length);
    expect(times.every((at) => at >= NOW)).toBe(true);
  });

  it("budući unosi nose svoju temperaturu, ne trenutnu", () => {
    const entries = widgetEntries(bundle(), "C", "ms", NOW);
    expect(entries.map((e) => e.props.temp)).toEqual([24, 25, 23]);
  });

  it("gradijent ima tri stopa", () => {
    const [first] = widgetEntries(bundle(), "C", "ms", NOW);
    expect(first.props.stops).toHaveLength(3);
  });

  it("SVAKO vrijeme dobiva bijeli tekst — widget je uvijek taman", () => {
    /*
     * Widget ima JEDNU verziju (odluka 7.8.2026.), pa su sve palete
     * potamnjene dok bijeli tekst ne prođe prag 4.5:1. Vedar dan je zato
     * plavo nebo, ne žuto sunce — potamnjena žuta izgleda kao prašina.
     *
     * Ovo je prava zaštita ove odluke: ako netko vrati svijetlu paletu,
     * `readableOn` će vratiti tamni tekst i test pada.
     */
    const cases = [
      { code: 0, isDay: true }, // vedro
      { code: 2, isDay: true }, // djelomično
      { code: 3, isDay: true }, // oblačno
      { code: 63, isDay: true }, // kiša
      { code: 73, isDay: true }, // snijeg
      { code: 95, isDay: true }, // grmljavina
      { code: 0, isDay: false }, // vedra noć
      { code: 3, isDay: false }, // oblačna noć
    ];
    for (const c of cases) {
      const b = bundle({ current: { ...current, code: c.code, isDay: c.isDay } });
      expect(widgetEntries(b, "C", "ms", NOW)[0].props.fg).toBe("#FFFFFF");
    }
  });

  it("udari ispod praga daju null, iznad praga broj u m/s", () => {
    // Prag je 36 km/h (10 m/s) — ispod njega značke nema.
    const calm = bundle({ current: { ...current, windGusts: 20 } });
    expect(widgetEntries(calm, "C", "ms", NOW)[0].props.gusts).toBeNull();

    const windy = bundle({ current: { ...current, windGusts: 72 } });
    // 72 km/h = 20 m/s
    expect(widgetEntries(windy, "C", "ms", NOW)[0].props.gusts).toBe(20);
  });

  it("Fahrenheit pretvara i temperaturu i raspon, uz slovo u jedinici", () => {
    const [first] = widgetEntries(bundle(), "F", "ms", NOW);
    expect(first.props.temp).toBe(75); // 24 °C
    expect(first.props.tMax).toBe(86); // 30 °C
    expect(first.props.tMin).toBe(64); // 18 °C
    expect(first.props.unit).toBe("°F");
  });

  it("Celzijus nema slovo, samo kružić", () => {
    const [first] = widgetEntries(bundle(), "C", "ms", NOW);
    expect(first.props.unit).toBe("°");
  });

  it("vedar dan je PLAVO nebo, ne žuto sunce", () => {
    /*
     * Žuta iz aplikacije (#F4C542) ne trpi bijeli tekst — 1.63:1. Plava
     * prolazi (4.80:1) i vedar dan se čita kao vedro NEBO. Sunce ostaje
     * u ikoni i u zrakama, ne u podlozi.
     */
    const [first] = widgetEntries(bundle(), "C", "ms", NOW);
    expect(first.props.stops[0]).toBe("#3E76AA");
  });

  it("bez dnevnih podataka ne pada, nego pada na trenutnu temperaturu", () => {
    const noDaily = bundle({ daily: [] });
    const [first] = widgetEntries(noDaily, "C", "ms", NOW);
    expect(first.props.tMax).toBe(24);
    expect(first.props.tMin).toBe(24);
  });

  it("crta je ograničena na 12 budućih sati", () => {
    const many = bundle({
      hourly: Array.from({ length: 24 }, (_, i) => hour(i, 20 + (i % 5))),
    });
    // 1 trenutni + najviše 12 budućih.
    expect(widgetEntries(many, "C", "ms", NOW)).toHaveLength(13);
  });
});
