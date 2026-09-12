import {
  clockTime,
  convertTemp,
  convertWind,
  formatDay,
  formatDayShort,
  formatHour,
  formatTime,
  futureHours,
  zoneLabel,
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

  /*
   * Traka je PROGNOZA (Markov odabir 11.9.2026.): sadašnjost je na heroju,
   * prošlost u 14-dnevnom sheetu. Prvi stupac je SLJEDEĆI sat.
   */
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
    expect(futureHours(hours, at1600)).toHaveLength(1);
  });

  /*
   * STRANI GRAD: rez ide po zoni MJESTA, ne uređaja (12.9.2026., Markov
   * nalaz na Sidneyju u Ohiju).
   *
   * Izmjereno tog dana: u Ohiju 08:11 (UTC−4), uređaj u Hrvatskoj 14:12
   * (UTC+2). Satni unosi dolaze u vremenu grada, pa je app „08:00 u
   * Ohiju" uspoređivala s hrvatskih 14:12 i rezala ga kao prošlost —
   * prvi stupac je bio 15:00 umjesto 09:00, SEST sati prognoze izgubljeno.
   */
  it("strani grad: reže po vremenu MJESTA, ne uređaja", () => {
    const ohio = [
      { time: "2026-09-12T08:00" },
      { time: "2026-09-12T09:00" },
      { time: "2026-09-12T15:00" },
    ];
    // Uređaj: 14:12 po svom satu. Mjesto: UTC−4, uređaj UTC+2 → 6 h manje.
    const deviceNow = new Date(2026, 8, 12, 14, 12);
    const offsetOhio = -4 * 3600;
    // Bez pomaka bi prvi stupac bio 15:00 (stari kvar).
    expect(futureHours(ohio, deviceNow)[0]).toEqual({ time: "2026-09-12T15:00" });
    // S pomakom: u Ohiju je 08:12, pa je sljedeći sat 09:00.
    const shifted = futureHours(ohio, deviceNow, offsetOhio);
    expect(shifted[0]).toEqual({ time: "2026-09-12T09:00" });
    expect(shifted).toHaveLength(2);
  });

  it("domaći grad: pomak jednak uređajevom ne mijenja ništa", () => {
    const at1540 = new Date(2026, 7, 7, 15, 40);
    const deviceOffset = -at1540.getTimezoneOffset() * 60;
    expect(futureHours(hours, at1540, deviceOffset)).toEqual(futureHours(hours, at1540));
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

/*
 * OZNAKA ZONE UZ SAT (12.9.2026., Markov zahtjev: „promijeni i hero sat
 * uz navedenu zonu pokraj sata za USA").
 *
 * Bez oznake „08:18" na heroju izgleda kao greška kad uređaj pokazuje
 * 14:18. Ispisuje se POMAK od UTC-a, ne kratica: „CST" je i Amerika i
 * Kina, a pomak je jednoznačan i ne treba prijevod.
 */
describe("zoneLabel", () => {
  // Uređaj u ovom testu je u zoni u kojoj se test vrti, pa se pomak čita.
  const now = new Date(2026, 8, 12, 14, 18);
  const deviceOffset = -now.getTimezoneOffset() * 60;

  it("domaći grad NEMA oznaku — ne govori ništa novo", () => {
    expect(zoneLabel(deviceOffset, now)).toBe("");
  });

  it("bez podatka o zoni nema oznake (stari keš)", () => {
    expect(zoneLabel(undefined, now)).toBe("");
  });

  it("Ohio: UTC−4", () => {
    expect(zoneLabel(-4 * 3600, now)).toBe("UTC−4");
  });

  it("Tokio: UTC+9", () => {
    expect(zoneLabel(9 * 3600, now)).toBe("UTC+9");
  });

  it("pola sata: Indija UTC+5:30", () => {
    expect(zoneLabel(5.5 * 3600, now)).toBe("UTC+5:30");
  });
});

describe("clockTime uz zonu mjesta", () => {
  it("bez pomaka je sat uređaja", () => {
    const at = new Date(2026, 8, 12, 14, 18).getTime();
    expect(clockTime(at)).toBe("14:18");
  });

  it("sa zonom Ohija pokazuje vrijeme MJESTA", () => {
    const at = new Date(2026, 8, 12, 14, 18);
    const deviceOffset = -at.getTimezoneOffset() * 60;
    // Ohio je 6 h iza Hrvatske (UTC−4 vs UTC+2) → 08:18.
    const shifted = clockTime(at.getTime(), -4 * 3600);
    const expected = new Date(at.getTime() - (deviceOffset + 4 * 3600) * 1000);
    expect(shifted).toBe(
      `${expected.getHours().toString().padStart(2, "0")}:${expected.getMinutes().toString().padStart(2, "0")}`,
    );
  });
});
