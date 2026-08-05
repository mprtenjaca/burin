/**
 * Kanonski rječnik (hrvatski). Ovaj objekt je ujedno i IZVOR TIPA za sve
 * buduće jezike: novi jezik se tipizira kao `const en: Dict = {...}` pa
 * svaki ključ koji nedostaje ruši typecheck. Ne širiti s `as const`.
 */
export const hr = {
  common: {
    appName: "Burin",
    weather: "Vrijeme",
    now: "Sada",
    today: "Danas",
    tomorrow: "Sutra",
    loading: "Učitavanje...",
    noData: "Nema podataka",
    retry: "Pokušaj ponovno",
    dataFrom: "Podaci od", // + " HH:mm"
    warnings: "Upozorenja",
  },

  drawer: {
    myLocation: "Moja lokacija",
    cities: "Gradovi",
    settings: "Postavke",
    sources: "Izvori podataka",
  },

  home: {
    feelsLike: "Osjet",
    night: "Noću",
    hourly: "Prognoza po satima",
    morning: "Prijepodne",
    afternoon: "Poslijepodne",
    evening: "Navečer",
    gusts: "Udari",
    dewPoint: "Rosište",
    sunshine: "Sunčano",
    precipAmount: "Količina",
    precipShort: "Obor.",
    minShort: "Min",
    maxShort: "Maks",
    seaTemp: "More",
    daily: "Prognoza za 14 dana",
    details: "Detalji",
    sunrise: "Izlazak sunca",
    sunset: "Zalazak sunca",
    radarPreview: "Radar oborina",
    nearbyMeasurements: "Mjerenja u blizini",
    measurements: "Mjerenja", // "Mjerenja: {postaja}, {vrijeme}, izvor DHMZ"
    dhmzSource: "izvor DHMZ",
    airQuality: "Kvaliteta zraka",
  },

  metrics: {
    temperature: "Temperatura",
    wind: "Vjetar",
    humidity: "Vlaga",
    pressure: "Tlak",
    uv: "UV indeks",
    visibility: "Vidljivost",
    cloudCover: "Naoblaka",
    precipitation: "Oborine",
  },

  conditions: {
    clear: "Vedro",
    mostlyClear: "Pretežno vedro",
    partlyCloudy: "Djelomično oblačno",
    overcast: "Oblačno",
    fog: "Magla",
    drizzle: "Rosulja",
    freezingDrizzle: "Ledena rosulja",
    rainLight: "Slaba kiša",
    rain: "Kiša",
    rainHeavy: "Jaka kiša",
    freezingRain: "Ledena kiša",
    snow: "Snijeg",
    showers: "Pljuskovi",
    snowShowers: "Snježni pljuskovi",
    thunderstorm: "Grmljavina",
    thunderstormHail: "Grmljavina s tučom",
  },

  map: {
    title: "Radar oborina",
    layerRadar: "Radar",
    layerTemperature: "Temperatura",
    layerClouds: "Naoblaka",
    layerWind: "Vjetar",
    layerPrecipitation: "Oborine",
    forecastLabel: "prognoza",
    radarAttribution: "Radar: RainViewer",
    owmAttribution: "© OpenWeatherMap",
    locateMe: "Moja lokacija",
    nowLabel: "Sada",
    play: "Pokreni animaciju",
    pause: "Zaustavi animaciju",
    needsOwmKey: "Potreban OWM ključ",
    legendWeak: "slabo",
    legendStrong: "jako",
    omAttribution: "Vjetar: Open-Meteo",
    timelineUnavailable: "Podaci trenutno nisu dostupni (ograničenje izvora)",
    zoomHint: "Detaljniji prikaz nije dostupan na ovom sloju",
  },

  search: {
    title: "Gradovi",
    placeholder: "Traži grad...",
    pickCityToStart: "Odaberi grad za početak",
    savedCities: "Spremljeni gradovi",
    noResults: "Nema rezultata",
    remove: "Ukloni",
  },

  settings: {
    title: "Postavke",
    theme: "Tema",
    themeLight: "Svijetla",
    themeDark: "Tamna",
    themeSystem: "Sustav",
    darkTheme: "Tamna tema",
    units: "Jedinice",
    tempUnit: "Temperatura",
    windUnit: "Vjetar",
    sources: "Izvori podataka",
  },

  sources: {
    title: "Izvori podataka",
    dhmzName: "DHMZ — Državni hidrometeorološki zavod",
    dhmzDesc: "Trenutna mjerenja meteoroloških postaja u Hrvatskoj",
    openMeteoName: "Open-Meteo",
    openMeteoDesc: "Prognoza vremena i kvaliteta zraka (CC BY 4.0)",
    rainviewerName: "RainViewer",
    rainviewerDesc: "Radarske snimke oborina",
    owmName: "OpenWeatherMap",
    owmDesc: "Dodatni slojevi karte (temperatura, naoblaka, vjetar, oborine)",
  },

  location: {
    rationale: "Burin koristi tvoju lokaciju za prikaz vremena u tvom mjestu.",
    denied: "Pristup lokaciji nije odobren.",
  },

  aqi: {
    good: "Dobra",
    fair: "Prihvatljiva",
    moderate: "Umjerena",
    poor: "Loša",
    veryPoor: "Vrlo loša",
    extremelyPoor: "Izrazito loša",
  },

  /** Kratice smjerova vjetra, indeks = kut/45° (S = sjever). */
  windDirs: ["S", "SI", "I", "JI", "J", "JZ", "Z", "SZ"],

  /** Imena dana, indeks = Date.getDay() (0 = nedjelja). */
  dayNames: [
    "nedjelja",
    "ponedjeljak",
    "utorak",
    "srijeda",
    "četvrtak",
    "petak",
    "subota",
  ],
  dayNamesShort: ["ned", "pon", "uto", "sri", "čet", "pet", "sub"],
};

export type Dict = typeof hr;
