import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { InteractionManager } from "react-native";

import {
  fetchDhmzObservations,
  findNearbyStations,
  findNearestStation,
} from "@/api/dhmz";
import {
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
} from "@/api/weather";
import { useLastWeather } from "@/store/lastWeather";
import { mark } from "@/utils/perf";
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
  const current = useQuery({
    queryKey: ["om-current", place?.id],
    queryFn: () => fetchCurrent(place!.lat, place!.lon),
    enabled: !!place,
    staleTime: 10 * MIN,
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

  // Globalni DHMZ feed (sve postaje); greška vraća null — tihi fallback.
  const dhmz = useQuery({
    queryKey: ["dhmz"],
    queryFn: fetchDhmzObservations,
    enabled: !!place,
    staleTime: 10 * MIN,
    // Jedan feed za SVA mjesta — vrijedi ga držati dulje od zadanog sata.
    gcTime: 24 * 60 * MIN,
    retry: 1,
  });

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

  /*
   * Upit je RIJEŠEN kad je barem jednom dohvaćen (i s diska), pao, ili se
   * uopće ne dohvaća — čekati na njega ima smisla samo dok stvarno radi.
   */
  const dhmzSettled = dhmz.isFetched || dhmz.isError || dhmz.fetchStatus === "idle";
  const biasSettled = bias.isFetched || bias.isError || bias.fetchStatus === "idle";

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
    if (hasCached && (!dhmzSettled || !biasSettled)) return undefined;
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

    return {
      // Isti `delta` kao za satnu krivulju — hero i prva ura moraju se
      // poklapati, pa se korekcija računa iz istog prosjeka postaja.
      current: {
        ...debiasedCurrent,
        temp: debiasedCurrent.temp + delta,
        feelsLike: debiasedCurrent.feelsLike + delta,
        // Mjereno nebo; bez mjerenja (predaleko, nepoznat opis) ostaje model.
        code: measuredCode ?? debiasedCurrent.code,
      },
      hourly: correctHourly(debiasedHourly, delta),
      hourlyAll: correctHourly(debiasedAll, delta),
      daily: debiasDaily(forecast.data.daily, modelBias),
      dhmz: dhmzObs,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id, current.data, forecast.data, dhmz.data, bias.data, hasCached, dhmzSettled, biasSettled]);

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
    isRefreshing: current.isRefetching || forecast.isRefetching,
    refetch: () => {
      void current.refetch();
      void forecast.refetch();
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
