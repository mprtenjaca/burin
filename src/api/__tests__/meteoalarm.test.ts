import type { MeteoWarning } from "../meteoalarm";
import { parseMeteoalarm, warningsForPlace } from "../meteoalarm";

/** Sastavi feed unos u obliku Meteoalarm JSON API-ja (provjeren 6.8.2026.). */
function entry(opts: {
  id?: string;
  region?: string;
  level?: string;
  type?: string;
  event?: string;
  status?: string;
  sent?: string;
  onset?: string;
  expires?: string;
}) {
  return {
    alert: {
      identifier: opts.id ?? "test-1",
      status: opts.status ?? "Actual",
      msgType: "Alert",
      sent: opts.sent ?? "2026-08-06T09:00:00+02:00",
      info: [
        {
          language: "hr-HR",
          event: opts.event ?? "Crveno upozorenje za vrućinu",
          description: "Toplinski val.",
          instruction: "BUDITE NA OPREZU.",
          onset: opts.onset ?? "2026-08-06T00:01:00+02:00",
          expires: opts.expires ?? "2026-08-06T23:59:59+02:00",
          parameter: [
            { valueName: "awareness_level", value: opts.level ?? "4; red; Extreme" },
            { valueName: "awareness_type", value: opts.type ?? "5; high-temperature" },
          ],
          area: [
            {
              areaDesc: "Knin region",
              geocode: [{ valueName: "EMMA_ID", value: opts.region ?? "HR001" }],
            },
          ],
        },
        {
          language: "en-GB",
          event: "Red high temperature warning",
          onset: opts.onset ?? "2026-08-06T00:01:00+02:00",
          expires: opts.expires ?? "2026-08-06T23:59:59+02:00",
          parameter: [
            { valueName: "awareness_level", value: opts.level ?? "4; red; Extreme" },
          ],
          area: [
            {
              areaDesc: "Knin region",
              geocode: [{ valueName: "EMMA_ID", value: opts.region ?? "HR001" }],
            },
          ],
        },
      ],
    },
  };
}

const NOW = Date.parse("2026-08-06T12:00:00+02:00");

describe("parseMeteoalarm", () => {
  it("vadi hrvatski info blok s razinom, vrstom i tekstom", () => {
    const [w] = parseMeteoalarm({ warnings: [entry({})] }, NOW);
    expect(w).toMatchObject({
      region: "HR001",
      level: 4,
      type: 5,
      event: "Crveno upozorenje za vrućinu",
      description: "Toplinski val.",
      instruction: "BUDITE NA OPREZU.",
    });
  });

  it("istekla i ne-Actual upozorenja se odbacuju", () => {
    const feed = {
      warnings: [
        entry({ id: "old", expires: "2026-08-05T23:59:59+02:00" }),
        entry({ id: "draft", status: "Test" }),
        entry({ id: "live" }),
      ],
    };
    const out = parseMeteoalarm(feed, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("live");
  });

  it("Update istog upozorenja pobjeđuje raniji Alert (nema duplikata)", () => {
    const feed = {
      warnings: [
        entry({ id: "v1", sent: "2026-08-06T07:00:00+02:00" }),
        entry({ id: "v2", sent: "2026-08-06T09:38:00+02:00" }),
      ],
    };
    const out = parseMeteoalarm(feed, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("v2");
  });

  it("nikad ne baca: smeće i prazno daju prazan niz, ne undefined", () => {
    for (const junk of [null, undefined, 42, "xml?", {}, { warnings: "ne" }]) {
      const out = parseMeteoalarm(junk, NOW);
      expect(Array.isArray(out)).toBe(true);
      expect(out).toHaveLength(0);
    }
  });
});

describe("warningsForPlace", () => {
  const all = parseMeteoalarm(
    {
      warnings: [
        entry({ id: "knin-red", region: "HR001", level: "4; red; Extreme" }),
        entry({
          id: "more-zuto",
          region: "HR804",
          level: "2; yellow; Moderate",
          type: "1; Wind",
          event: "Žuto upozorenje za vjetar",
        }),
        entry({ id: "zg", region: "HR002", level: "3; orange; Severe" }),
      ],
    },
    NOW,
  ) as MeteoWarning[];

  it("Polača dobiva kninsko crveno pa pomorsko žuto; zagrebačko ne", () => {
    const out = warningsForPlace(all, 44.006, 15.505);
    expect(out.map((w) => w.id)).toEqual(["knin-red", "more-zuto"]);
  });

  it("Zagreb dobiva samo svoje", () => {
    const out = warningsForPlace(all, 45.815, 15.982);
    expect(out.map((w) => w.id)).toEqual(["zg"]);
  });
});
