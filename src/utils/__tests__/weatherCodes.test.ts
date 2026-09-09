import { Moon, Sun } from "lucide-react-native";

import { hr } from "@/i18n/hr";
import { codeToCondition, dhmzTextToCode } from "../weatherCodes";

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

describe("dhmzTextToCode", () => {
  /**
   * Povod (9.9.2026., Markov nalaz s prozora): app je za Zadar pisala
   * „djelomično oblačno" (WMO 2, model) dok je DHMZ na zadarskoj postaji
   * MJERIO „pretežno oblačno". Hrvatsko „pretežno" znači veći dio neba pod
   * oblacima — mora završiti kao „oblačno" (3), ne kao 2.
   */
  it("pretežno oblačno je OBLAČNO, ne djelomično", () => {
    expect(dhmzTextToCode("pretežno oblačno")).toBe(3);
    expect(dhmzTextToCode("umjereno oblačno")).toBe(2);
  });

  /** „pretežno vedro" sadrži i „vedro" — redoslijed provjera to mora paziti. */
  it("razlikuje pretežno vedro od vedra", () => {
    expect(dhmzTextToCode("vedro")).toBe(0);
    expect(dhmzTextToCode("pretežno vedro")).toBe(1);
    expect(dhmzTextToCode("pretežno vedro, vjetrovito")).toBe(1);
  });

  it("prepoznaje oborinu i grmljavinu", () => {
    expect(dhmzTextToCode("slaba kiša")).toBe(61);
    expect(dhmzTextToCode("grmljavina s oborinom")).toBe(95);
    expect(dhmzTextToCode("grmljavina bez oborina")).toBe(95);
  });

  /** Kiša pobjeđuje grmljavinu: to je ono što korisnik ima nad glavom. */
  it("kod mješanog opisa oborina ide prva", () => {
    expect(dhmzTextToCode("slaba kiša poslije grmlj.")).toBe(61);
  });

  /**
   * DHMZ u isto polje stavlja i opise VJETRA — oni ne govore ništa o nebu
   * i moraju prepustiti modelu, inače bi „lahor" pobrisao stanje neba.
   */
  it("opisi vjetra ne diraju stanje neba", () => {
    for (const s of ["lahor", "povjetarac", "slab vjetar"]) {
      expect(dhmzTextToCode(s)).toBeUndefined();
    }
  });

  it("prazno i nepoznato prepuštaju modelu", () => {
    for (const s of [undefined, "", "  ", "-", "nešto novo"]) {
      expect(dhmzTextToCode(s)).toBeUndefined();
    }
  });

  /**
   * Svi opisi iz PRAVOG feeda (`hrvatska_n.xml`, 9.9.2026., 66 postaja)
   * moraju biti pokriveni ili svjesno prepušteni modelu — nijedan ne smije
   * proći slučajno u krivi razred.
   */
  it("pokriva sve opise viđene u pravom feedu", () => {
    const seen: Record<string, number | undefined> = {
      "vedro": 0,
      "pretežno vedro": 1,
      "pretežno vedro, vjetrovito": 1,
      "umjereno oblačno": 2,
      "pretežno oblačno": 3,
      "slaba kiša": 61,
      "slaba kiša poslije grmlj.": 61,
      "grmljavina s oborinom": 95,
      "grmljavina bez oborina": 95,
      // vjetar — namjerno bez koda
      "lahor": undefined,
      "povjetarac": undefined,
      "slab vjetar": undefined,
      "-": undefined,
    };
    for (const [text, code] of Object.entries(seen)) {
      expect(dhmzTextToCode(text)).toBe(code);
    }
  });
});
