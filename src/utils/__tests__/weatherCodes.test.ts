import { Moon, Sun } from "lucide-react-native";

import { hr } from "@/i18n/hr";
import { codeToCondition } from "../weatherCodes";

describe("codeToCondition", () => {
  const knownCodes = [
    0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75,
    77, 80, 81, 82, 85, 86, 95, 96, 99,
  ];

  it("mapira svaki poznati WMO kod u hrvatski naziv i ikonu", () => {
    for (const code of knownCodes) {
      const day = codeToCondition(code, true);
      const night = codeToCondition(code, false);
      expect(day.label).not.toBe(hr.common.noData);
      expect(day.label.length).toBeGreaterThan(2);
      expect(day.Icon).toBeDefined();
      expect(night.Icon).toBeDefined();
    }
  });

  it("razlikuje dan i noć za vedro (0)", () => {
    expect(codeToCondition(0, true).label).toBe(hr.conditions.clear);
    expect(codeToCondition(0, true).Icon).toBe(Sun);
    expect(codeToCondition(0, false).Icon).toBe(Moon);
  });

  it("razlikuje intenzitet kiše (61/63/65)", () => {
    expect(codeToCondition(61, true).label).toBe(hr.conditions.rainLight);
    expect(codeToCondition(63, true).label).toBe(hr.conditions.rain);
    expect(codeToCondition(65, true).label).toBe(hr.conditions.rainHeavy);
  });

  it("nepoznat kod vraća 'Nema podataka' s ikonom", () => {
    const unknown = codeToCondition(42, true);
    expect(unknown.label).toBe(hr.common.noData);
    expect(unknown.Icon).toBeDefined();
  });
});
