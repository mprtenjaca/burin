import { expandQuery, geocode } from "../openMeteo";

jest.mock("../client", () => ({ fetchJson: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const client = require("../client") as { fetchJson: jest.Mock };

/**
 * Oblik odgovora Open-Meteo geokodiranja (`language=hr`). Dvije Vrane —
 * upravo slučaj koji je 9.9.2026. zbunio: bez `admin1` u `Place` red u
 * tražilici piše „Vrana · Hrvatska" dvaput.
 */
const RESPONSE = {
  results: [
    {
      id: 1,
      name: "Vrana",
      latitude: 44.85,
      longitude: 14.35,
      country: "Hrvatska",
      country_code: "HR",
      admin1: "Primorsko-goranska županija",
    },
    {
      id: 2,
      name: "Vrana",
      latitude: 43.95,
      longitude: 15.55,
      country: "Hrvatska",
      country_code: "HR",
      admin1: "Zadarska županija",
    },
    {
      id: 3,
      name: "Vrana",
      latitude: 50.1,
      longitude: 14.4,
      country: "Češka",
      country_code: "CZ",
      // bez admin1 — mora preživjeti
    },
  ],
};

describe("geocode", () => {
  beforeEach(() => client.fetchJson.mockReset());

  it("prenosi županiju (admin1) u Place.region", async () => {
    client.fetchJson.mockResolvedValue(RESPONSE);
    const out = await geocode("Vrana");
    const regions = out.filter((p) => p.countryCode === "HR").map((p) => p.region);
    expect(regions).toEqual(["Primorsko-goranska županija", "Zadarska županija"]);
  });

  it("bez admin1 region je undefined, ne pada", async () => {
    client.fetchJson.mockResolvedValue(RESPONSE);
    const out = await geocode("Vrana");
    expect(out.find((p) => p.countryCode === "CZ")?.region).toBeUndefined();
  });

  it("hrvatska mjesta i dalje idu na vrh", async () => {
    client.fetchJson.mockResolvedValue(RESPONSE);
    const out = await geocode("Vrana");
    expect(out.map((p) => p.countryCode)).toEqual(["HR", "HR", "CZ"]);
  });

  it("traži na hrvatskom jeziku", async () => {
    client.fetchJson.mockResolvedValue({ results: [] });
    await geocode("Zadar");
    expect(client.fetchJson.mock.calls[0]![0]).toContain("language=hr");
  });
});

describe("expandQuery — kratica Sv", () => {
  /**
   * Markov nalaz 9.9.2026.: „Sv Filip i Jakov ne izbaci ništa". Open-Meteo
   * traži po PREFIKSU punog imena, a izmjereno je da „Sv Filip i Jakov",
   * „Sv. Filip i Jakov", „Sv Juraj" i „Sv Nedelja" vraćaju NULU dok puni
   * oblici nalaze mjesto.
   */
  it("dodaje oba roda uz izvorni upit", () => {
    expect(expandQuery("Sv Filip i Jakov")).toEqual([
      "Sv Filip i Jakov",
      "Sveti Filip i Jakov",
      "Sveta Filip i Jakov",
    ]);
  });

  it("radi i s točkom, i bez obzira na velika slova", () => {
    expect(expandQuery("Sv. Juraj")).toEqual(["Sv. Juraj", "Sveti Juraj", "Sveta Juraj"]);
    expect(expandQuery("sv nedelja")).toEqual([
      "sv nedelja",
      "Sveti nedelja",
      "Sveta nedelja",
    ]);
  });

  /**
   * „Sv" mora biti SAMOSTALNA prva riječ — inače bi „Sveta Nedelja" i
   * „Svetvinčenat" dobili besmislena proširenja.
   */
  it("ne dira imena koja samo počinju na sv", () => {
    for (const q of ["Sveta Nedelja", "Svetvinčenat", "Sveti Juraj", "Split"]) {
      expect(expandQuery(q)).toEqual([q]);
    }
  });

  it("obični upit i sam Sv ostaju jedan upit", () => {
    expect(expandQuery("  Zadar ")).toEqual(["Zadar"]);
    expect(expandQuery("Sv")).toEqual(["Sv"]);
    expect(expandQuery("Sv.")).toEqual(["Sv."]);
  });
});

describe("geocode — spajanje proširenih upita", () => {
  beforeEach(() => client.fetchJson.mockReset());

  const place = (name: string, lat: number, lon: number) => ({
    id: 1,
    name,
    latitude: lat,
    longitude: lon,
    country: "Hrvatska",
    country_code: "HR",
    admin1: "Zadarska županija",
  });

  it("kratica nađe mjesto koje izvorni upit ne bi", async () => {
    client.fetchJson
      .mockResolvedValueOnce({ results: [] }) // "Sv Filip i Jakov" — nula
      .mockResolvedValueOnce({ results: [place("Sveti Filip i Jakov", 43.96, 15.42)] })
      .mockResolvedValueOnce({ results: [] }); // "Sveta …" — nula
    const out = await geocode("Sv Filip i Jakov");
    expect(out.map((p) => p.name)).toEqual(["Sveti Filip i Jakov"]);
    expect(client.fetchJson).toHaveBeenCalledTimes(3);
  });

  /** Isto mjesto iz dva upita smije se pojaviti samo jednom. */
  it("ne duplicira isto mjesto", async () => {
    const p = place("Sveti Juraj", 44.92, 14.9);
    client.fetchJson
      .mockResolvedValueOnce({ results: [p] })
      .mockResolvedValueOnce({ results: [p] })
      .mockResolvedValueOnce({ results: [] });
    const out = await geocode("Sv Juraj");
    expect(out).toHaveLength(1);
  });

  /**
   * Proširenje koje padne ne smije oboriti pretragu koju je korisnik
   * zatražio — inače bi kratica bila lošija od punog imena.
   */
  it("pad proširenog upita ne ruši rezultat", async () => {
    client.fetchJson
      .mockResolvedValueOnce({ results: [place("Sveti Petar", 45.1, 14.0)] })
      .mockRejectedValueOnce(new Error("HTTP 429"))
      .mockRejectedValueOnce(new Error("HTTP 429"));
    const out = await geocode("Sv Petar");
    expect(out.map((p) => p.name)).toEqual(["Sveti Petar"]);
  });

  it("obični upit ide jednim pozivom, kao prije", async () => {
    client.fetchJson.mockResolvedValue({ results: [] });
    await geocode("Zadar");
    expect(client.fetchJson).toHaveBeenCalledTimes(1);
  });
});
