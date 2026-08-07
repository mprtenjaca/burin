import { router, usePathname } from "expo-router";
import { BookmarkPlus, ChevronRight, Cloudy, Info, MapPin, Radar, Search, Settings, Thermometer, TriangleAlert, Wind } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";

import type { MapLayerId } from "@/api/mapLayers";
import { MAP_LAYERS, isLayerAvailable, mapLayerById } from "@/api/mapLayers";
import type { Place, WeatherBundle } from "@/api/types";
import { t } from "@/i18n";
import { useCities } from "@/store/cities";
import { useLastWeather } from "@/store/lastWeather";
import { useMapTimeline } from "@/store/mapTimeline";
import { useSettings } from "@/store/settings";
import { colors } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import type { TempUnit } from "@/utils/format";
import { convertTemp } from "@/utils/format";
import { WindFlag } from "@/components/WindFlag";
import { Wordmark } from "@/components/Wordmark";
import { BACKDROP_LAYERS } from "@/components/HeroBackdrop";
import { ACCENT_CORAL, backdropEffects, heroAccent, precipIntensity, readableOn, weatherGradient } from "@/utils/weatherLook";
import { codeToCondition } from "@/utils/weatherCodes";

type DrawerNav = { closeDrawer: () => void };

/**
 * Visina repne zone u kojoj se gradijent zaglavlja gasi u podlogu.
 * Dugačka namjerno (Markov odabir 6.8.2026.): rep se prelijeva PREKO
 * prvih stavki s gradovima, pa boja vremena polako izlazi iz kadra
 * umjesto da stane na rubu zaglavlja.
 */
const FADE_H = 130;

/*
 * Ambijentalni slojevi dolaze IZ `HeroBackdrop` (`BACKDROP_LAYERS`), ne
 * iz vlastite kopije popisa (dorada 6.8.2026.). Kopija je govorila da je
 * "jedan izvor izgleda", ali je zapravo tražila ručno održavanje na dva
 * mjesta — pri dodavanju zvijezda je ostala bez njih i ladica bi na
 * vedroj noći pala.
 */

/**
 * Ikone slojeva karte za grupu KARTE (redoslijed = MAP_LAYERS), svaka sa
 * SVOJOM prigušenom bojom po značenju (Markov odabir 6.8.2026.: "obojene
 * linije, bez pločica") — jednobojne ink ikone su se stapale u sivilo.
 * Nijanse su birane da drže kontrast na mist podlozi (pravilo ≥65 %).
 */
const LAYER_ICONS: Record<MapLayerId, { Icon: LucideIcon; color: string }> = {
  radar: { Icon: Radar, color: ACCENT_CORAL },
  temp_new: { Icon: Thermometer, color: "#D9822B" },
  clouds_new: { Icon: Cloudy, color: "#4C8FDF" },
  wind_new: { Icon: Wind, color: "#2F9E8F" },
};

/** Upozorenja: jantarna — semafor jezik, a čitljiva na bijelom i coalu. */
const WARNINGS_COLOR = "#D9A014";

/**
 * Stavka ladice u jeziku bento kartica: aktivna dobiva ispunjenu karticu
 * (bijela/coal) i koraljni tekst; `right` je mjesto za temperaturu grada.
 */
function Item({
  label,
  Icon,
  iconColor,
  active,
  accent = ACCENT_CORAL,
  right,
  card = false,
  disabled = false,
  onPress,
}: {
  label: string;
  Icon?: LucideIcon;
  /** Boja linije ikone; bez nje ikona prati tekst (prigušeni ink/paper). */
  iconColor?: string;
  active?: boolean;
  /**
   * Boja AKTIVNE stavke — ovisi o podlozi (6.8.2026.). Zadano koraljna;
   * stavke preko kojih se prelijeva rep gradijenta zaglavlja dobivaju
   * `heroAccent`, jer se na toplim narančastim podlogama koraljna utapa.
   */
  accent?: string;
  right?: ReactNode;
  /**
   * Mjesta su UVIJEK kartice (bijela/coal) — bez toga su se stapala s
   * podlogom i nije se vidjelo da su odvojive stavke (dorada 6.8.2026.).
   * Aktivno mjesto se razlikuje koraljnim tekstom i ikonom.
   */
  card?: boolean;
  /** OWM slojevi bez ključa — prigušeno, kao čipovi na karti. */
  disabled?: boolean;
  onPress: () => void;
}) {
  const { fg } = useThemeColors();
  /*
   * VLASTITO stanje pritiska (dorada 6.8.2026.): `style={({pressed}) => …}`
   * na Pressableu ovdje NE radi — NativeWind pretvara `className` u
   * `style` i prepisuje funkciju, pa se dodir nije ničim potvrđivao.
   * `onPressIn/Out` je neovisan o tome i reagira odmah.
   */
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      style={pressed && !disabled ? { opacity: 0.5, transform: [{ scale: 0.97 }] } : undefined}
      className={`mx-3 flex-row items-center gap-3 rounded-xl px-4 py-4 ${card || active ? "bg-white dark:bg-coal" : "active:bg-ink/5 dark:active:bg-paper/5"} ${disabled ? "opacity-40" : ""}`}
    >
      {Icon && (
        <Icon
          size={19}
          strokeWidth={2}
          // Obojena ikona zadržava SVOJU boju i kad je stavka aktivna —
          // aktivnost nosi tekst i kartica, ne promjena boje ikone.
          color={iconColor ?? (active ? accent : fg)}
          opacity={iconColor ? 0.95 : active ? 1 : 0.55}
        />
      )}
      <Text className={`flex-1 font-grotesk-medium text-[17px] ${active ? "" : "text-ink dark:text-paper"}`} style={active ? { color: accent } : undefined}>
        {label}
      </Text>
      {right}
    </Pressable>
  );
}

/** Mali naslov grupe — isti jezik kao naslovi sekcija (bez verzala). */
function GroupLabel({ children }: { children: string }) {
  return <Text className="px-7 pb-2 pt-6 font-grotesk-bold text-[14px] text-ink/55 dark:text-paper/55">{children}</Text>;
}

/**
 * Zaglavlje ladice (dorada 6.8.2026., po referenci): gradijent TRENUTNOG
 * vremena odabranog mjesta (isti `weatherGradient` kao heroj), ime +
 * velika temperatura + opis, pa koraljna crta. Sve iz `burin:last-weather`
 * — nijedan novi upit. Bez pohranjenog vremena: samo naslov aplikacije.
 */
function Header({ bundle, tempUnit }: { bundle?: WeatherBundle; tempUnit: TempUnit }) {
  const insets = useSafeAreaInsets();
  const { dark } = useThemeColors();
  const [size, setSize] = useState({ w: 0, h: 0 });

  if (!bundle) {
    return (
      <View className="px-7" style={{ marginTop: insets.top + 18 }}>
        <Wordmark color={dark ? colors.paper : colors.ink} textSize={20} />
      </View>
    );
  }

  const stops = weatherGradient(bundle.current.code, bundle.current.isDay, dark);
  /*
   * Boja teksta u ZAGLAVLJU prati gradijent, ne temu (8.8.2026.) — isto
   * pravilo i ista funkcija kao u heroju (`readableOn(stops[1])`).
   *
   * Vrijedi SAMO za zaglavlje: stavke ladice ispod njega stoje na
   * `mist`/`night` podlozi i drže `text-ink dark:text-paper`.
   */
  const headerFg = readableOn(stops[1]);
  const condition = codeToCondition(bundle.current.code, bundle.current.isDay);
  // Velikim slovom: `<condition.Icon>` bi React protumačio kao HTML tag.
  const ConditionIcon = condition.Icon;
  const pageBg = dark ? colors.night : colors.mist;

  return (
    <View>
      {/*
        POZADINA zaglavlja, izvan njegovog okvira: gradijent + animirani
        ambijent (isti slojevi kao heroj) + rep koji se gasi u podlogu.

        Visoka je `size.h + FADE_H`, pa se rep PRELIJEVA preko prvih
        stavki s gradovima (Markov odabir 6.8.2026.) umjesto da boja
        stane na rubu zaglavlja. `pointerEvents="none"` + `zIndex: -1`
        drže je ispod stavki i propuštaju dodire.

        `overflow: hidden` je nužan: slojevi crtaju izvan svojih granica
        (kiša ima rezervu od 520 px sa strane).
      */}
      {size.w > 0 && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size.w,
            height: size.h + FADE_H,
            overflow: "hidden",
            zIndex: -1,
          }}
          pointerEvents="none"
        >
          <Svg width={size.w} height={size.h + FADE_H} style={{ position: "absolute" }}>
            <Defs>
              <LinearGradient id="drawer-bg" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stops[0]} />
                <Stop offset="0.4" stopColor={stops[1]} />
                <Stop offset="0.72" stopColor={stops[2]} />
                <Stop offset="1" stopColor={pageBg} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={size.w} height={size.h + FADE_H} fill="url(#drawer-bg)" />
          </Svg>

          {backdropEffects(bundle.current.code, bundle.current.isDay).map((name) => {
            const Layer = BACKDROP_LAYERS[name];
            return <Layer key={name} width={size.w} height={size.h + FADE_H} intensity={precipIntensity(bundle.current.code)} />;
          })}

          {/* Rep: ambijent i boja se gase prema stavkama. */}
          <Svg width={size.w} height={FADE_H} style={{ position: "absolute", top: size.h }}>
            <Defs>
              <LinearGradient id="drawer-fade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={pageBg} stopOpacity="0" />
                <Stop offset="0.5" stopColor={pageBg} stopOpacity="0.72" />
                <Stop offset="1" stopColor={pageBg} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={size.w} height={FADE_H} fill="url(#drawer-fade)" />
          </Svg>
        </View>
      )}

      <View onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={{ paddingTop: insets.top + 18, paddingBottom: 20 }} className="px-7">
        {/*
          Podcrta OVDJE dobiva `heroAccent`, ne koraljnu (6.8.2026.):
          zaglavlje ladice crta gradijent trenutnog vremena, a na toplim
          narančastim podlogama se koraljna utapa. Kod wordmarka "Podcrt"
          akcent NOSI cijeli logo, pa bi se bez ovoga sveo na sam tekst.
        */}
        {/*
          Boja teksta PRATI GRADIJENT, ne temu (8.8.2026.).

          Zaglavlje ladice stoji IZRAVNO na gradijentu vremena, pa vrijedi
          isto pravilo kao u heroju. Otkad je vedar dan tamnoplav, `ink` je
          ovdje u svijetloj temi bio taman na tamnom i wordmark se gubio.
        */}
        <Wordmark color={headerFg} accent={heroAccent(bundle.current.code, bundle.current.isDay)} textSize={16} />

        {/*
          Raspored "vrijeme lijevo, ime desno" (Markov odabir 6.8.2026.):
          velika temperatura i ikona vremena čine par slijeva, ime mjesta
          i opis stoje uz njih. Prije su ovdje bila ČETIRI retka teksta
          jedan ispod drugog — to je izgledalo kao popis, ne kao zaglavlje.
        */}
        <View className="mt-4 flex-row items-center gap-3">
          <Text
            className="font-grotesk-bold"
            // Bez negativnog razmaka: stezao je prvu znamenku uz rub
            // okvira i rezao je (isti bug kao na velikoj brojci heroja).
            style={{ fontSize: 40, lineHeight: 46, paddingHorizontal: 2, color: headerFg }}
          >
            {Math.round(convertTemp(bundle.current.temp, tempUnit))}°
          </Text>
          <View className="flex-1">
            <Text className="font-grotesk-bold text-[15px]" style={{ color: headerFg }}>
              {bundle.place.name}
            </Text>
            <Text
              className="font-grotesk-medium text-[12.5px]"
              style={{ color: headerFg, opacity: 0.65 }}
            >
              {condition.label} · {t.home.feelsLike.toLowerCase()} {Math.round(convertTemp(bundle.current.feelsLike, tempUnit))}°
            </Text>
          </View>
          {/* Ikona vremena zatvara par — isti glif kao u traci sati. */}
          <ConditionIcon size={34} strokeWidth={1.9} color={headerFg} />
        </View>
      </View>
    </View>
  );
}

/**
 * Sadržaj ladice (zdesna): zaglavlje s vremenom odabranog mjesta, gradovi
 * s TRENUTNOM temperaturom i ikonom (iz burin:last-weather — bez ijednog
 * novog upita), slojevi karte s izravnim ulazom, pa aplikacija.
 */
export function DrawerContent({ navigation }: { navigation: DrawerNav }) {
  const pathname = usePathname();
  const { fg, dark } = useThemeColors();
  const saved = useCities((s) => s.saved);
  const selected = useCities((s) => s.selected);
  const select = useCities((s) => s.select);
  const addCity = useCities((s) => s.addCity);

  /** Grad koji se trenutno gleda, a nije među spremljenima. */
  const unsavedSelected = selected && !saved.some((c) => c.id === selected.id) ? selected : null;
  const byPlaceId = useLastWeather((s) => s.byPlaceId);
  const tempUnit = useSettings((s) => s.tempUnit);

  const mapLayer = useMapTimeline((s) => s.layer);
  const setLayer = useMapTimeline((s) => s.setLayer);
  const resetStep = useMapTimeline((s) => s.resetStep);
  const stopPlay = useMapTimeline((s) => s.stop);

  /*
   * Zaglavlje pokazuje mjesto s heroja. Za "Moja lokacija" (selected je
   * null) se NE pokreće GPS iz ladice — uzima se najsvježiji GPS paket iz
   * pohrane; dok ga nema, zaglavlje je samo naslov.
   */
  const headerBundle = selected
    ? byPlaceId[selected.id]
    : Object.values(byPlaceId)
        .filter((b) => b.place.isGps)
        .sort((a, b) => b.fetchedAt - a.fetchedAt)[0];

  /*
   * `select` PRVI, pa zatvaranje i navigacija (dorada 6.8.2026.).
   *
   * Odgađanje `select`-a u sljedeći kadar zvučalo je logično, ali je na
   * uređaju dalo gore: početna bi se nacrtala sa STARIM gradom pa tek u
   * idućem kadru preskočila na novi — vidjelo se "štekanje" na sekundu
   * dok se boje i temperatura ne preslože. Ovako početna odmah dočeka
   * novi grad (sa skeletonom ako podaci još nisu tu).
   *
   * Pravi uzrok sporosti bio je drugdje: `persist` je pri svakoj
   * promjeni mjesta serijalizirao stotine kB na JS threadu — vidi
   * `slimForDisk` u `store/lastWeather.ts`.
   */
  const goHome = (place: Place | null) => {
    select(place);
    navigation.closeDrawer();
    // `navigate` na postojeći korijen POPA stack do početne — ne gomila.
    router.navigate("/");
  };

  const go = (path: "/search" | "/settings" | "/sources" | "/warnings") => {
    navigation.closeDrawer();
    /*
     * Prvo do korijena, pa na podekran: stack je tada uvijek
     * [Početna, podekran] i swipe natrag vodi na početnu. Bez ovoga se
     * povijest gomilala (Upozorenja → Postavke) pa je swipe iz Postavki
     * odveo u Upozorenja — besmisleno (nađeno na uređaju 6.8.2026.).
     */
    if (router.canDismiss()) router.dismissAll();
    router.navigate(path);
  };

  /**
   * Izravan ulaz u sloj karte: postavi sloj PRIJE navigacije (mapTimeline
   * je dijeljeni zustand), uz isti oprez kao čipovi — prijelaz između
   * vrsta crte (okviri <-> sati) resetira korak, play se zaustavlja.
   */
  const goMapLayer = (id: MapLayerId) => {
    if (mapLayerById(mapLayer).timeline !== mapLayerById(id).timeline) resetStep();
    stopPlay();
    setLayer(id);
    navigation.closeDrawer();
    router.navigate("/map");
  };

  const onHome = pathname === "/";
  const onMap = pathname === "/map";

  /*
   * Boja aktivnog GRADA prati podlogu (6.8.2026.): rep gradijenta
   * zaglavlja se prelijeva preko prvih stavki s gradovima (`FADE_H`), pa
   * na toplim narančastim vremenima koraljna ondje gubi kontrast. Ostale
   * grupe (KARTE, APLIKACIJA) stoje na mist podlozi i ostaju koraljne.
   */
  const cityAccent = headerBundle
    ? heroAccent(headerBundle.current.code, headerBundle.current.isDay)
    : ACCENT_CORAL;

  /**
   * Temperatura + ikona vremena za grad, ako je ikad dohvaćen.
   *
   * Uz njih ide i značka vjetra (6.8.2026.): priobalju je bura glavni
   * podatak, pa se jak vjetar vidi u samoj listi. Značke nema ispod
   * 10 m/s, pa u mirnom vremenu red izgleda isto kao prije.
   */
  const cityRight = (place: Place): ReactNode => {
    const bundle = byPlaceId[place.id];
    if (!bundle) return undefined;
    const { Icon } = codeToCondition(bundle.current.code, bundle.current.isDay);
    return (
      <View className="flex-row items-center gap-1.5">
        {/* Gradovi su BIJELE kartice — bijela vjetrulja bi bila nevidljiva. */}
        <WindFlag speedKmh={bundle.current.windGusts} size={20} tone={dark ? "dark" : "card"} />
        <Icon size={18} strokeWidth={2} color={fg} opacity={0.6} />
        <Text className="font-grotesk-bold text-[17px] text-ink dark:text-paper">{Math.round(convertTemp(bundle.current.temp, tempUnit))}°</Text>
      </View>
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-mist dark:bg-night"
      contentContainerStyle={{ paddingBottom: 24 }}
      /*
       * Ladica se NE smije povlačiti iznad vrha (dorada 6.8.2026.): iznad
       * gradijentnog zaglavlja provirivala je bijela/mist podloga i lomila
       * ga. Ovdje nema pull-to-refresha koji bi to trebao, pa se
       * odskakivanje jednostavno gasi na obje platforme.
       */
      bounces={false}
      overScrollMode="never"
    >
      <Header bundle={headerBundle} tempUnit={tempUnit} />

      <GroupLabel>{t.drawer.cities}</GroupLabel>
      <View className="gap-2">
        <Item label={t.drawer.myLocation} Icon={MapPin} card accent={cityAccent} active={onHome && selected === null} onPress={() => goHome(null)} />

        {/*
          Grad koji se gleda, a NIJE spremljen (dorada 6.8.2026.): stoji
          na vrhu s gumbom za spremanje, pa se omiljeni dodaju odavde bez
          povratka u tražilicu. Nakon spremanja se sam preseli u popis.
        */}
        {unsavedSelected && (
          <Item
            label={unsavedSelected.name}
            card
            accent={cityAccent}
            active={onHome}
            right={
              <View className="flex-row items-center gap-3">
                {cityRight(unsavedSelected)}
                <Pressable hitSlop={12} accessibilityRole="button" accessibilityLabel={t.drawer.saveCity} onPress={() => addCity(unsavedSelected)}>
                  <BookmarkPlus size={21} strokeWidth={2} color={ACCENT_CORAL} />
                </Pressable>
              </View>
            }
            onPress={() => goHome(unsavedSelected)}
          />
        )}

        {/*
          Najviše 6, najnoviji prvo (dorada 6.8.2026.): ladica je brzi
          preklopnik, ne arhiv — puna lista je u tražilici. `addCity`
          dodaje na kraj, pa je obrnuti redoslijed = najnovije prvo.
        */}
        {[...saved]
          .reverse()
          .slice(0, 6)
          .map((city) => (
            <Item key={city.id} label={city.name} card accent={cityAccent} active={onHome && selected?.id === city.id} right={cityRight(city)} onPress={() => goHome(city)} />
          ))}
        {/*
          Više od 6 spremljenih: "Vidi više" otvara tražilicu s punom
          listom. Parametar `focus=0` je maknut 6.8.2026. — tipkovnica se
          tamo više NIKAD ne otvara sama, pa ga nema što gasiti.
        */}
        {saved.length > 6 && <Item label={t.drawer.seeAll} Icon={ChevronRight} onPress={() => go("/search")} />}
        <Item label={t.search.placeholder} Icon={Search} active={pathname === "/search"} onPress={() => go("/search")} />
      </View>

      {/*
        Slojevi karte s izravnim ulazom (dorada 6.8.2026., po referenci) —
        generirano iz MAP_LAYERS, pa dodavanje sloja ostaje jedan unos.
      */}
      <GroupLabel>{t.drawer.maps}</GroupLabel>
      <View className="gap-0.5">
        {MAP_LAYERS.map((layer) => (
          <Item
            key={layer.id}
            label={layer.label}
            Icon={LAYER_ICONS[layer.id].Icon}
            iconColor={LAYER_ICONS[layer.id].color}
            active={onMap && mapLayer === layer.id}
            disabled={!isLayerAvailable(layer)}
            onPress={() => goMapLayer(layer.id)}
          />
        ))}
      </View>

      <GroupLabel>{t.drawer.app}</GroupLabel>
      <View className="gap-0.5">
        <Item label={t.common.warnings} Icon={TriangleAlert} iconColor={WARNINGS_COLOR} active={pathname === "/warnings"} onPress={() => go("/warnings")} />
        <Item label={t.settings.title} Icon={Settings} active={pathname === "/settings"} onPress={() => go("/settings")} />
        <Item label={t.sources.title} Icon={Info} active={pathname === "/sources"} onPress={() => go("/sources")} />
      </View>
    </ScrollView>
  );
}
