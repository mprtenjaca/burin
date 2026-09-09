import { geocode } from "../openMeteo";

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
