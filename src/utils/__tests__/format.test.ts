import {
  clockTime,
  convertTemp,
  convertWind,
  formatDay,
  formatHour,
  formatTime,
  windDirLabel,
} from "../format";

describe("format (hrvatski, 24-satni)", () => {
  it("formatDay: 'utorak, 4.8.'", () => {
    expect(formatDay("2026-08-04T14:00")).toBe("utorak, 4.8.");
    expect(formatDay("2026-08-09")).toBe("nedjelja, 9.8.");
  });

  it("formatTime: 24-satni s vodećom nulom", () => {
    expect(formatTime("2026-08-04T09:05")).toBe("09:05");
    expect(formatTime("2026-08-04T16:00")).toBe("16:00");
  });

  it("formatHour: samo sat", () => {
    expect(formatHour("2026-08-04T09:00")).toBe("09");
    expect(formatHour("2026-08-04T23:00")).toBe("23");
  });

  it("clockTime: epoch ms u 'HH:mm' (lokalno)", () => {
    const d = new Date(2026, 7, 4, 8, 7); // lokalno 08:07
    expect(clockTime(d.getTime())).toBe("08:07");
  });

  it("convertTemp", () => {
    expect(convertTemp(20, "C")).toBe(20);
    expect(convertTemp(0, "F")).toBe(32);
    expect(convertTemp(30, "F")).toBe(86);
  });

  it("convertWind", () => {
    expect(convertWind(15, "kmh")).toBe(15);
    expect(convertWind(36, "ms")).toBe(10);
  });

  it("windDirLabel: hrvatske kratice", () => {
    expect(windDirLabel(0)).toBe("S");
    expect(windDirLabel(90)).toBe("I");
    expect(windDirLabel(180)).toBe("J");
    expect(windDirLabel(225)).toBe("JZ");
    expect(windDirLabel(359)).toBe("S");
  });
});
