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
    cancel: "Odustani",
    delete: "Obriši",
  },

  drawer: {
    myLocation: "Moja lokacija",
    cities: "Gradovi",
    saveCity: "Spremi u omiljene",
    seeAll: "Vidi više",
    maps: "Karte",
    app: "Aplikacija",
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
    /*
     * Kratice za stupce razdoblja dana: do 4 stupca dijele širinu ekrana,
     * pa "Poslijepodne" (12 znakova) tamo fizički ne stane ni na manjem
     * fontu. Puni nazivi ostaju u zaglavlju detalja ispod.
     */
    morningShort: "Jutro",
    afternoonShort: "Popodne",
    eveningShort: "Večer",
    nightShort: "Noć",
    gusts: "Udari",
    dewPoint: "Rosište",
    sunshine: "Sunčano",
    precipAmount: "Količina",
    precipShort: "Obor.",
    minShort: "Min",
    maxShort: "Max",
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
    sunCycle: "Zalazak sunca",
    sunriseShort: "Izlazak",
    precip24: "Oborine 24 h",
    mapSection: "Karta",
    seaCaption: "Temperatura mora uz obalu",
    pressureLow: "Nizak",
    pressureHigh: "Visok",
    uvProtection: "Zaštita od sunca do", // + " HH:mm"
    dewPointNote: "Rosište", // + " N°"
    feelsSame: "Kao izmjerena temperatura",
    feelsWarmer: "Toplije od izmjerene",
    feelsColder: "Hladnije od izmjerene",
    precipNone: "Bez značajnih oborina",
    precipSome: "Očekuju se oborine",
    uvMaxToday: "Danas najviše", // + " N"
    /**
     * Opis pokrivenosti neba, indeks = razred naoblake (8.8.2026.).
     * Kartica naoblake je uz golu brojku bila poluprazna — bilješka je
     * pretvara u rečenicu, kao rosište kod vlage.
     */
    cloudDesc: ["Nebo je vedro", "Uglavnom vedro", "Umjereno oblačno", "Pretežno oblačno", "Nebo je prekriveno"],
  },

  /** WHO razredi UV indeksa. */
  uvLabels: {
    low: "Nizak",
    moderate: "Umjeren",
    high: "Visok",
    veryHigh: "Vrlo visok",
    extreme: "Ekstreman",
  },

  /** Opisna ocjena vidljivosti po kilometrima. */
  visibilityLabels: {
    excellent: "Odlična",
    good: "Dobra",
    moderate: "Umjerena",
    poor: "Slaba",
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

  /**
   * Nazivi vremena po DHMZ terminologiji (provjereno 6.8.2026.).
   * "Rosulja" je službeni meteorološki termin za vrlo sitnu kišu (ne
   * "lagana kiša"); "grmljavinsko nevrijeme" je izraz koji DHMZ koristi
   * u najavama, a "grmljavina" je samo zvuk.
   */
  conditions: {
    clear: "Vedro",
    mostlyClear: "Pretežno vedro",
    partlyCloudy: "Djelomično oblačno",
    overcast: "Oblačno",
    fog: "Magla",
    drizzle: "Rosulja",
    drizzleHeavy: "Jaka rosulja",
    freezingDrizzle: "Ledena rosulja",
    rainLight: "Slaba kiša",
    rain: "Kiša",
    rainHeavy: "Jaka kiša",
    freezingRain: "Ledena kiša",
    snowLight: "Slab snijeg",
    snow: "Snijeg",
    snowHeavy: "Jak snijeg",
    snowGrains: "Snježna zrnca",
    showersLight: "Slabi pljuskovi",
    showers: "Pljuskovi",
    showersHeavy: "Jaki pljuskovi",
    snowShowers: "Snježni pljuskovi",
    thunderstorm: "Grmljavinsko nevrijeme",
    thunderstormHail: "Nevrijeme s tučom",
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
    /*
     * Oznake dugmadi dana na vremenskoj crti (6.9.2026.).
     *
     * Jučer je "-24 h", a ne ime dana: ime dana u prošlosti se u trenu
     * pomiješa s istim danom sljedećeg tjedna, dok je "-24 h" nedvosmisleno
     * i odmah kaže koliko unatrag. Sutra ima svoju riječ jer je najčešća
     * meta; dalji dani nose DATUM ("8.9."), jer se "pon" i "uto" pri kraju
     * tjedna više ne razlikuju od prošlih dana.
     */
    dayYesterday: "-24 h",
    dayTomorrow: "Sutra",
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
    lastViewed: "Zadnje gledano",
    history: "Povijest",
    clearHistory: "Obriši povijest",
    clearHistoryConfirm: "Obrisati povijest pretraživanja?",
    noResults: "Nema rezultata",
    remove: "Ukloni",
    clear: "Obriši upisano",
    myLocation: "Moja lokacija",
    /* Kad dozvola nije dana — red je i poziv i gumb. */
    allowLocation: "Dopusti pristup lokaciji",
    locatingNow: "Tražim lokaciju...",
  },

  /** Razvojni pregled pozadina po vremenu (nije dio redovnog toka). */
  preview: {
    title: "Pregled vremena",
    hint: "Odaberi vrijeme da vidiš pozadinu i animaciju",
    theme: "Tema",
    light: "Svijetla",
    dark: "Tamna",
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
    weatherPreview: "Pregled pozadina po vremenu",
    language: "Jezik",
    languageSystem: "Sustav",
    /*
     * Imena jezika stoje U TOM JEZIKU (endonimi), ne prevedena: tako
     * "English" ostaje "English" i na hrvatskom sučelju. Korisnik koji je
     * greškom prebacio na jezik koji ne čita mora prepoznati svoj red u
     * popisu da se vrati.
     */
    languageHr: "Hrvatski",
    languageEn: "English",
    /*
     * Prekidač za domaću rečenicu na heroju (1.9.2026.). Naslov je
     * IZRIČIT o psovkama, a ne uljepšan ("Komentar dana"): opcija je
     * zadano isključena baš zato što tekst psuje, pa mora reći što pali —
     * inače je iznenađenje, a to je točno ono što se prekidačem izbjegava.
     */
    quips: "Komentar o vremenu",
    quipsLabel: "Domaća rečenica na heroju",
    quipsNote: "Slobodan jezik, s psovkama. Ugasi da heroj ostane samo s brojkama.",
  },

  sources: {
    title: "Izvori podataka",
    dhmzName: "DHMZ — Državni hidrometeorološki zavod",
    dhmzDesc: "Trenutna mjerenja meteoroloških postaja u Hrvatskoj",
    openMeteoName: "Open-Meteo",
    openMeteoDesc:
      "Prognoza vremena, kvaliteta zraka i pelud (CC BY 4.0). Pelud je CAMS model, ne mjerenje — orijentacijska vrijednost",
    meteoalarmName: "Meteoalarm — DHMZ upozorenja",
    meteoalarmDesc: "Vremenska upozorenja za Hrvatsku (CC BY 4.0)",
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

  /** Meteoalarm/DHMZ upozorenja. */
  warnings: {
    none: "Nema upozorenja na snazi",
    outsideCroatia: "Upozorenja nisu dostupna za ovo područje",
    source: "Nacionalne meteorološke službe preko Meteoalarma",
    until: "do", // "do 23:59"
    tomorrow: "sutra", // "sutra 00:01 – 23:59"
  },

  /** Razredi peludi (CAMS model preko Open-Metea). */
  pollen: {
    title: "Pelud",
    none: "Nema peludi",
    noneShort: "Nema",
    low: "Niska",
    moderate: "Umjerena",
    high: "Visoka",
    veryHigh: "Vrlo visoka",
    /**
     * Oznake dana u retku triju dana: danas, sutra, pa DATUM (Markov
     * zahtjev 6.9.2026., treći put — prva dva popravka su otišla na kartu
     * umjesto ovamo). Sutra ima riječ jer je najčešće pitanje alergičara;
     * prekosutra i dalje datum, jer ime dana pri kraju tjedna više ne
     * govori ništa.
     */
    today: "danas",
    tomorrow: "sutra",
    /*
     * Napomena je od 6.9.2026. IZRIČITIJA i upućuje na mjerenja.
     *
     * Pelud nije kozmetika nego zdravstvena informacija: alergičar koji
     * planira dan po ovom broju ima pravo znati da gleda SIMULACIJU, a ne
     * peludomjer. CAMS zna podcijeniti lokalni izvor — izmjereno 6.9.2026.
     * na Zadru, gdje je model davao najniže vrijednosti u Hrvatskoj, a
     * mjerenje županijskog zavoda visoku ambroziju.
     */
    modelNote:
      "Vrijednosti računa CAMS model (Copernicus), nisu s peludomjera — orijentacijske su. Za izmjerene vrijednosti vidi peludnu prognozu svog županijskog zavoda za javno zdravstvo",
    /*
     * Napomena kad je izvor Štamparov peludomjer (razvojni izvor od
     * 6.9.2026., ide SAMO u razvojnu gradnju — `__DEV__`). Prvi dan je
     * izmjeren, sljedeći su njihova prognoza; kaže se otvoreno.
     */
    measuredNote:
      "Izmjereno peludomjerom — NZJZ „Dr. Andrija Štampar” (danas mjerenje, sljedeći dani njihova prognoza). Razvojni izvor, ne ide u objavljenu aplikaciju",
    species: {
      alder: "Joha",
      birch: "Breza",
      grass: "Trave",
      mugwort: "Pelin",
      olive: "Maslina",
      ragweed: "Ambrozija",
      /*
       * Štamparove vrste (6.9.2026.) — CAMS ih ne daje; vidljive samo kad
       * je izvor peludomjer. Imena kako ih Štampar objavljuje.
       */
      nettle: "Koprive",
      plantain: "Trputac",
      pellitory: "Crkvina",
      goosefoot: "Loboda",
    },
  },

  /** Kratice smjerova vjetra, indeks = kut/45° (S = sjever). */
  windDirs: ["S", "SI", "I", "JI", "J", "JZ", "Z", "SZ"],

  /** Imena dana, indeks = Date.getDay() (0 = nedjelja). */
  dayNames: ["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"],
  dayNamesShort: ["ned", "pon", "uto", "sri", "čet", "pet", "sub"],
};

export type Dict = typeof hr;
