import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { InteractionManager } from "react-native";

import {
  fetchDhmzObservations,
  findNearbyStations,
  findNearestStation,
} from "@/api/dhmz";
import {
  currentHourIso,
  fetchAirQuality,
  fetchCurrent,
  fetchForecast,
  fetchSeaTemperature,
} from "@/api/openMeteo";
import { fetchStamparPollen, nearestStamparCity } from "@/api/stampar";
import type { Place, WeatherBundle } from "@/api/types";
import { NO_BIAS, biasSlotForHour, learnModelBias } from "@/api/bias";
import {
  CONDITION_RANGE_KM,
  buildBundle,
  correctHourly,
  debiasDaily,
  debiasHourly,
  observationDelta,
  withCurrentCode,
  dropImpossiblePrecip,
  withPastCodes,
} from "@/api/weather";
import { useLastWeather } from "@/store/lastWeather";
import { placeNow } from "@/utils/format";
import { mark } from "@/utils/perf";
import { useRadarEcho } from "@/hooks/useRadarEcho";
import { useRadarFrames } from "@/hooks/useRadarFrames";
import { DBZ_DRY, cloudCodeFromCover, isPrecip, judgeCurrentCode, precipCodeFromDbz, stationAgeMinutes } from "@/utils/radarJudge";
import { judgeCurrentCodeV2, modelAgeMinutes } from "@/utils/currentWeatherV2";
import { clutterScore, radarTemporal } from "@/utils/radarFeatures";
import { dhmzTextToCode } from "@/utils/weatherCodes";
import { useSettings } from "@/store/settings";
import { pushWidget } from "@/widgets/widgetData";

const MIN = 60 * 1000;

/** DHMZ mjerenja vrijede samo ako je najbliža postaja unutar 50 km. */
const DHMZ_MAX_DISTANCE_KM = 50;

/**
 * Sastavlja WeatherBundle iz odvojenih upita (svaki sa svojim staleTime):
 * trenutno vrijeme 10 min, prognoza 30 min, kvaliteta zraka 30 min.
 * Kod greške vraća zadnje spremljene podatke (isStale = true).
 */
export function useWeatherBundle(place: Place | null) {
  /*
   * TEMPO, 11.9.2026.: s 10 na 5 min. Open-Meteo osvježava „current"
   * svakih 15 min, pa češće od 5 nema što donijeti — a satna kvota
   * (~600/h) se troši po mjestu, ne po feedu kao kod DHMZ-a.
   */
  const current = useQuery({
    queryKey: ["om-current", place?.id],
    queryFn: () => fetchCurrent(place!.lat, place!.lon),
    enabled: !!place,
    staleTime: 5 * MIN,
    refetchInterval: 5 * MIN,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const forecast = useQuery({
    queryKey: ["om-forecast", place?.id],
    queryFn: () => fetchForecast(place!.lat, place!.lon),
    enabled: !!place,
    staleTime: 30 * MIN,
  });

  const aqi = useQuery({
    queryKey: ["om-aqi", place?.id],
    queryFn: () => fetchAirQuality(place!.lat, place!.lon),
    enabled: !!place,
    staleTime: 30 * MIN,
    retry: 1,
  });

  /*
   * PELUD S PELUDOMJERA — SAMO U RAZVOJU (6.9.2026.).
   *
   * `__DEV__` je u produkcijskoj gradnji `false`, pa se ovaj upit ondje
   * NIKAD ne pokrene i CAMS ostaje jedini izvor. To je cijela zaštita, i
   * namjerno je u kodu a ne u konfiguraciji: nema prekidača koji bi netko
   * slučajno ostavio upaljen. Razlog je pravni — vidi `api/stampar.ts`.
   *
   * Radi samo za mjesta do 40 km od jednog od 25 Štamparovih gradova;
   * ostatak Hrvatske i sve izvan nje ostaje na CAMS-u (Markov zahtjev).
   *
   * KEŠ I TEMPO (Markov zahtjev: "nemoj agresivno pollati stranicu"):
   *  - ključ po GRADU, ne po mjestu — Zadar, Polača i Bibinje dijele jedan
   *    dohvat;
   *  - `staleTime` 6 h: Štampar objavljuje jednom dnevno, pa i to je više
   *    nego što treba, ali ulovi popodnevnu objavu bez restarta;
   *  - `gcTime` 24 h da keš preživi zatvaranje ekrana;
   *  - bez osvježavanja na fokus i povratak u aplikaciju;
   *  - jedan pokušaj ponovno, uz 30 s razmaka — pad se ne "lupa".
   * Jedan developer × jedan grad × najviše 4 puta dnevno.
   */
  const stamparCity = place ? nearestStamparCity(place.lat, place.lon) : undefined;
  const stampar = useQuery({
    queryKey: ["stampar-pollen", stamparCity?.id],
    queryFn: () => fetchStamparPollen(stamparCity!.id),
    enabled: __DEV__ && !!stamparCity,
    staleTime: 6 * 60 * MIN,
    gcTime: 24 * 60 * MIN,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    retryDelay: 30_000,
  });

  // Temperatura mora — undefined za kopnena mjesta, tada se ne prikazuje.
  const seaTemp = useQuery({
    queryKey: ["om-sea", place?.id],
    queryFn: () => fetchSeaTemperature(place!.lat, place!.lon),
    enabled: !!place,
    staleTime: 60 * MIN,
    retry: 0,
  });

  // Naučena pristranost modela za ovo mjesto. Mijenja se sporo (klima
  // lokacije), pa se drži cijeli dan.
  const bias = useQuery({
    queryKey: ["model-bias", place?.id],
    queryFn: () => learnModelBias(place!.lat, place!.lon),
    enabled: !!place,
    staleTime: 12 * 60 * MIN,
    retry: 0,
  });

  /*
   * Globalni DHMZ feed (sve postaje); greška vraća null — tihi fallback.
   *
   * TEMPO, 11.9.2026. (Markov zahtjev za zimu — svaka promjena na oku):
   * s 10 na 3 min. DHMZ objavljuje satni termin, ali NEPRAVILNO — 30 do
   * 70 min nakon samog termina. S provjerom svakih 10 min novi je termin
   * u prosjeku 5 min star prije nego ga app vidi; s 3 min taj rep pada na
   * ~1.5 min. Feed je JEDAN za sve gradove (~40 kB), pa je i ovo jedan
   * zahtjev bez obzira na broj spremljenih mjesta.
   */
  const dhmz = useQuery({
    queryKey: ["dhmz"],
    queryFn: fetchDhmzObservations,
    enabled: !!place,
    staleTime: 3 * MIN,
    refetchInterval: 3 * MIN,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Jedan feed za SVA mjesta — vrijedi ga držati dulje od zadanog sata.
    gcTime: 24 * 60 * MIN,
    retry: 1,
  });

  /*
   * RADAR KAO SUDAC ZA OBORINU (10.9.2026.) — vidi `utils/radarJudge.ts`.
   * Sudi RAINVIEWER (izmjereno: LibreWXR je 10–25 dBZ prejak i nefiltriran;
   * on ostaje samo sloj na karti). Lista okvira svakih 5 min, uzorak nad
   * mjestom po okviru, pokrivenost po pločici.
   */
  const rvFrames = useRadarFrames(!!place);
  const radar = useRadarEcho(place, rvFrames);

  const save = useLastWeather((s) => s.save);
  const cached: WeatherBundle | undefined = useLastWeather((s) =>
    place ? s.byPlaceId[place.id] : undefined,
  );
  const hasCached = cached !== undefined;

  // Perf oznake dolaska upita (no-op u produkciji) — vidi `utils/perf.ts`.
  useMarkOnData("q:current", current.dataUpdatedAt);
  useMarkOnData("q:forecast", forecast.dataUpdatedAt);
  useMarkOnData("q:dhmz", dhmz.dataUpdatedAt);
  useMarkOnData("q:bias", bias.dataUpdatedAt);
  useMarkOnData("q:radar", radar.dataUpdatedAt);

  /*
   * Upit je RIJEŠEN kad je barem jednom dohvaćen (i s diska), pao, ili se
   * uopće ne dohvaća — čekati na njega ima smisla samo dok stvarno radi.
   */
  const dhmzSettled = dhmz.isFetched || dhmz.isError || dhmz.fetchStatus === "idle";
  const biasSettled = bias.isFetched || bias.isError || bias.fetchStatus === "idle";
  const radarSettled = !radar.pending;

  /*
   * JEZGRA paketa (10.9.2026.): sve što ovisi o current + forecast + DHMZ +
   * pristranosti. ODVOJENA od dodataka (AQI, more, pelud) da njihov
   * dolazak ne ponavlja debias/korekciju nad ~400 točaka i, važnije, ne
   * mijenja REFERENCE `current`/`hourly` — na njima počiva `memo(Hero)`,
   * pa heroj i svi SVG slojevi pod njim miruju kad stigne AQI.
   */
  const core = useMemo(() => {
    if (!place || !current.data || !forecast.data) return undefined;
    /*
     * BEZ KAPANJA (10.9.2026., Markov nalaz „na milisekund kriva prognoza
     * pa preskoči"). Dosad je svaki od osam upita, kad stigne, iznova
     * sastavljao paket i crtao heroja s DRUGOM temperaturom: model, pa
     * +mjerenje (delta), pa +pristranost. Kad za mjesto VEĆ postoji keš,
     * svježi paket zato čeka da se riješe i DHMZ i pristranost; do tada
     * se prikazuje keš. Oba su u pravilu već u memoriji ili na disku, pa
     * je čekanje ~0. Za mjesto BEZ keša se NE čeka: nešto na ekranu
     * vrijedi više od 1 °C točnosti, a jedan skok pri PRVOM posjetu je
     * cijena koju plaćamo jednom.
     *
     * Nuspojava koja je namjerna: prvi `save` novog grada pretvori ga u
     * „grad s kešom", pa ako pristranost još putuje, jezgra na tren pada
     * na taj isti keš (identičan sadržaj — ništa se ne vidi) i vraća se s
     * pristranošću. Jedan skok, ne tri.
     */
    if (hasCached && (!dhmzSettled || !biasSettled || !radarSettled)) return undefined;
    const nearest = dhmz.data
      ? findNearestStation(place.lat, place.lon, dhmz.data)
      : null;
    const dhmzObs =
      nearest && nearest.distanceKm <= DHMZ_MAX_DISTANCE_KM ? nearest : undefined;
    // Korekcija se računa iz nekoliko okolnih postaja (točnije od jedne),
    // a ista greška se primjenjuje na hero i na satnu krivulju — inače
    // hero i prvi sat u traci pokazuju različit broj.
    const nearby = dhmz.data
      ? findNearbyStations(place.lat, place.lon, dhmz.data)
      : [];

    // Redoslijed je važan: prvo se iz prognoze ukloni naučena pristranost
    // modela (rješava sutrašnja jutra), pa se tek onda ostatak razlike
    // pripiše mjerenju (rješava "sada") — inače bi se ista greška
    // ispravila dva puta.
    const modelBias = bias.data ?? NO_BIAS;
    const debiasedHourly = debiasHourly(forecast.data.hourly, modelBias);
    const debiasedAll = debiasHourly(forecast.data.hourlyAll, modelBias);
    const nowBias = modelBias[biasSlotForHour(new Date().getHours())];
    const debiasedCurrent = {
      ...current.data,
      temp: current.data.temp - nowBias,
      feelsLike: current.data.feelsLike - nowBias,
    };
    const delta = observationDelta(debiasedCurrent, nearby);

    /*
     * MJERENO STANJE NEBA pobjeđuje model (9.9.2026., Markov nalaz s
     * prozora: app je pisala „djelomično oblačno" dok je DHMZ na zadarskoj
     * postaji mjerio „pretežno oblačno" — „jedva se ne bi od oblaka
     * vidilo").
     *
     * Isto načelo koje ovaj hook već primjenjuje na temperaturu i koje
     * stoji u odlukama (ECMWF je za Roč davao „vedro" uz izmjerenu
     * grmljavinu u Pazinu): model nije mjerenje, a nebo je upravo ono što
     * postaja gleda.
     *
     * Domet je UŽI od onoga za temperaturu (25 vs 60 km): temperatura se
     * u prostoru mijenja glatko, pa se smije prosječiti iz nekoliko
     * postaja; naoblaka je zakrpasta i uzima se samo s NAJBLIŽE postaje —
     * „vedro" i „oblačno" se ne prosječuju u „umjereno oblačno".
     *
     * `dhmzObs` je već najbliža postaja (≤ 50 km), pa se ovdje samo
     * dodatno steže na `CONDITION_RANGE_KM`.
     */
    const measuredCode =
      dhmzObs && dhmzObs.distanceKm <= CONDITION_RANGE_KM
        ? dhmzTextToCode(dhmzObs.conditionText)
        : undefined;

    /*
     * RADAR PRESUĐUJE OBORINU (10.9.2026.). Postaja je i dalje sudac za
     * naoblaku i maglu, ali je njezin tekst snimka TERMINA (svaka 3 h),
     * pa je „grmljavina s oborinom" iz 12:00 stajala do 15:00 iako je
     * jezgra prošla u 12:30. Radar je star 1–10 min i jedini zna pada li
     * SADA; model za to ne zna (Crikvenica: kod 61 uz 0 mm i prazan
     * radar). Pragovi i pravila u `radarJudge.ts`, izmjereni na 46
     * postaja u istom trenutku (44/46).
     */
    const nowMs = Date.now();
    /*
     * „SADA" U ZONI MJESTA (12.9.2026., Markov nalaz na Sidneyju u Ohiju).
     *
     * Satni ključevi dolaze u vremenu grada (`timezone=auto`), pa svaka
     * usporedba s uređajevim satom gađa krivi stupac: u Ohiju je bilo
     * 08:11 po mjestu, a app je rezala prema hrvatskih 14:12 i gubila
     * šest sati prognoze. Za domaće gradove je pomak nula i ništa se ne
     * mijenja. Vidi `placeNow` u `utils/format.ts`.
     */
    const nowThere = placeNow(new Date(nowMs), forecast.data.utcOffsetSeconds);

    /*
     * PROŠLI SATI TRAKE IZ RADARA (11.9.2026.) — vidi `withPastCodes`.
     * dBZ po satu → kod, istim pragovima kao „sada", ali bez grmljavine
     * (munje radar ne vidi, a za prošli sat nema postaje da ih potvrdi).
     * Temperatura se uzima ista kao sad: unutar dva sata se ne prelazi
     * granica snijega, a točniju po satu ionako nemamo mjerenu.
     */
    const pastCodes = new Map<string, number>();
    if (radar.pastDbz) {
      for (const [iso, dbz] of radar.pastDbz) {
        pastCodes.set(iso, dbz < DBZ_DRY ? cloudCodeFromCover(debiasedCurrent.cloudCover) : precipCodeFromDbz(dbz, debiasedCurrent.temp + delta));
      }
    }

    /*
     * ŠTIT ZA TEKUĆI SAT (12.9.2026.) — vidi `dropImpossiblePrecip`.
     *
     * Koristi se PRESUDA sudca, ne sirovi dBZ: sudac je taj koji je
     * odvagnuo širinu, postojanost, median i postaju, pa bi drugo
     * pravilo ovdje moglo reći suprotno od onoga što heroj piše. Ovako
     * traka i heroj ne mogu ispasti u neskladu — ako heroj kaže da pada,
     * tekući stupac se ne čisti.
     */
    const judged = judgeCurrentCode({
      stationCode: measuredCode,
      stationAgeMin: stationAgeMinutes(dhmzObs?.measuredAt, nowMs),
      // Blizina odlučuje smije li postaja govoriti o OBORINI: 11.9.2026.
      // je postaja Zadar (2.3 km) javljala jaku kišu dok je Zadar-aerodrom
      // (10.8 km) javljao „pretežno oblačno" — u istom terminu, oboje
      // točno. Za nebo se blizina ne gleda (već je stegnuto na 25 km).
      stationDistanceKm: dhmzObs?.distanceKm,
      modelCode: debiasedCurrent.code,
      cloudCover: debiasedCurrent.cloudCover,
      temp: debiasedCurrent.temp + delta,
      echo: radar.echo,
      // Prethodni okvir: razlikuje jezgru u oblaku od kiše na tlu
      // (Metković 11.9. — vidi `WIDE_ECHO_PCT`).
      prevEcho: radar.prevEcho,
      covered: radar.covered,
      nowMs,
    });
    /*
     * Sat koji radar štiti od čišćenja: samo kad je presuda OBORINA i
     * kad ju je donio RADAR. Presuda s postaje ili modela ovdje ne
     * vrijedi — model je upravo taj koji zna izmisliti kišu iz vedra
     * neba, pa bi njome štitio vlastitu grešku.
     */
    const wetNowIso =
      judged.source === "radar" && isPrecip(judged.code)
        ? currentHourIso(nowThere)
        : undefined;
    if (__DEV__) {
      const age = radar.echo ? Math.round((nowMs / 1000 - radar.echo.frameTime) / 60) : null;
      // eslint-disable-next-line no-console
      console.log(
        `[radar] ${place.name}: ${
          radar.covered === false
            ? "nepokriveno"
            : radar.echo
              ? radar.echo.maxDbz === null
                ? `bez odjeka (okvir −${age} min)`
                : `${radar.echo.maxDbz} dBZ na ${Math.round((100 * radar.echo.echoPixels) / radar.echo.coverPixels)}% kruga (okvir −${age} min)`
              : "bez radara"
        }, postaja ${measuredCode ?? "—"}, model ${debiasedCurrent.code} → ${judged.code} (${judged.source})`,
      );

      /*
       * SHADOW MODE za V2 (11.9.2026.).
       *
       * V2 se računa PARALELNO i samo se logira — odluku i dalje donosi V1.
       * Zašto tako, a ne odmah zamjena: replay protiv mjerenja na tlu
       * (241 austrijska postaja, mm/10 min) pokazao je da je V2 RAZMJENA,
       * ne čisto poboljšanje — hvata 65 % kiše prema 41 % kod V1, ali uz
       * 19 lažnih prema 12. A cijelo to mjerenje je iz Austrije, gdje
       * nema orografskog cluttera koji nam najviše kvari Dalmaciju
       * (Polača, Metković, Mosor nad Splitom).
       *
       * Ovaj log je zato jedini način da se dobiju brojke ODAVDE: par
       * dana stvarnog korištenja po hrvatskim mjestima, pa odluka s
       * podacima. Samo `__DEV__`, bez ijednog dodatnog zahtjeva —
       * featurei se računaju iz okvira koji su već dohvaćeni.
       */
      const series = radar.series;
      if (series.length > 0) {
        const temporal = radarTemporal(series, series.map((s) => s.centroid));
        const clutter = clutterScore(series[series.length - 1]!, temporal);
        const v2 = judgeCurrentCodeV2({
          radar: {
            stats: series[series.length - 1]!,
            temporal,
            clutterScore: clutter,
            frameTime: series[series.length - 1]!.frameTime,
          },
          covered: radar.covered,
          station:
            measuredCode !== undefined && dhmzObs
              ? { code: measuredCode, ageMin: stationAgeMinutes(dhmzObs.measuredAt, nowMs), distanceKm: dhmzObs.distanceKm }
              : undefined,
          model: {
            code: debiasedCurrent.code,
            cloudCover: debiasedCurrent.cloudCover,
            precipitation: debiasedCurrent.precipitation,
            // Model nosi vrijeme za koje TVRDI da je „sada"; izmjereno
            // 11.9. da zna biti dva sata star (u 09:18 je vraćao 07:15).
            ageMin: modelAgeMinutes(debiasedCurrent.modelTime, nowMs),
          },
          temp: debiasedCurrent.temp + delta,
          nowMs,
        });
        const same = v2.code === judged.code;
        // eslint-disable-next-line no-console
        console.log(
          `[v2] ${place.name}: ${same ? "ISTO" : `V1 ${judged.code} vs V2 ${v2.code}`}` +
            ` | ${v2.precipitation ? v2.precipitationIntensity : "bez oborine"}` +
            ` conf ${v2.precipitationConfidence.toFixed(2)} (${v2.source})` +
            ` | nebo ${v2.sky.condition} conf ${v2.sky.confidence.toFixed(2)} (${v2.sky.source})` +
            `\n      ${v2.diagnostics.reason}` +
            (v2.diagnostics.flags.length ? `\n      flags: ${v2.diagnostics.flags.join(", ")}` : ""),
        );
      }
    }

    return {
      // Isti `delta` kao za satnu krivulju — hero i prva ura moraju se
      // poklapati, pa se korekcija računa iz istog prosjeka postaja.
      current: {
        ...debiasedCurrent,
        temp: debiasedCurrent.temp + delta,
        feelsLike: debiasedCurrent.feelsLike + delta,
        // Presuđeno: radar za oborinu, postaja za nebo, model kao rezerva.
        code: judged.code,
      },
      // Prvi stupac trake (tekući sat) nosi isti kod kao heroj.
      hourly: withPastCodes(
        withCurrentCode(dropImpossiblePrecip(correctHourly(debiasedHourly, delta), wetNowIso), judged.code, nowThere),
        pastCodes,
        new Date(nowMs),
      ),
      hourlyAll: withPastCodes(
        withCurrentCode(dropImpossiblePrecip(correctHourly(debiasedAll, delta), wetNowIso), judged.code, nowThere),
        pastCodes,
        new Date(nowMs),
      ),
      daily: debiasDaily(forecast.data.daily, modelBias),
      // Zona MJESTA — svaka usporedba „je li sat prošao" ide kroz nju
      // (`placeNow`), inače se strani grad reže po satu uređaja.
      utcOffsetSeconds: forecast.data.utcOffsetSeconds,
      dhmz: dhmzObs,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id, current.data, forecast.data, dhmz.data, bias.data, radar.echo, radar.covered, hasCached, dhmzSettled, biasSettled, radarSettled]);

  useEffect(() => {
    if (core) mark("bundle:core");
  }, [core]);

  /*
   * DODACI na jezgru: AQI, pelud, more. Svaki smije stići kad stigne —
   * paket dobije novu referencu, ali jezgra (i heroj) ostaje ista.
   */
  const fresh = useMemo(() => {
    if (!place || !core) return undefined;
    /*
     * Izvor peludi: peludomjer ako je stigao i nije prazan, inače CAMS.
     * `stampar.data` je `undefined` u produkciji (upit onemogućen) i `[]`
     * kad stranica ne da ništa upotrebljivo — oboje pada na CAMS.
     * Peludomjer POBJEĐUJE nad modelom kad ga ima (samo u razvoju, samo
     * blizu pokrivenog grada); korisnik nikad ne vidi rupu.
     */
    const pollenDays = stampar.data?.length ? stampar.data : aqi.data?.pollenDays;

    return buildBundle({
      place,
      ...core,
      aqi: aqi.data?.aqi,
      pollen: pollenDays?.[0]?.levels,
      pollenDays,
      // Upit vraća null za kopnena mjesta (react-query brani undefined);
      // WeatherBundle očekuje undefined kad mora nema.
      seaTemp: seaTemp.data ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id, core, aqi.data, stampar.data, seaTemp.data]);

  /*
   * Jedinice za widget. Čitaju se OVDJE, a ne u `widgetData`, jer su to
   * hookovi — a `widgetData` mora ostati čist modul da se može testirati
   * bez nativnih modula (isto pravilo kao `MapTimeline`).
   *
   * TEMA se NE prosljeđuje (7.8.2026.): widget ima jednu verziju, uvijek
   * tamnu s bijelim tekstom, pa bi tema samo uzalud okidala novi upis.
   */
  const tempUnit = useSettings((s) => s.tempUnit);
  const windUnit = useSettings((s) => s.windUnit);

  useEffect(() => {
    if (fresh) save(fresh);
  }, [fresh, save]);

  /*
   * Widget se puni SAMO iz svježih podataka (7.8.2026.).
   *
   * Namjerno ne iz `cached`: keš se čita pri svakom pokretanju, pa bi
   * widget dobivao stare vrijednosti i gasio novije koje je već imao.
   * Vrti se i na promjenu jedinica — widget nosi IZRAČUNATE brojke, pa
   * mora dobiti nove kad se postavka promijeni.
   */
  useEffect(() => {
    if (!fresh) return;
    /*
     * Widget se puni TEK IZA PRIJELAZA (popravak 8.8.2026.).
     *
     * Svjež dohvat stigne točno u trenutku prebacivanja grada, a
     * `pushWidget` na tom istom JS threadu radi ozbiljan posao: Android
     * kroz `requestWidgetUpdate` CRTA oba widgeta (SVG + čitanje
     * AsyncStoragea), iOS serijalizira 13 unosa crte i po potrebi kopira
     * ikone u App Group. Sve to se guralo u isti kadar s montiranjem
     * heroja i pozadine — dio onog "dulje mu treba da prebaci na grad".
     *
     * `runAfterInteractions` pusti animaciju prijelaza da završi pa tek
     * onda gura widget. Widgetu svejedno: njegova točnost se mjeri u
     * minutama, ne u kadrovima.
     */
    const task = InteractionManager.runAfterInteractions(() => {
      void pushWidget(fresh, tempUnit, windUnit);
    });
    return () => task.cancel();
  }, [fresh, tempUnit, windUnit]);

  const bundle = fresh ?? cached;
  const hasError = current.isError || forecast.isError;

  return {
    bundle,
    /** Prvo učitavanje bez ikakvih podataka (ni cache-a). */
    isLoading: !bundle && !hasError && (current.isPending || forecast.isPending),
    /** Greška bez ičega za prikaz. */
    isError: hasError && !bundle,
    /** Prikazujemo starije podatke jer svježi dohvat nije uspio. */
    isStale: !fresh && !!cached && hasError,
    isRefreshing: current.isRefetching || forecast.isRefetching || dhmz.isRefetching,
    /*
     * PULL-TO-REFRESH MORA OSVJEŽITI I SUDCE, NE SAMO MODEL (10.9.2026.).
     *
     * Dosad je povlačenje osvježavalo model, AQI i more — a NE DHMZ i NE
     * radar. To su upravo dva izvora koja odlučuju što heroj piše
     * (`judgeCurrentCode`): postaja mjeri nebo, radar sudi oborinu. Tko
     * je povukao jer „vani je prošlo nevrijeme a app još piše grmljavina"
     * dobio je novi model i staru presudu — dakle isti tekst, i
     * povlačenje je izgledalo kao da ne radi.
     *
     * `dhmz.isRefetching` je i u `isRefreshing`: spinner mora stajati dok
     * traje dohvat koji može promijeniti heroja, inače se zavrti i
     * nestane prije nego što presuda dođe.
     */
    refetch: () => {
      void current.refetch();
      void forecast.refetch();
      void dhmz.refetch();
      radar.refetch();
      void aqi.refetch();
      void seaTemp.refetch();
    },
  };
}

/** Perf oznaka pri svakom novom podatku upita — no-op u produkciji. */
function useMarkOnData(label: string, dataUpdatedAt: number): void {
  useEffect(() => {
    if (dataUpdatedAt) mark(label);
  }, [label, dataUpdatedAt]);
}
