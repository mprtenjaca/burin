import {
  clockTime,
  convertTemp,
  convertWind,
  formatDay,
  formatDayShort,
  formatHour,
  formatTime,
  futureHours,
  windDirLabel,
} from "../format";

/*
 * REZ TRAKE SATI PREMA ŽIVOM SATU (8.8.2026.).
 *
 * `hourly` se gradi pri DOHVATU i stoji do 30 minuta, pa je u 15:40 prva
 * kolona bila „15" — sat koji već traje, s prognozom od 15:00. Na uređaju
 * se to vidjelo kao „piše kiša, a vani je pretežno vedro".
 */
describe("futureHours", () => {
  const hours = [
    { time: "2026-08-07T15:00" },
    { time: "2026-08-07T16:00" },
    { time: "2026-08-07T17:00" },
  ];

  it("izbacuje sat koji TRAJE, prvi je sljedeći", () => {
    const at1540 = new Date(2026, 7, 7, 15, 40);
    expect(futureHours(hours, at1540)[0]).toEqual({ time: "2026-08-07T16:00" });
  });

  it("na početku sata je isto — 15:00 je prošlost čim je 15:00", () => {
    const at1500 = new Date(2026, 7, 7, 15, 0);
    expect(futureHours(hours, at1500)[0]).toEqual({ time: "2026-08-07T16:00" });
  });

  it("prelazi na sljedeći sat čim otkuca puni sat", () => {
    const at1559 = new Date(2026, 7, 7, 15, 59);
    const at1600 = new Date(2026, 7, 7, 16, 0);
    expect(futureHours(hours, at1559)[0]).toEqual({ time: "2026-08-07T16:00" });
    expect(futureHours(hours, at1600)[0]).toEqual({ time: "2026-08-07T17:00" });
  });

  it("kad su svi sati prošli, vraća zadnje poznato umjesto prazne trake", () => {
    const at2300 = new Date(2026, 7, 7, 23, 0);
    expect(futureHours(hours, at2300)).toEqual(hours);
  });
});

describe("format (hrvatski, 24-satni)", () => {
  it("formatDay: 'utorak, 4.8.'", () => {
    expect(formatDay("2026-08-04T14:00")).toBe("utorak, 4.8.");
    expect(formatDay("2026-08-09")).toBe("nedjelja, 9.8.");
  });

  it("formatDayShort: 'uto 4.8.'", () => {
    expect(formatDayShort("2026-08-04")).toBe("uto 4.8.");
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
