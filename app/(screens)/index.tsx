import { router, useNavigation } from "expo-router";
import { Menu, Search, type LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BentoGrid } from "@/components/BentoGrid";
import { DailyList } from "@/components/DailyList";
import { DhmzCard } from "@/components/DhmzCard";
import { ErrorView } from "@/components/ErrorView";
import { Hero } from "@/components/Hero";
import { RadarPreviewCard } from "@/components/RadarPreviewCard";
import { Section } from "@/components/Section";
import { HomeSkeleton } from "@/components/Skeleton";
import { Wordmark } from "@/components/Wordmark";
import { useLocation } from "@/hooks/useLocation";
import { useWarnings } from "@/hooks/useWarnings";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import { t } from "@/i18n";
import { useCities } from "@/store/cities";
import { useSettings } from "@/store/settings";
import { colors } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { weatherGradient } from "@/utils/weatherLook";

/**
 * Ladica se otvara METODOM na navigaciji, ne `dispatch`-em akcije
 * (SDK 57, 7.8.2026.).
 *
 * Od SDK 56 `expo-router` više ne dopušta uvoz iz `@react-navigation/*`
 * u kodu aplikacije, pa `DrawerActions.openDrawer()` otpada. Zamjena je
 * `navigation.openDrawer()` — isti poziv koji `DrawerContent` već koristi
 * za `closeDrawer()`, dakle ponašanje je nepromijenjeno.
 *
 * Tip je strukturalan, kao `DrawerNav` u `DrawerContent`: `useNavigation`
 * iz expo-routera je generički i ne zna da je roditelj ladica.
 */
type DrawerNav = { openDrawer: () => void };

export default function HomeScreen() {
  const navigation = useNavigation() as unknown as DrawerNav;
  const { dark } = useThemeColors();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const selected = useCities((s) => s.selected);
  const gps = useLocation(selected === null);
  const place = selected ?? (gps.status === "granted" ? gps.place : null);

  const { bundle, isLoading, isError, isStale, isRefreshing, refetch } =
    useWeatherBundle(place);
  const warnings = useWarnings(place);
  const tempUnit = useSettings((s) => s.tempUnit);
  const windUnit = useSettings((s) => s.windUnit);

  /*
   * Visina prvog ekrana = IZMJERENA visina ScrollView viewporta, ne
   * useWindowDimensions — na uređaju je flex/window računica ostavljala
   * hero na pola visine. Dok mjera ne stigne, prvi kadar koristi window.
   */
  const [viewportH, setViewportH] = useState(0);
  const heroHeight = viewportH || window.height;

  /*
   * Podloga fiksnih ikona se UTAPA postupno sa skrolom (dorada 6.8.2026.):
   * na vrhu su gole na gradijentu, kroz prvih ~120 px dobivaju bijelu
   * podlogu. Nagli preklop je izgledao kao greška.
   */
  /*
   * Promjena mjesta vraća skrol NA VRH (dorada 6.8.2026.): ako se grad
   * odabere iz ladice dok je stranica na pola, novi hero je bio izvan
   * kadra — vidjele su se tuđe kartice dok se sadržaj mijenja pod prstom.
   */
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [place?.id]);

  /*
   * Sadržaj ISPOD PREGIBA se montira tek nakon prvog kadra (dorada
   * 6.8.2026.): bento kartice, lista 14 dana i pregled karte (MapLibre!)
   * najskuplji su dio ekrana. Dok su se crtali odmah, prijelaz s
   * tražilice na početnu trajao je pola sekunde i više — hero je čekao
   * njih, iako se vidi prvi.
   *
   * Sada se hero pojavi ODMAH, a ostatak dolazi u sljedećem kadru.
   * Resetira se pri promjeni mjesta, pa svaki novi grad ide istim putem.
   */
  const [belowFold, setBelowFold] = useState(false);
  useEffect(() => {
    setBelowFold(false);
    const id = requestAnimationFrame(() => setBelowFold(true));
    return () => cancelAnimationFrame(id);
  }, [place?.id]);

  /*
   * PRIJELAZ pri promjeni mjesta (dorada 6.8.2026.): jedan kadar
   * skeletona i za gradove koji već imaju keširane podatke.
   *
   * Zašto: bez toga `bundle` odmah vrati keš, pa React sinkrono crta
   * CIJELI ekran (hero + gradijent + animirani sloj) prije nego se išta
   * vidi — to je bilo ono "dulje treba da skoči na naslovnu, i bez
   * skeletona". Ovako je odziv trenutan i uvijek isti, bez obzira ima
   * li grad keš.
   */
  const [switching, setSwitching] = useState(false);
  const firstPlace = useRef(true);
  useEffect(() => {
    // Prvo otvaranje aplikacije ne treba dodatni kadar.
    if (firstPlace.current) {
      firstPlace.current = false;
      return;
    }
    setSwitching(true);
    const id = requestAnimationFrame(() => setSwitching(false));
    return () => cancelAnimationFrame(id);
  }, [place?.id]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const buttonBg = scrollY.interpolate({
    inputRange: [30, 130],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  /** Wordmark između gumba: isti tempo, ali ostaje blago proziran. */
  const wordmarkOpacity = scrollY.interpolate({
    inputRange: [30, 130],
    outputRange: [0, 0.85],
    extrapolate: "clamp",
  });

  // Bez odabranog grada i bez dozvole za lokaciju -> odabir grada.
  useEffect(() => {
    if (selected === null && gps.status === "denied") {
      router.replace("/search");
    }
  }, [selected, gps.status]);

  if (selected === null && gps.status === "loading") {
    return (
      <View className="flex-1 bg-mist dark:bg-night">
        <HomeSkeleton />
        <Text className="px-8 pb-10 text-center text-xs text-ink/40 dark:text-paper/40">
          {t.location.rationale}
        </Text>
      </View>
    );
  }
  if (selected === null && gps.status === "denied") {
    return <View className="flex-1 bg-mist dark:bg-night" />;
  }
  // Skeleton i pri prijelazu na drugi grad, ne samo kad podataka nema.
  if (isLoading || switching) return <HomeSkeleton />;
  if (isError || !bundle) {
    return (
      <View className="flex-1 justify-center bg-mist dark:bg-night">
        <ErrorView onRetry={refetch} />
      </View>
    );
  }

  const today = bundle.daily[0];
  // "Noću" iz korigirane satne krivulje (noćni sati u sljedeća 24 h), da
  // se poklapa s trakom; daily minimum je nekorigiran i zna biti pretopao.
  const nightHours = bundle.hourly.filter((h) => !h.isDay);
  const nightMin = nightHours.length
    ? Math.min(...nightHours.map((h) => h.temp))
    : today?.tMin;
  const uvNow = bundle.hourly[0]?.uv;
  const gusts = bundle.hourly[0]?.windGusts;
  const visibilityKm = bundle.hourly[0]
    ? Math.round(bundle.hourly[0].visibility / 1000)
    : undefined;
  const precipNext24 =
    Math.round(bundle.hourly.reduce((sum, h) => sum + h.precip, 0) * 10) / 10;

  const stops = weatherGradient(bundle.current.code, bundle.current.isDay, dark);
  const pageBg = dark ? colors.night : colors.mist;

  return (
    <View className="flex-1 bg-mist dark:bg-night">
      <Animated.ScrollView
        ref={scrollRef}
        className="flex-1"
        /*
         * Spinner za osvježavanje iOS crta IZA sadržaja, pa ga je raniji
         * pokrivač (View preko prostora iznad vrha) skrivao — povlačenje
         * je radilo, ali se ništa nije vidjelo (uređaj, 6.8.2026.).
         *
         * Zato: pozadina ScrollVIEWA je boja vrha gradijenta (vidi se samo
         * u overscrollu IZNAD vrha, ispod spinnera), a SADRŽAJ nosi svoju
         * podlogu (mist/night) preko `contentContainerStyle` — bez toga je
         * cijela stranica ispod heroja bila narančasta.
         */
        style={{ backgroundColor: stops[0] }}
        contentContainerStyle={{ backgroundColor: pageBg }}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        /*
         * Odskakivanje OSTAJE uključeno: na iOS-u `bounces={false}` gasi i
         * pull-to-refresh (izmjereno na uređaju 6.8.2026. — povlačenje je
         * prestalo raditi). Prostor iznad vrha pokriva pokrivač u boji
         * gradijenta, pa bounce ne otkriva ništa bijelo.
         */
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          /*
           * NATIVE driver (dorada 6.8.2026.): svi potrošači scrollY su
           * opacity i transformi (podloge gumba su fiksne boje kojima se
           * mijenja prozirnost, pruge se translatiraju). Na JS driveru je
           * animacija štucala nakon reloada — JS thread je tada zauzet
           * montiranjem aplikacije pa kadrovi kasne; UI thread nije.
           */
          { useNativeDriver: true },
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor={dark ? colors.paper : colors.ink}
            colors={[colors.ink]}
            /*
             * Spinner mora pasti ISPOD Dynamic Islanda (dorada 6.8.2026.).
             *
             * `insets.top` je gornji rub sigurnog područja, ali izrez VISI
             * niže od njega. Mjereno na iPhoneu 13 (Marko, 6.8.2026.): na
             * +8 se spinner nije vidio, na +28 se vidjela POLOVICA — notch
             * je ondje dublji nego Dynamic Island na Pro modelima, jer
             * seže do samog dna statusne trake.
             *
             * 48 px = 28 (dosad vidljiva polovica je bila na pola puta)
             * + 20 (promjer spinnera), pa krug izlazi CIJEL ispod izreza.
             *
             * NAPOMENA (7.8.2026.): Marko javio da povećavanje broja iznad
             * +28 više ne mijenja ništa — offset dakle nije (jedini) uzrok.
             * Ostaje otvoreno; vidjeti crta li iOS spinner IZA `style`
             * podloge na ScrollViewu.
             */
            progressViewOffset={insets.top + 48}
          />
        }
      >
        {/* Bounce ISPOD sadržaja pokazuje podlogu stranice, ne gradijent. */}
        <View
          style={{
            position: "absolute",
            bottom: -600,
            height: 600,
            left: 0,
            right: 0,
            backgroundColor: pageBg,
          }}
        />

        {/* Prvi ekran: gradijent, velika brojka, sati — cijeli viewport. */}
        <Hero
          height={heroHeight}
          width={window.width}
          placeName={bundle.place.name}
          current={bundle.current}
          tMax={today?.tMax}
          nightMin={nightMin}
          tempUnit={tempUnit}
          windUnit={windUnit}
          hours={bundle.hourly}
          warnings={warnings}
          fetchedAt={bundle.fetchedAt}
          isStale={isStale}
          stops={stops}
          pageBg={pageBg}
          scrollY={scrollY}
        />

        {/*
          Ispod pregiba: bento kartice pa sekcije. Montira se tek u
          sljedećem kadru (`belowFold`) — vidi objašnjenje uz stanje.
        */}
        <View className="gap-6 px-4 pb-12 pt-1">
          {belowFold && (
            <>
              <BentoGrid
                current={bundle.current}
                gusts={gusts}
                uv={uvNow}
                uvMax={today?.uvMax}
                visibilityKm={visibilityKm}
                precip24={precipNext24}
                aqi={bundle.aqi}
                pollen={bundle.pollen}
                seaTemp={bundle.seaTemp}
                sunrise={today?.sunrise}
                sunset={today?.sunset}
                tempUnit={tempUnit}
                windUnit={windUnit}
              />

              <Section title={t.home.daily}>
                <DailyList
                  days={bundle.daily.slice(0, 14)}
                  hourly={bundle.hourlyAll}
                  tempUnit={tempUnit}
                  windUnit={windUnit}
                />
              </Section>

              <Section title={t.home.mapSection}>
                <RadarPreviewCard
                  lat={bundle.place.lat}
                  lon={bundle.place.lon}
                  temp={bundle.current.temp}
                  code={bundle.current.code}
                  isDay={bundle.current.isDay}
                />
              </Section>

              {bundle.dhmz && (
                <Section title={t.home.nearbyMeasurements}>
                  <DhmzCard obs={bundle.dhmz} tempUnit={tempUnit} windUnit={windUnit} />
                </Section>
              )}
            </>
          )}
        </View>
      </Animated.ScrollView>

      {/*
        FIKSNA gornja traka (dorada 6.8.2026.): pretraga slijeva, izbornik
        zdesna — stoje IZNAD ScrollViewa pa ostaju dostupni cijelim
        skrolom, umjesto da odu s herojem. Datum je zato sišao u sam hero.

        Podloga ikona se utapa postupno sa skrolom: na vrhu leže na
        gradijentu (i bez podloge se vide), a niže na bijelim karticama
        gdje bi se bez nje izgubile.
      */}
      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-5"
        style={{ top: insets.top + 10 }}
        pointerEvents="box-none"
      >
        <TopButton
          onPress={() => router.navigate("/search")}
          label={t.search.placeholder}
          bgOpacity={buttonBg}
          dark={dark}
          Icon={Search}
        />
        {/*
          Wordmark se pojavljuje između gumba tek sa skrolom (isti tempo
          kao njihove podloge) i namjerno NE do pune neprozirnosti — na
          vrhu bi se tukao s datumom, a niže je tihi potpis, ne naslov.
        */}
        <Animated.View pointerEvents="none" style={{ opacity: wordmarkOpacity }}>
          <Wordmark color={dark ? colors.paper : colors.ink} textSize={16} />
        </Animated.View>
        <TopButton
          onPress={() => navigation.openDrawer()}
          label={t.drawer.cities}
          bgOpacity={buttonBg}
          dark={dark}
          Icon={Menu}
        />
      </View>
    </View>
  );
}

/**
 * Gumb u fiksnoj traci početne. Bijela (coal) podloga mu se utapa
 * postupno kako se skrola — nagli preklop je izgledao kao greška.
 */
function TopButton({
  onPress,
  label,
  bgOpacity,
  dark,
  Icon,
}: {
  onPress: () => void;
  label: string;
  bgOpacity: Animated.AnimatedInterpolation<number>;
  dark: boolean;
  Icon: LucideIcon;
}) {
  const { fg } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-10 w-10 items-center justify-center rounded-full"
    >
      <Animated.View
        className="absolute inset-0 rounded-full"
        style={{
          opacity: bgOpacity,
          backgroundColor: dark ? colors.coal : "#FFFFFF",
        }}
      />
      <Icon size={24} strokeWidth={2} color={fg} />
    </Pressable>
  );
}
