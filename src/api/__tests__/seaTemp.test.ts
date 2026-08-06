import { fetchSeaTemperature } from "../openMeteo";

function mockFetchJson(body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  }) as unknown as typeof fetch;
}

/**
 * Regresija (6.8.2026., nađeno na uređaju): funkcija je vraćala
 * `undefined` za kopnena mjesta, a react-query to zabranjuje — odabir
 * Zagreba je rušio ekran greškom "Query data cannot be undefined".
 * Zato je izostanak mora sada `null`.
 */
describe("fetchSeaTemperature", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("vraća broj za obalno mjesto", async () => {
    mockFetchJson({ current: { sea_surface_temperature: 27.6 } });
    await expect(fetchSeaTemperature(43.508, 16.44)).resolves.toBe(27.6);
  });

  it("kopno (Zagreb) daje null, ne undefined i ne 0", async () => {
    mockFetchJson({ current: { sea_surface_temperature: null } });
    await expect(fetchSeaTemperature(45.815, 15.982)).resolves.toBeNull();
  });

  it("nedostajuće polje daje null", async () => {
    mockFetchJson({ current: {} });
    await expect(fetchSeaTemperature(45.815, 15.982)).resolves.toBeNull();
  });

  it("greška mreže ne baca iznimku, daje null", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    await expect(fetchSeaTemperature(43.5, 16.4)).resolves.toBeNull();
  });

  it("nikad ne vraća undefined (react-query bi pukao)", async () => {
    for (const body of [
      { current: { sea_surface_temperature: null } },
      { current: {} },
      {},
    ]) {
      mockFetchJson(body);
      await expect(fetchSeaTemperature(45.8, 16)).resolves.not.toBeUndefined();
    }
  });
});
