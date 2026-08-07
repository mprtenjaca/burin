import type { Dict } from "./hr";

/**
 * Engleski rječnik (6.8.2026.). Tipiziran kao `Dict`, NE `as const` —
 * tako svaki ključ koji nedostaje ili se preimenuje u hrvatskom
 * (kanonskom) rječniku odmah ruši typecheck.
 *
 * Prijevod je opisni, ne doslovan: "Osjet" je ustaljeno "Feels like", a
 * ne "Sensation". Meteorološki nazivi prate terminologiju Met Officea i
 * WMO-a (isti izvor koji koristi i en-GB blok Meteoalarma), pa se naša
 * imena vremena poklapaju s tekstom upozorenja u istom ekranu.
 */
export const en: Dict = {
  common: {
    appName: "Burin",
    weather: "Weather",
    now: "Now",
    today: "Today",
    tomorrow: "Tomorrow",
    loading: "Loading...",
    noData: "No data",
    retry: "Try again",
    dataFrom: "Data from", // + " HH:mm"
    warnings: "Warnings",
    cancel: "Cancel",
    delete: "Delete",
  },

  drawer: {
    myLocation: "My location",
    cities: "Cities",
    saveCity: "Save to favourites",
    seeAll: "See all",
    maps: "Maps",
    app: "App",
    settings: "Settings",
    sources: "Data sources",
  },

  home: {
    feelsLike: "Feels like",
    night: "Overnight",
    hourly: "Hourly forecast",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    /*
     * Kratice stupaca razdoblja dana. U engleskom su nazivi ionako
     * kratki, pa su kratice jednake punim nazivima — osim "Overnight",
     * koji se skraćuje na "Night" da stane u stupac.
     */
    morningShort: "Morning",
    afternoonShort: "Afternoon",
    eveningShort: "Evening",
    nightShort: "Night",
    gusts: "Gusts",
    dewPoint: "Dew point",
    sunshine: "Sunshine",
    precipAmount: "Amount",
    precipShort: "Precip.",
    minShort: "Min",
    maxShort: "Max",
    seaTemp: "Sea",
    daily: "14-day forecast",
    details: "Details",
    sunrise: "Sunrise",
    sunset: "Sunset",
    radarPreview: "Precipitation radar",
    nearbyMeasurements: "Nearby measurements",
    measurements: "Measurements", // "Measurements: {station}, {time}, source DHMZ"
    dhmzSource: "source DHMZ",
    airQuality: "Air quality",
    sunCycle: "Sunset",
    sunriseShort: "Sunrise",
    precip24: "Precipitation 24 h",
    mapSection: "Map",
    seaCaption: "Coastal sea temperature",
    pressureLow: "Low",
    pressureHigh: "High",
    uvProtection: "Sun protection until", // + " HH:mm"
    dewPointNote: "Dew point", // + " N°"
    feelsSame: "Same as measured temperature",
    feelsWarmer: "Warmer than measured",
    feelsColder: "Colder than measured",
    precipNone: "No significant precipitation",
    precipSome: "Precipitation expected",
    uvMaxToday: "Peak today", // + " N"
  },

  uvLabels: {
    low: "Low",
    moderate: "Moderate",
    high: "High",
    veryHigh: "Very high",
    extreme: "Extreme",
  },

  visibilityLabels: {
    excellent: "Excellent",
    good: "Good",
    moderate: "Moderate",
    poor: "Poor",
  },

  metrics: {
    temperature: "Temperature",
    wind: "Wind",
    humidity: "Humidity",
    pressure: "Pressure",
    uv: "UV index",
    visibility: "Visibility",
    cloudCover: "Cloud cover",
    precipitation: "Precipitation",
  },

  /*
   * Nazivi vremena prate WMO / Met Office terminologiju, kojom je pisan i
   * en-GB blok Meteoalarma — tako se ime vremena u heroju i tekst
   * upozorenja ispod njega ne razilaze.
   *
   * "Drizzle" je pravi parnjak "rosulji" (vrlo sitna kiša), a ne "light
   * rain", koji je zaseban WMO kod. "Thunderstorm" pokriva ono što HR
   * zove "grmljavinsko nevrijeme".
   */
  conditions: {
    clear: "Clear",
    mostlyClear: "Mostly clear",
    partlyCloudy: "Partly cloudy",
    overcast: "Overcast",
    fog: "Fog",
    drizzle: "Drizzle",
    drizzleHeavy: "Heavy drizzle",
    freezingDrizzle: "Freezing drizzle",
    rainLight: "Light rain",
    rain: "Rain",
    rainHeavy: "Heavy rain",
    freezingRain: "Freezing rain",
    snowLight: "Light snow",
    snow: "Snow",
    snowHeavy: "Heavy snow",
    snowGrains: "Snow grains",
    showersLight: "Light showers",
    showers: "Showers",
    showersHeavy: "Heavy showers",
    snowShowers: "Snow showers",
    thunderstorm: "Thunderstorm",
    thunderstormHail: "Thunderstorm with hail",
  },

  map: {
    title: "Precipitation radar",
    layerRadar: "Radar",
    layerTemperature: "Temperature",
    layerClouds: "Clouds",
    layerWind: "Wind",
    layerPrecipitation: "Precipitation",
    forecastLabel: "forecast",
    radarAttribution: "Radar: RainViewer",
    owmAttribution: "© OpenWeatherMap",
    locateMe: "My location",
    nowLabel: "Now",
    play: "Play animation",
    pause: "Pause animation",
    needsOwmKey: "OWM key required",
    legendWeak: "light",
    legendStrong: "heavy",
    omAttribution: "Wind: Open-Meteo",
    timelineUnavailable: "Data currently unavailable (source rate limit)",
    zoomHint: "A closer view is not available on this layer",
  },

  search: {
    title: "Cities",
    placeholder: "Search for a city...",
    pickCityToStart: "Choose a city to start",
    savedCities: "Saved cities",
    lastViewed: "Last viewed",
    history: "History",
    clearHistory: "Clear history",
    clearHistoryConfirm: "Clear search history?",
    noResults: "No results",
    remove: "Remove",
    clear: "Clear input",
    myLocation: "My location",
    allowLocation: "Allow location access",
    locatingNow: "Finding location...",
  },

  preview: {
    title: "Weather preview",
    hint: "Pick a condition to see its backdrop and animation",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
  },

  settings: {
    title: "Settings",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    darkTheme: "Dark theme",
    units: "Units",
    tempUnit: "Temperature",
    windUnit: "Wind",
    sources: "Data sources",
    weatherPreview: "Weather backdrop preview",
    language: "Language",
    languageSystem: "System",
    languageHr: "Hrvatski",
    languageEn: "English",
  },

  sources: {
    title: "Data sources",
    dhmzName: "DHMZ — Croatian Meteorological and Hydrological Service",
    dhmzDesc: "Current measurements from weather stations in Croatia",
    openMeteoName: "Open-Meteo",
    openMeteoDesc:
      "Weather forecast, air quality and pollen (CC BY 4.0). Pollen comes from the CAMS model, not measurements — treat it as indicative",
    meteoalarmName: "Meteoalarm — DHMZ warnings",
    meteoalarmDesc: "Weather warnings for Croatia (CC BY 4.0)",
    rainviewerName: "RainViewer",
    rainviewerDesc: "Precipitation radar imagery",
    owmName: "OpenWeatherMap",
    owmDesc: "Additional map layers (temperature, clouds, wind, precipitation)",
  },

  location: {
    rationale: "Burin uses your location to show the weather where you are.",
    denied: "Location access was not granted.",
  },

  aqi: {
    good: "Good",
    fair: "Fair",
    moderate: "Moderate",
    poor: "Poor",
    veryPoor: "Very poor",
    extremelyPoor: "Extremely poor",
  },

  warnings: {
    none: "No warnings in effect",
    outsideCroatia: "Warnings are not available for this area",
    source: "National meteorological services via Meteoalarm",
    until: "until", // "until 23:59"
    tomorrow: "tomorrow", // "tomorrow 00:01 – 23:59"
  },

  pollen: {
    title: "Pollen",
    none: "No pollen",
    noneShort: "None",
    low: "Low",
    moderate: "Moderate",
    high: "High",
    veryHigh: "Very high",
    modelNote:
      "Values come from the CAMS model (Copernicus), not measuring stations — they are indicative",
    species: {
      alder: "Alder",
      birch: "Birch",
      grass: "Grass",
      mugwort: "Mugwort",
      olive: "Olive",
      ragweed: "Ragweed",
    },
  },

  /*
   * Kratice smjerova vjetra, indeks = kut/45°. Engleske kratice se NE
   * poklapaju s hrvatskima: hrvatski "I" (istok) je engleski "E", a
   * hrvatski "S" (sjever) je "N" — bez prijevoda bi engleski korisnik
   * čitao "S" kao jug, dakle točno suprotan smjer.
   */
  windDirs: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],

  dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
