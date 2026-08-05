import { keepPreviousData } from "@tanstack/react-query";

/**
 * Regresija (5.8.2026., nađeno NA UREĐAJU): pri naglom odzumiranju bi na
 * slojevima Temperatura / Naoblaka / Vjetar nestao prikaz, a klizač i play
 * gumb problijedili i prestali raditi — na radaru ne.
 *
 * Uzrok: `queryKey` tih upita sadrži poziciju karte. Svaki pomak je pravio
 * NOVI ključ, `data` bi na tren bio `undefined`, pa bi vremenska crta ostala
 * bez koraka (`stepCount === 0` → kontrole `disabled`). Radar je bio pošteđen
 * jer njegovi okviri ne ovise o poziciji.
 *
 * Popravak: `placeholderData: keepPreviousData` — stari podaci ostaju dok
 * novi ne stignu. Ovaj test čuva tu postavku od tihog uklanjanja; sami
 * `useQuery` pozivi traže React okruženje pa se ovdje provjerava konfiguracija.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const timelineSrc = require("fs").readFileSync(
  require.resolve("../useTimelineHours"),
  "utf8",
) as string;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const windSrc = require("fs").readFileSync(
  require.resolve("../useWindGrid"),
  "utf8",
) as string;

describe("upiti karte zadržavaju podatke pri pomicanju", () => {
  it("keepPreviousData postoji u react-queryju pod tim imenom", () => {
    // Ako bi biblioteka preimenovala izvoz, provjere ispod bi lažno prolazile.
    expect(typeof keepPreviousData).toBe("function");
  });

  it("sati vremenske crte se ne gube pri promjeni centra karte", () => {
    expect(timelineSrc).toContain("placeholderData: keepPreviousData");
  });

  it("mreža vjetra se ne gubi pri promjeni kadra karte", () => {
    expect(windSrc).toContain("placeholderData: keepPreviousData");
  });

  /**
   * Ključevi MORAJU sadržavati poziciju (podaci ovise o njoj) — poanta
   * popravka nije bila maknuti poziciju iz ključa, nego preživjeti promjenu.
   */
  it("ključevi i dalje ovise o poziciji (podaci su vezani uz nju)", () => {
    expect(timelineSrc).toContain("map-timeline-hours");
    expect(timelineSrc).toMatch(/queryKey:.*rLat.*rLon/s);
    expect(windSrc).toContain("wind-grid");
  });
});
