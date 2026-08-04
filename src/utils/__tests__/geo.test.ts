import { haversineKm } from "../geo";

describe("haversineKm", () => {
  it("ista točka je 0 km", () => {
    expect(haversineKm({ lat: 45.815, lon: 15.982 }, { lat: 45.815, lon: 15.982 })).toBe(0);
  });

  it("Zagreb–Split je oko 250 km", () => {
    const d = haversineKm(
      { lat: 45.815, lon: 15.982 },
      { lat: 43.508, lon: 16.44 },
    );
    expect(d).toBeGreaterThan(240);
    expect(d).toBeLessThan(275);
  });
});
