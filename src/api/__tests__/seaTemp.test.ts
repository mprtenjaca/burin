import { fetchSeaTemperature } from "../openMeteo";

function mockFetchJson(body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("fetchSeaTemperature", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("vraća broj za obalno mjesto", async () => {
    mockFetchJson({ current: { sea_surface_temperature: 27.6 } });
    await expect(fetchSeaTemperature(43.508, 16.44)).resolves.toBe(27.6);
  });

  it("null za kopno (Zagreb) postaje undefined, ne 0", async () => {
    mockFetchJson({ current: { sea_surface_temperature: null } });
    await expect(fetchSeaTemperature(45.815, 15.982)).resolves.toBeUndefined();
  });

  it("nedostajuće polje je undefined", async () => {
    mockFetchJson({ current: {} });
    await expect(fetchSeaTemperature(45.815, 15.982)).resolves.toBeUndefined();
  });

  it("greška mreže ne baca iznimku", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    await expect(fetchSeaTemperature(43.5, 16.4)).resolves.toBeUndefined();
  });
});
