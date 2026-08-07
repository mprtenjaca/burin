import { setActiveLanguage, t, currentLanguage } from "@/i18n";
import { formatDayShort, formatDay, windDirLabel } from "@/utils/format";
import { codeToCondition } from "@/utils/weatherCodes";

// Cetvrtak 6.8.2026.
const THU = "2026-08-06T12:00";

describe("zamjena jezika stvarno prolazi kroz cijeli lanac", () => {
  afterEach(() => setActiveLanguage("hr"));

  it("dani u 14-dnevnoj listi prate jezik", () => {
    setActiveLanguage("hr");
    expect(formatDayShort(THU)).toBe("čet 6.8.");
    setActiveLanguage("en");
    expect(formatDayShort(THU)).toBe("Thu 6.8.");
    expect(formatDay(THU)).toContain("Thursday");
  });

  it("smjer vjetra: istok je I na hrvatskom, E na engleskom", () => {
    setActiveLanguage("hr");
    expect(windDirLabel(90)).toBe("I");
    setActiveLanguage("en");
    expect(windDirLabel(90)).toBe("E");
  });

  it("imena vremena prate jezik", () => {
    setActiveLanguage("hr");
    expect(codeToCondition(95, true).label).toBe("Grmljavinsko nevrijeme");
    setActiveLanguage("en");
    expect(codeToCondition(95, true).label).toBe("Thunderstorm");
  });

  it("proxy se ponasa kao obican objekt", () => {
    setActiveLanguage("en");
    expect(currentLanguage()).toBe("en");
    expect(Object.keys(t)).toContain("warnings");
    expect("conditions" in t).toBe(true);
    expect(t.warnings.none).toBe("No warnings in effect");
  });
});
