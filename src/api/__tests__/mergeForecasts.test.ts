import { mergeForecasts } from "../openMeteo";

const hourly = (
  times: string[],
  temps: (number | null)[],
  uv: (number | null)[] = times.map(() => 5),
) =>
  ({
    time: times,
    temperature_2m: temps,
    apparent_temperature: temps,
    weather_code: times.map(() => 0),
    is_day: times.map(() => 1),
    precipitation: times.map(() => 0),
    precipitation_probability: times.map(() => 0),
    wind_speed_10m: times.map(() => 5),
    wind_direction_10m: times.map(() => 180),
    wind_gusts_10m: times.map(() => 9),
    relative_humidity_2m: times.map(() => 60),
    pressure_msl: times.map(() => 1013),
    cloud_cover: times.map(() => 10),
    uv_index: uv,
    visibility: times.map(() => 20000),
  }) as never;

const daily = (dates: string[], mins: (number | null)[]) =>
  ({
    time: dates,
    weather_code: dates.map(() => 0),
    temperature_2m_max: dates.map(() => 33),
    temperature_2m_min: mins,
    sunrise: dates.map((d) => `${d}T05:49`),
    sunset: dates.map((d) => `${d}T20:17`),
    precipitation_sum: dates.map(() => 0),
    precipitation_probability_max: dates.map(() => 5),
    uv_index_max: dates.map(() => 8),
    wind_speed_10m_max: dates.map(() => 20),
  }) as never;

const TIMES = ["2026-08-06T05:00", "2026-08-06T06:00"];
const DATES = ["2026-08-06", "2026-08-07"];

describe("mergeForecasts", () => {
  it("uzima temperature primarnog modela (ECMWF)", () => {
    const primary = { hourly: hourly(TIMES, [24, 23]), daily: daily(DATES, [24, 23]) };
    const fallback = { hourly: hourly(TIMES, [28, 28]), daily: daily(DATES, [28, 28]) };
    const m = mergeForecasts(primary, fallback);
    expect(m.hourly.temperature_2m).toEqual([24, 23]);
    expect(m.daily.temperature_2m_min).toEqual([24, 23]);
  });

  it("UV i vidljivost uzima iz rezervnog (ECMWF ih ne daje)", () => {
    const primary = {
      hourly: hourly(TIMES, [24, 23], [null, null]),
      daily: daily(DATES, [24, 23]),
    };
    const fallback = { hourly: hourly(TIMES, [28, 28], [7, 8]), daily: daily(DATES, [28, 28]) };
    const m = mergeForecasts(primary, fallback);
    expect(m.hourly.uv_index).toEqual([7, 8]);
    expect(m.hourly.visibility).toEqual([20000, 20000]);
  });

  it("gdje primarni nema podatka koristi rezervni (zadnji dani)", () => {
    const primary = { hourly: hourly(TIMES, [24, 23]), daily: daily(DATES, [24, null]) };
    const fallback = { hourly: hourly(TIMES, [28, 28]), daily: daily(DATES, [28, 27]) };
    const m = mergeForecasts(primary, fallback);
    expect(m.daily.temperature_2m_min).toEqual([24, 27]);
  });

  it("dani koje primarni ne pokriva dolaze iz rezervnog", () => {
    const primary = {
      hourly: hourly([TIMES[0]!], [24]),
      daily: daily([DATES[0]!], [24]),
    };
    const fallback = { hourly: hourly(TIMES, [28, 28]), daily: daily(DATES, [28, 27]) };
    const m = mergeForecasts(primary, fallback);
    expect(m.daily.temperature_2m_min).toEqual([24, 27]);
    expect(m.hourly.temperature_2m).toEqual([24, 28]);
  });

  it("bez primarnog vraća rezervni nepromijenjen", () => {
    const fallback = { hourly: hourly(TIMES, [28, 28]), daily: daily(DATES, [28, 27]) };
    expect(mergeForecasts(undefined, fallback)).toBe(fallback);
  });

  it("vremenska os i stringovi (sunrise) ostaju iz rezervnog", () => {
    const primary = { hourly: hourly(TIMES, [24, 23]), daily: daily(DATES, [24, 23]) };
    const fallback = { hourly: hourly(TIMES, [28, 28]), daily: daily(DATES, [28, 28]) };
    const m = mergeForecasts(primary, fallback);
    expect(m.hourly.time).toEqual(TIMES);
    expect(m.daily.sunrise).toEqual(["2026-08-06T05:49", "2026-08-07T05:49"]);
  });
});
