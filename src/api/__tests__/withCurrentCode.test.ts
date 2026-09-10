import type { HourlyPoint } from "../types";
import { withCurrentCode } from "../weather";

/**
 * Prvi stupac trake sati nosi ISTI kod kao heroj (10.9.2026.) — isto
 * pravilo koje za temperaturu već vrijedi. Heroj piše ono što radar i
 * postaja mjere; traka je iz modela, pa je znala crtati kišu dok heroj
 * kaže oblačno.
 */
const h = (time: string, code: number): HourlyPoint => ({ time, code } as unknown as HourlyPoint);
const now = new Date(2026, 8, 10, 13, 24);

describe("withCurrentCode", () => {
  it("mijenja kod SAMO tekućem satu, ostatak trake ostaje prognoza", () => {
    const hourly = [h("2026-09-10T13:00", 61), h("2026-09-10T14:00", 61), h("2026-09-10T15:00", 3)];
    const out = withCurrentCode(hourly, 3, now);
    expect(out.map((p) => p.code)).toEqual([3, 61, 3]);
    expect(out[1]).toBe(hourly[1]);
  });

  it("isti kod = ISTA referenca — memo(Hero) ne smije pucati uzalud", () => {
    const hourly = [h("2026-09-10T13:00", 3), h("2026-09-10T14:00", 61)];
    expect(withCurrentCode(hourly, 3, now)).toBe(hourly);
  });

  it("bez tekućeg sata u nizu (star niz) ne mijenja ništa", () => {
    const hourly = [h("2026-09-10T11:00", 61), h("2026-09-10T12:00", 61)];
    expect(withCurrentCode(hourly, 3, now)).toBe(hourly);
  });

  it("radi i s vlastitim razredom 3.5", () => {
    const out = withCurrentCode([h("2026-09-10T13:00", 95)], 3.5, now);
    expect(out[0]!.code).toBe(3.5);
  });
});
