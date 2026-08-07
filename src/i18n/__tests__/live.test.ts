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

  /*
   * ČETIRI STRANE SVIJETA NA KOMPASU (8.8.2026.).
   *
   * `Compass` u `BentoGrid` ih crta iz `t.windDirs` po indeksu kut/45°.
   * Bile su tvrdo upisane kao "S"/"I"/"J"/"Z", pa je krug ostajao
   * hrvatski i na engleskom — a to nije samo nesklad: hrvatski "S" je
   * SJEVER, engleski "S" je JUG, dakle neprevedeni krug je pokazivao
   * suprotan smjer.
   *
   * Provjeravaju se baš ta četiri indeksa jer ih kompas koristi izravno.
   */
  it("strane svijeta na kompasu prate jezik", () => {
    setActiveLanguage("hr");
    expect([t.windDirs[0], t.windDirs[2], t.windDirs[4], t.windDirs[6]]).toEqual([
      "S",
      "I",
      "J",
      "Z",
    ]);

    setActiveLanguage("en");
    expect([t.windDirs[0], t.windDirs[2], t.windDirs[4], t.windDirs[6]]).toEqual([
      "N",
      "E",
      "S",
      "W",
    ]);
  });

  /*
   * DHMZ šalje MEĐUNARODNE kratice ("N", "E"), pa ih kartica mora
   * mapirati u jezik sučelja. Ovdje se provjerava sam rječnik na
   * indeksima koje koristi `DIR_INDEX` u `DhmzCard`: DHMZ-ov "S" (south)
   * je indeks 4, što je hrvatski "J" — nikako hrvatski "S".
   */
  it("DHMZ-ov S (south) postaje J na hrvatskom, ostaje S na engleskom", () => {
    setActiveLanguage("hr");
    expect(t.windDirs[4]).toBe("J");
    setActiveLanguage("en");
    expect(t.windDirs[4]).toBe("S");
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
