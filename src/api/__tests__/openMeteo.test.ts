import { mapCurrent, mapDaily, mapHourly } from "../openMeteo";

const rawCurrent = {
  time: "2026-08-04T14:00",
  temperature_2m: 30.2,
  apparent_temperature: 32.6,
  weather_code: 1,
  is_day: 1,
  wind_speed_10m: 10.4,
  wind_gusts_10m: 22.7,
  wind_direction_10m: 180,
  relative_humidity_2m: 42,
  pressure_msl: 1013.2,
  cloud_cover: 20,
  precipitation: 0,
};

const rawHourly = {
  time: ["2026-08-04T09:00", "2026-08-04T10:00", "2026-08-04T11:00"],
  temperature_2m: [24.1, 26.3, 28.0],
  apparent_temperature: [25.0, 27.1, 29.2],
  weather_code: [1, 2, 3],
  is_day: [1, 1, 1],
  precipitation: [0, 0.2, 1.4],
  precipitation_probability: [5, 30, 65],
  wind_speed_10m: [8, 9, 10],
  wind_direction_10m: [90, 135, 180],
  wind_gusts_10m: [15, 18, 22],
  relative_humidity_2m: [60, 55, 50],
  pressure_msl: [1014, 1013.5, 1013],
  cloud_cover: [10, 40, 80],
  uv_index: [3, 5, 6.5],
  visibility: [20000, 18000, 15000],
};

const rawDaily = {
  time: ["2026-08-04", "2026-08-05"],
  weather_code: [3, 61],
  temperature_2m_max: [31.2, 24.0],
  temperature_2m_min: [19.4, 16.1],
  sunrise: ["2026-08-04T05:47", "2026-08-05T05:48"],
  sunset: ["2026-08-04T20:22", "2026-08-05T20:20"],
  precipitation_sum: [0, 12.5],
  precipitation_probability_max: [10, 85],
  uv_index_max: [7.2, 4.1],
  wind_speed_10m_max: [14, 28],
};

describe("Open-Meteo mapperi", () => {
  it("mapCurrent", () => {
    const c = mapCurrent(rawCurrent);
    expect(c.temp).toBe(30.2);
    expect(c.feelsLike).toBe(32.6);
    expect(c.code).toBe(1);
    expect(c.isDay).toBe(true);
    expect(c.windSpeed).toBe(10.4);
    // Udari nose značku bure — moraju proći kroz mapper (6.8.2026.).
    expect(c.windGusts).toBe(22.7);
    expect(c.windDir).toBe(180);
    expect(c.humidity).toBe(42);
    expect(c.pressure).toBe(1013.2);
    expect(c.cloudCover).toBe(20);
    expect(c.precipitation).toBe(0);
  });

  it("mapHourly kreće od punog sata trenutnog vremena i mapira polja", () => {
    const points = mapHourly(rawHourly, new Date(2026, 7, 4, 10, 30));
    expect(points[0]!.time).toBe("2026-08-04T10:00");
    expect(points).toHaveLength(2); // 10:00 i 11:00 iz fixture-a
    expect(points[0]!.temp).toBe(26.3);
    expect(points[0]!.precipProb).toBe(30);
    expect(points[1]!.windGusts).toBe(22);
    expect(points[1]!.uv).toBe(6.5);
    expect(points[1]!.visibility).toBe(15000);
  });

  it("mapDaily", () => {
    const days = mapDaily(rawDaily);
    expect(days).toHaveLength(2);
    expect(days[0]!.date).toBe("2026-08-04");
    expect(days[0]!.tMax).toBe(31.2);
    expect(days[0]!.tMin).toBe(19.4);
    expect(days[1]!.code).toBe(61);
    expect(days[1]!.precipProbMax).toBe(85);
    expect(days[1]!.sunrise).toBe("2026-08-05T05:48");
  });
});
