/*
 * AsyncStorage je NATIVAN i u testovima ne postoji ("NativeModule:
 * AsyncStorage is null") — isto pravilo koje je već naučeno na
 * `MapTimeline`. Ovdje se store ipak testira, jer je `refreshCurrent`
 * čista logika nad objektom, pa je dovoljno podmetnuti prazan modul.
 *
 * `persist` time radi nad memorijom: ništa se ne piše na disk, a
 * ponašanje koje se provjerava (što se mijenja, a što ostaje) je
 * netaknuto.
 */
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import type { CurrentWeather, WeatherBundle } from "@/api/types";
import { useLastWeather } from "@/store/lastWeather";

/**
 * OSVJEŽAVANJE KEŠIRANIH TEMPERATURA (8.8.2026.).
 *
 * Ladica i tražilica čitaju temperaturu po gradu iz ovog keša. Dosad ga
 * je punio jedino puni dohvat za OTVORENO mjesto, pa je uz neotvorene
 * gradove stajala brojka od zadnjeg puta — a izgledala je kao trenutna.
 *
 * `refreshCurrent` smije dirati SAMO `current` i `fetchedAt`: prognoza je
 * skupa za dohvatiti i za popis nevažna, ali offline ekran bez nje pada.
 */

const current = (temp: number): CurrentWeather => ({
  temp,
  feelsLike: temp,
  code: 0,
  isDay: true,
  windSpeed: 3,
  windGusts: 5,
  windDir: 180,
  humidity: 50,
  pressure: 1013,
  cloudCover: 10,
  precipitation: 0,
});

const bundle = (id: string, temp: number): WeatherBundle =>
  ({
    place: { id, name: id, lat: 45, lon: 15, country: "HR" },
    current: current(temp),
    hourly: [{ time: "2026-08-07T15:00" }],
    hourlyAll: [],
    daily: [{ tMax: 30, tMin: 18 }],
    fetchedAt: 1000,
  }) as unknown as WeatherBundle;

beforeEach(() => {
  useLastWeather.setState({ byPlaceId: {} });
});

describe("refreshCurrent", () => {
  it("mijenja trenutno stanje, a prognozu OSTAVLJA", () => {
    useLastWeather.setState({ byPlaceId: { zg: bundle("zg", 20) } });

    useLastWeather.getState().refreshCurrent({ zg: current(28) });

    const after = useLastWeather.getState().byPlaceId.zg!;
    expect(after.current.temp).toBe(28);
    // Prognoza mora preživjeti — bez nje offline ekran nema što crtati.
    expect(after.hourly).toHaveLength(1);
    expect(after.daily).toHaveLength(1);
    // Vrijeme dohvata prati novu vrijednost ("Podaci od HH:mm").
    expect(after.fetchedAt).toBeGreaterThan(1000);
  });

  it("ne stvara mjesta kojih u kešu nema", () => {
    useLastWeather.getState().refreshCurrent({ nepoznat: current(25) });
    expect(useLastWeather.getState().byPlaceId.nepoznat).toBeUndefined();
  });

  it("dira SAMO navedena mjesta", () => {
    useLastWeather.setState({
      byPlaceId: { zg: bundle("zg", 20), st: bundle("st", 30) },
    });

    useLastWeather.getState().refreshCurrent({ zg: current(21) });

    expect(useLastWeather.getState().byPlaceId.zg!.current.temp).toBe(21);
    expect(useLastWeather.getState().byPlaceId.st!.current.temp).toBe(30);
  });

  /*
   * Bez promjene se stanje NE smije zamijeniti novim objektom: zustand bi
   * inače obavijestio sve pretplatnike i ladica bi se prerenderirala pri
   * svakom neuspjelom pokušaju (npr. kad padne kvota).
   */
  it("prazan ili neprimjenjiv unos ne mijenja referencu stanja", () => {
    useLastWeather.setState({ byPlaceId: { zg: bundle("zg", 20) } });
    const before = useLastWeather.getState().byPlaceId;

    useLastWeather.getState().refreshCurrent({});
    expect(useLastWeather.getState().byPlaceId).toBe(before);

    useLastWeather.getState().refreshCurrent({ nepoznat: current(9) });
    expect(useLastWeather.getState().byPlaceId).toBe(before);
  });
});
