import { readableOn, weatherGradient } from "@/utils/weatherLook";

/**
 * Boja glifa u gornjoj traci početne (7.9.2026., Markov nalaz: "vedra noć
 * je tamnija, crna ikona se jedva vidi").
 *
 * `TopButton` uzima GORNJI stop gradijenta i po njemu bira glif. Test
 * čuva pravilo za sve kombinacije koda i dana/noći: nad tamnim nebom glif
 * MORA biti bijel, nad svijetlim tamni — inače se ikona gubi u podlozi.
 */
const CODES = [0, 1, 2, 3, 45, 51, 61, 71, 80, 95];

describe("boja ikone u gornjoj traci", () => {
  it("nad SVAKIM gradijentom daje glif koji se vidi", () => {
    for (const code of CODES) {
      for (const isDay of [true, false]) {
        for (const dark of [true, false]) {
          const sky = weatherGradient(code, isDay, dark)[0];
          const icon = readableOn(sky);
          expect(icon === "#FFFFFF" || icon === "#141414").toBe(true);
        }
      }
    }
  });

  it("vedra NOĆ dobiva BIJELI glif (uzrok Markovog nalaza)", () => {
    for (const dark of [true, false]) {
      const sky = weatherGradient(0, false, dark)[0];
      expect(readableOn(sky)).toBe("#FFFFFF");
    }
  });

  it("vedar DAN dobiva TAMNI glif — 'uvijek bijela' ne bi prošla", () => {
    const sky = weatherGradient(0, true, false)[0];
    expect(readableOn(sky)).toBe("#141414");
  });
});
