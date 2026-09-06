import { mapLayerById } from "@/api/mapLayers";
import type { RadarFrame } from "@/api/types";
import type { TimelineHour } from "@/hooks/useTimelineHours";

import { dayJumps, nowStepIndex, timelineSteps } from "../MapTimeline";

const frames: RadarFrame[] = [
  { time: 1785882000, path: "/p1", isNowcast: false },
  { time: 1785883800, path: "/p2", isNowcast: false },
  { time: 1785885600, path: "/p3", isNowcast: true },
];

const hours: TimelineHour[] = [
  { time: "2026-08-05T12:00", temp: 29.4, cloudCover: 10, windSpeed: 12.3, isNow: false },
  { time: "2026-08-05T13:00", temp: 31.2, cloudCover: 40, windSpeed: 18.9, isNow: true },
  { time: "2026-08-05T14:00", temp: 30.8, cloudCover: 65, windSpeed: 22.1, isNow: false },
];

describe("timelineSteps — radar (okviri)", () => {
  const radar = mapLayerById("radar");

  it("daje jedan korak po okviru", () => {
    expect(timelineSteps(radar, frames, [])).toHaveLength(3);
  });

  it("nowcast okviri nose oznaku prognoze, izmjereni ne", () => {
    const steps = timelineSteps(radar, frames, []);
    expect(steps[0]!.note).toBeUndefined();
    expect(steps[2]!.note).toBe("prognoza");
  });

  it('zadnji izmjereni okvir je "sada", ne nowcast', () => {
    const steps = timelineSteps(radar, frames, []);
    expect(steps.map((s) => s.isNow)).toEqual([false, true, false]);
  });

  it("radi i kad nowcasta nema (izmjereno: RainViewer ga zna imati 0)", () => {
    const onlyPast = frames.filter((f) => !f.isNowcast);
    const steps = timelineSteps(radar, onlyPast, []);
    expect(steps).toHaveLength(2);
    expect(steps[1]!.isNow).toBe(true);
    expect(steps.every((s) => s.note === undefined)).toBe(true);
  });
});

describe("timelineSteps — OWM slojevi (sati)", () => {
  it("temperatura prikazuje stupnjeve za centar karte", () => {
    const steps = timelineSteps(mapLayerById("temp_new"), [], hours);
    expect(steps.map((s) => s.note)).toEqual(["29°", "31°", "31°"]);
  });

  it("naoblaka prikazuje postotak", () => {
    const steps = timelineSteps(mapLayerById("clouds_new"), [], hours);
    expect(steps[2]!.note).toBe("65 %");
  });

  it("vjetar prikazuje brzinu u zadanoj jedinici (m/s)", () => {
    const steps = timelineSteps(mapLayerById("wind_new"), [], hours);
    // 18.9 km/h / 3.6 = 5.25 m/s
    expect(steps[1]!.note).toBe("5 m/s");
  });

  /*
   * Jedinice iz postavki MORAJU stići do crte (popravak 6.8.2026.): prije
   * su ovdje išli sirovi °C i tvrdo upisan "km/h", pa je karta pokazivala
   * druge brojeve od ostatka aplikacije kad je odabran °F ili m/s.
   */
  it("poštuje odabrane jedinice", () => {
    const f = timelineSteps(mapLayerById("temp_new"), [], hours, {
      tempUnit: "F",
      windUnit: "kmh",
    });
    // 29.4 °C = 84.9 °F — i oznaka MORA reći da su Fahrenheiti.
    expect(f[0]!.note).toBe("85°F");

    const kmh = timelineSteps(mapLayerById("wind_new"), [], hours, {
      tempUnit: "C",
      windUnit: "kmh",
    });
    expect(kmh[1]!.note).toBe("19 km/h");
  });

  it("Celzijus ostaje bez slova, samo stupnjevi", () => {
    const steps = timelineSteps(mapLayerById("temp_new"), [], hours, {
      tempUnit: "C",
      windUnit: "ms",
    });
    expect(steps[0]!.note).toBe("29°");
  });

  it("sat se označava 24-satno, tekući je označen", () => {
    const steps = timelineSteps(mapLayerById("temp_new"), [], hours);
    expect(steps.map((s) => s.label)).toEqual(["12:00", "13:00", "14:00"]);
    expect(steps.map((s) => s.isNow)).toEqual([false, true, false]);
  });

  it("nedostupna vrijednost ne ruši korak", () => {
    const partial: TimelineHour[] = [{ time: "2026-08-05T12:00", isNow: false }];
    const steps = timelineSteps(mapLayerById("temp_new"), [], partial);
    expect(steps[0]!.label).toBe("12:00");
    expect(steps[0]!.note).toBeUndefined();
  });
});

/**
 * Tvrdi zahtjev: crta postoji na SVAKOM sloju. Ovo hvata regresiju u kojoj
 * bi novi sloj dobio praznu crtu jer mu vrsta nije pokrivena.
 */
describe("crta je prisutna na svim slojevima", () => {
  it("svaki sloj daje korake iz svog izvora", () => {
    for (const layer of ["radar", "temp_new", "clouds_new", "wind_new"] as const) {
      const steps = timelineSteps(mapLayerById(layer), frames, hours);
      expect(steps.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Sidro "Sada" (dorada 6.8.2026.): crta ide od prošlosti preko sada u
 * budućnost, pa play mora krenuti odavde, a ne s kraja niza.
 */
describe("nowStepIndex", () => {
  it("nalazi 'sada' u sredini niza sati", () => {
    const steps = timelineSteps(mapLayerById("temp_new"), [], hours);
    expect(nowStepIndex(steps)).toBe(1);
  });

  it("na radaru je 'sada' zadnji IZMJERENI okvir, prije nowcasta", () => {
    const steps = timelineSteps(mapLayerById("radar"), frames, []);
    expect(nowStepIndex(steps)).toBe(1);
  });

  it("bez 'sada' vraća -1 (crta se tada vrti cijela)", () => {
    const noNow: TimelineHour[] = hours.map((h) => ({ ...h, isNow: false }));
    expect(nowStepIndex(timelineSteps(mapLayerById("temp_new"), [], noNow))).toBe(-1);
    expect(nowStepIndex([])).toBe(-1);
  });
});

/*
 * DUGMAD DANA (6.9.2026.) — krupna meta za "pokaži mi sutra".
 *
 * Klizač preko 96 sati traži pogađanje; dugmad daju izravan skok, a klizač
 * ostaje za fino štimanje.
 */
describe("dayJumps", () => {
  /** Satni niz kroz tri dana; "sada" je 6.9. u 14 h. */
  const hours = [
    { time: "2026-09-06T00:00", isNow: false },
    { time: "2026-09-06T12:00", isNow: false },
    { time: "2026-09-06T14:00", isNow: true },
    { time: "2026-09-07T00:00", isNow: false },
    { time: "2026-09-07T12:00", isNow: false },
    { time: "2026-09-08T12:00", isNow: false },
    { time: "2026-09-08T23:00", isNow: false },
  ];

  it("jedan unos po danu, poredani", () => {
    const j = dayJumps(hours, 2);
    expect(j).toHaveLength(3);
    expect(j.map((d) => d.from)).toEqual([0, 3, 5]);
    expect(j.map((d) => d.to)).toEqual([2, 4, 6]);
  });

  it("današnje dugme skače na SADA, ostala na podne", () => {
    const j = dayJumps(hours, 2);
    // Današnje: tamo gdje je korisnik i inače krenuo.
    expect(j[0]!.index).toBe(2);
    // Sutra i prekosutra: podne, jer se po njemu dan prepoznaje.
    expect(j[1]!.index).toBe(4);
    expect(j[2]!.index).toBe(5);
  });

  /*
   * Podne se TRAŽI među koracima dana, ne računa kao `from + 12`: prvi dan
   * crte zna biti odrezan, pa bi računica pala u sljedeći dan.
   */
  it("dan bez podneva pada na svoj prvi korak, ne u susjedni dan", () => {
    const j = dayJumps(
      [
        { time: "2026-09-06T20:00", isNow: true },
        { time: "2026-09-06T21:00", isNow: false },
        { time: "2026-09-07T09:00", isNow: false },
      ],
      0,
    );
    expect(j[1]!.index).toBe(2);
    expect(j[1]!.index).toBeGreaterThanOrEqual(j[1]!.from);
    expect(j[1]!.index).toBeLessThanOrEqual(j[1]!.to);
  });

  /*
   * OZNAKE SU RELATIVNE NA DANAS (Markov odabir 6.9.2026.).
   *
   * Ime dana u prošlosti se pomiješa s istim danom sljedećeg tjedna, pa
   * jučer nosi "-24 h". Sutra ima svoju riječ jer je najčešća meta, a dalji
   * dani datum — "pon"/"uto" se pri kraju tjedna ne razlikuju od prošlih.
   */
  it("jučer je -24 h, sutra je riječ, dalji dani datum", () => {
    const j = dayJumps(
      [
        { time: "2026-09-05T12:00", isNow: false },
        { time: "2026-09-06T12:00", isNow: true },
        { time: "2026-09-07T12:00", isNow: false },
        { time: "2026-09-08T12:00", isNow: false },
      ],
      1,
    );
    expect(j.map((d) => d.label)).toEqual(["-24 h", "Sada", "Sutra", "8.9."]);
  });

  it("datum je bez vodećih nula", () => {
    const j = dayJumps(
      [
        { time: "2026-09-06T12:00", isNow: true },
        { time: "2026-09-09T12:00", isNow: false },
      ],
      0,
    );
    expect(j[1]!.label).toBe("9.9.");
  });

  /*
   * RASPONI SU CJELOVITI I NE PREKLAPAJU SE (6.9.2026.).
   *
   * Klizač od tada pokriva SAMO odabrani dan (`minimumValue`/`maximumValue`
   * iz `from`/`to`), pa rupa ili preklop među danima znači sate do kojih se
   * ne može doći ili koji se pojave dvaput.
   */
  it("rasponi dana pokrivaju cijeli niz, bez rupa i preklapanja", () => {
    const hrs: { time: string; isNow: boolean }[] = [];
    for (const d of ["05", "06", "07", "08"]) {
      for (let h = 0; h < 24; h += 1) {
        hrs.push({
          time: `2026-09-${d}T${String(h).padStart(2, "0")}:00`,
          isNow: d === "06" && h === 14,
        });
      }
    }
    const j = dayJumps(hrs, 38);

    expect(j).toHaveLength(4);
    // Prvi počinje na 0, zadnji završava na kraju niza.
    expect(j[0]!.from).toBe(0);
    expect(j[j.length - 1]!.to).toBe(hrs.length - 1);
    // Svaki dan nosi svojih 24 sata i nastavlja se na prethodni.
    for (let i = 0; i < j.length; i += 1) {
      expect(j[i]!.to - j[i]!.from + 1).toBe(24);
      if (i > 0) expect(j[i]!.from).toBe(j[i - 1]!.to + 1);
    }
    // Skok svakog dugmeta pada UNUTAR svog raspona — inače bi klizač
    // dobio vrijednost izvan svojih granica.
    for (const d of j) {
      expect(d.index).toBeGreaterThanOrEqual(d.from);
      expect(d.index).toBeLessThanOrEqual(d.to);
    }
  });

  /*
   * MARKOV NALAZ 6.9.2026.: na uređaju je za sutra pisao DATUM umjesto
   * "Sutra".
   *
   * Uzrok: `isNow` traži TOČNO poklapanje niza s tekućim satom. Kad se ne
   * poklopi — niz počne na pola sata, uređaj i `timezone=auto` u različitim
   * zonama, ili upit prestoji puni sat — `nowIdx` je -1 i "danas" je bio
   * nepoznat, pa su SVI dani ispali kao datum.
   *
   * Sada je datum uređaja rezerva, pa oznake rade i bez `isNow`.
   */
  it("bez isNow oznake i dalje zna što je sutra (datum uređaja kao rezerva)", () => {
    const hrs = [
      { time: "2026-09-05T12:00", isNow: false },
      { time: "2026-09-06T12:00", isNow: false },
      { time: "2026-09-07T12:00", isNow: false },
      { time: "2026-09-08T12:00", isNow: false },
    ];
    // nowIdx = -1: nijedan sat se nije poklopio.
    const j = dayJumps(hrs, -1, new Date(2026, 8, 6, 14, 0));
    expect(j.map((d) => d.label)).toEqual(["-24 h", "Sada", "Sutra", "8.9."]);
  });

  it("prazan niz ne ruši ništa", () => {
    expect(dayJumps([], -1)).toEqual([]);
  });

  it("bez 'sada' u nizu i dalje daje dane", () => {
    const j = dayJumps(hours, -1);
    expect(j).toHaveLength(3);
    // Nijedan nije "danas", pa svi idu na podne/prvi korak.
    expect(j[0]!.index).toBe(1);
  });
});
