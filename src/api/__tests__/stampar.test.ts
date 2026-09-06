import { readFileSync } from "fs";
import { join } from "path";

import {
  STAMPAR_CITIES,
  STAMPAR_MAX_KM,
  nearestStamparCity,
  parseStamparHtml,
  stamparFraction,
} from "../stampar";

/*
 * PARSER ŠTAMPAROVE STRANICE (razvojni izvor peludi, 6.9.2026.).
 *
 * Prvi test ide protiv ISJEČKA PRAVE STRANICE spremljenog 6.9.2026. — to
 * je jedini test koji zna kako stranica stvarno izgleda. Kad Štampar
 * promijeni HTML, ovaj test pukne prvi i kaže nam da parser treba doradu,
 * umjesto da aplikacija tiho padne na CAMS i nitko ne primijeti.
 */
const zagrebHtml = readFileSync(join(__dirname, "../__fixtures__/stampar-zagreb.html"), "utf8");

describe("parseStamparHtml — prava stranica (Zagreb, 6.9.2026.)", () => {
  const { days, unknownSpecies } = parseStamparHtml(zagrebHtml);

  it("daje tri dana, uzlazno", () => {
    expect(days.map((d) => d.date)).toEqual(["2026-09-06", "2026-09-07", "2026-09-08"]);
    expect(days.every((d) => d.source === "stampar")).toBe(true);
  });

  it("ambrozija: mjereno 8.0 = VISOKA, prognoza visoka oba dana", () => {
    // Ono što su Pliva i Štampar javljali dok je naš CAMS pisao "vrlo visoko".
    expect(days[0]!.graded?.ragweed?.grade).toBe(3);
    expect(days[0]!.levels.ragweed).toBe(8.0);
    expect(days[1]!.graded?.ragweed?.grade).toBe(3);
    expect(days[2]!.graded?.ragweed?.grade).toBe(3);
  });

  it("koprive i trputac postoje — vrste koje CAMS nema", () => {
    expect(days[0]!.graded?.nettle?.grade).toBe(2);
    expect(days[0]!.levels.nettle).toBe(4.0);
    expect(days[0]!.graded?.plantain?.grade).toBe(1);
    expect(days[0]!.levels.plantain).toBe(1.0);
  });

  it("trave: 1.1 = NISKA — i brojka ide PRAVOJ vrsti, ne susjednoj", () => {
    /*
     * Na stranici su Trputac (1.0) i Trave (1.1) susjedni blokovi s gotovo
     * istim brojkama. Prvi nacrt testa im je zamijenio vrijednosti — parser
     * je bio u pravu. Ovaj test čuva da regex ne "procuri" iz jednog bloka
     * vrste u sljedeći.
     */
    expect(days[0]!.graded?.grass?.grade).toBe(1);
    expect(days[0]!.levels.grass).toBe(1.1);
  });

  it("prognozni dani NEMAJU brojku — samo razred", () => {
    // Štampar brojku objavljuje samo za izmjereni dan.
    expect(days[1]!.levels.ragweed).toBeUndefined();
    expect(days[2]!.levels.ragweed).toBeUndefined();
  });

  it("sve vrste sa stranice su poznate", () => {
    expect(unknownSpecies).toEqual([]);
  });
});

/*
 * Ručni minimalni HTML — dokumentira TOČNO na što se parser oslanja, i
 * dopušta rubne slučajeve koje prava stranica danas ne pokazuje.
 */
function block(name: string, days: { date: string; text: string; cls: string; value?: string }[]): string {
  const measurements = days
    .map(
      (d) => `
      <div class="paragraph paragraph--type--mjerenje">
        <div class="field-field-datum-mjerenja field-type-string field-label-above">
          <div class="field-label">Datum mjerenja</div>
          <div class="field-item">${d.date}</div>
        </div>
        <div class="right allergy_indicator_level_${d.cls}">
          <div class="field-field-vrijednost-tekst field-type-string field-label-hidden">
            <div class="field-item">${d.text}</div>
          </div>
          ${
            d.value === undefined
              ? ""
              : `<div class="field-field-vrijednost field-type-string field-label-hidden">
            <div class="field-item">${d.value}</div>
          </div>`
          }
        </div>
      </div>`,
    )
    .join("");
  return `<div class="paragraph paragraph--type--biljka-grupa">
    <h2> <span>${name}</span></h2>
    ${measurements}
  </div>`;
}

describe("parseStamparHtml — rubni slučajevi", () => {
  it("prazan ili nepovezan HTML daje prazne dane, ne grešku", () => {
    expect(parseStamparHtml("").days).toEqual([]);
    expect(parseStamparHtml("<html><body>Održavanje</body></html>").days).toEqual([]);
  });

  it("'vrlo visoka' i 'nema peludi' se mapiraju, iako ih danas nema na stranici", () => {
    const html = block("Ambrozija (Ambrosia sp.)", [
      { date: "10.08.2026.", text: "vrlo visoka", cls: "very_high", value: "14.2" },
      { date: "11.08.2026.", text: "nema peludi", cls: "none" },
    ]);
    const { days } = parseStamparHtml(html);
    expect(days[0]!.graded?.ragweed?.grade).toBe(4);
    expect(days[1]!.graded?.ragweed?.grade).toBe(0);
  });

  it("kad tekst izostane, razred se čita iz klase", () => {
    const html = `<div class="paragraph--type--biljka-grupa"><h2><span>Trave (Poaceae)</span></h2>
      <div class="paragraph--type--mjerenje">
        <div class="field-field-datum-mjerenja"><div class="field-label">Datum</div><div class="field-item">06.09.2026.</div></div>
        <div class="right allergy_indicator_level_moderate"></div>
      </div></div>`;
    expect(parseStamparHtml(html).days[0]!.graded?.grass?.grade).toBe(2);
  });

  it("nepoznata vrsta se preskače i PRIJAVI, ostale prolaze", () => {
    const html =
      block("Kiselica (Rumex sp.)", [{ date: "06.09.2026.", text: "niska", cls: "low", value: "0.5" }]) +
      block("Ambrozija (Ambrosia sp.)", [{ date: "06.09.2026.", text: "visoka", cls: "high", value: "7.1" }]);
    const { days, unknownSpecies } = parseStamparHtml(html);
    expect(unknownSpecies).toEqual(["Kiselica (Rumex sp.)"]);
    expect(days[0]!.graded?.ragweed?.grade).toBe(3);
  });

  it("decimalni zarez se prihvaća kao i točka", () => {
    const html = block("Ambrozija (Ambrosia sp.)", [{ date: "06.09.2026.", text: "visoka", cls: "high", value: "6,6" }]);
    expect(parseStamparHtml(html).days[0]!.levels.ragweed).toBe(6.6);
  });

  it("neispravan datum se preskače, ne ruši", () => {
    const html = block("Ambrozija (Ambrosia sp.)", [{ date: "danas", text: "visoka", cls: "high" }]);
    expect(parseStamparHtml(html).days).toEqual([]);
  });

  it("breza/joha/maslina su poznate iako nisu u sezoni", () => {
    const html =
      block("Breza (Betula sp.)", [{ date: "01.04.2026.", text: "visoka", cls: "high", value: "9" }]) +
      block("Joha (Alnus sp.)", [{ date: "01.04.2026.", text: "niska", cls: "low", value: "1" }]) +
      block("Maslina (Olea europaea)", [{ date: "01.04.2026.", text: "umjerena", cls: "moderate", value: "3" }]);
    const { days, unknownSpecies } = parseStamparHtml(html);
    expect(unknownSpecies).toEqual([]);
    expect(days[0]!.graded?.birch?.grade).toBe(3);
    expect(days[0]!.graded?.alder?.grade).toBe(1);
    expect(days[0]!.graded?.olive?.grade).toBe(2);
  });
});

/*
 * MARKER NA NJIHOVOJ SKALI — isto pravilo kao `gradeFraction` za CAMS:
 * uvijek unutar polja svog razreda, tekst i točkica se ne mogu razići.
 */
describe("stamparFraction", () => {
  it("marker pada u polje svog razreda, na njihovoj skali 0–12+", () => {
    for (const [grade, values] of [
      [1, [0, 1, 1.9]],
      [2, [2, 4, 5.9]],
      [3, [6, 8, 11.9]],
      [4, [12, 18, 30]],
    ] as const) {
      for (const v of values) {
        const f = stamparFraction(grade, v);
        expect(f).toBeGreaterThanOrEqual((grade - 1) / 4);
        expect(f).toBeLessThanOrEqual(grade / 4);
      }
    }
  });

  it("bez brojke (prognoza) marker je u SREDINI polja", () => {
    expect(stamparFraction(3)).toBeCloseTo(0.625);
    expect(stamparFraction(1)).toBeCloseTo(0.125);
  });

  it("8.0 (Zagreb) stoji iznad 6.6 (Zadar) unutar iste 'visoke'", () => {
    expect(stamparFraction(3, 8.0)).toBeGreaterThan(stamparFraction(3, 6.6));
  });

  it("razred 0 je na nuli", () => {
    expect(stamparFraction(0, 0)).toBe(0);
  });
});

describe("nearestStamparCity", () => {
  it("Zadar i Zagreb se nađu po koordinatama, s pravim ID-evima sa stranice", () => {
    expect(nearestStamparCity(44.1194, 15.2314)?.id).toBe(25);
    expect(nearestStamparCity(45.815, 15.9819)?.id).toBe(26);
  });

  it("ID-evi NISU abecedni: Dubrovnik 4, Đakovo 5 — kako stranica kaže", () => {
    expect(STAMPAR_CITIES.find((c) => c.name === "Dubrovnik")?.id).toBe(4);
    expect(STAMPAR_CITIES.find((c) => c.name === "Đakovo")?.id).toBe(5);
  });

  it("Polača (24.8 km od Zadra) dobiva Zadar; sred Velebita nitko", () => {
    /*
     * Markov kraj. S dometom 25 km bi bio na rubu i ispadao po GPS šumu —
     * zato je domet 40 (jedan peludomjer po županiji). Koordinate su prave.
     */
    expect(nearestStamparCity(44.0128, 15.5039)?.name).toBe("Zadar");
    // Sjeverni Velebit — najbliži pokriveni grad je dalje od dometa.
    expect(nearestStamparCity(44.75, 14.98)).toBeUndefined();
  });

  it("izvan Hrvatske nema pogotka — tamo ostaje CAMS", () => {
    expect(nearestStamparCity(48.2082, 16.3738)).toBeUndefined(); // Beč
    expect(nearestStamparCity(46.0569, 14.5058)).toBeUndefined(); // Ljubljana
  });

  it("domet je 40 km — županija, ne 25 km kao za temperaturu", () => {
    expect(STAMPAR_MAX_KM).toBe(40);
  });
});
