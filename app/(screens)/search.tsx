import { router } from "expo-router";
import { Bookmark, BookmarkCheck, History, MapPin, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { geocode } from "@/api/openMeteo";
import type { Place } from "@/api/types";
import { ErrorView } from "@/components/ErrorView";
import { Hairline } from "@/components/Section";
import { WindFlag } from "@/components/WindFlag";
import { useLocation } from "@/hooks/useLocation";
import { t } from "@/i18n";
import { useCities } from "@/store/cities";
import { useLastWeather } from "@/store/lastWeather";
import { useSearchHistory } from "@/store/searchHistory";
import { useSettings } from "@/store/settings";
import { useThemeColors } from "@/theme/useThemeColors";
import { convertTemp, tempUnitSuffix } from "@/utils/format";
import { codeToCondition } from "@/utils/weatherCodes";
import { ACCENT_CORAL } from "@/utils/weatherLook";

const DEBOUNCE_MS = 350;

/** Red mjesta u listi (rezultat ili spremljeni grad). */
function PlaceRow({
  place,
  onOpen,
  action,
  active = false,
  showWeather = false,
}: {
  place: Place;
  onOpen: () => void;
  action: React.ReactNode;
  /** Trenutno prikazano mjesto — istaknuto koraljnim, kao u ladici. */
  active?: boolean;
  /**
   * Ikona vremena + značka vjetra uz temperaturu (6.8.2026.). Uključeno na
   * spremljenim gradovima, povijesti i "Mojoj lokaciji" — dakle na mjestima
   * koja su već jednom otvorena, pa podatke ima `burin:last-weather`. Na
   * REZULTATIMA pretrage se ne prikazuje: tamo su mjesta koja korisnik
   * najčešće nikad nije otvorio, pa bi red bio prazan ili nedosljedan.
   */
  showWeather?: boolean;
}) {
  const { fg, dark } = useThemeColors();
  const tempUnit = useSettings((s) => s.tempUnit);
  /*
   * Selektor vraća BROJ, ne objekt (dorada 6.8.2026.): `byPlaceId[id]`
   * daje novu referencu pri svakom zapisu u store, pa su se svi redovi
   * liste re-renderirali odjednom. Broj se uspoređuje po vrijednosti.
   *
   * Isto vrijedi i za kod vremena i brzinu vjetra — tri broja, tri
   * selektora, nijedan ne stvara novu referencu.
   */
  const temp = useLastWeather((s) => s.byPlaceId[place.id]?.current.temp);
  const code = useLastWeather((s) => s.byPlaceId[place.id]?.current.code);
  const isDay = useLastWeather((s) => s.byPlaceId[place.id]?.current.isDay);
  /* Značka ide po UDARIMA, ne po stalnom vjetru — vidi `CurrentWeather`. */
  const windGusts = useLastWeather((s) => s.byPlaceId[place.id]?.current.windGusts);
  const [pressed, setPressed] = useState(false);

  const WeatherIcon = showWeather && code !== undefined ? codeToCondition(code, isDay ?? true).Icon : null;

  return (
    <View className="flex-row items-center px-4">
      {/*
        Vidljiva potvrda dodira preko VLASTITOG stanja: `style` kao
        funkcija ovdje ne radi jer ga NativeWind (className → style)
        prepisuje — isto kao u ladici (6.8.2026.).
      */}
      <Pressable
        className="flex-1 py-4"
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={pressed ? { opacity: 0.5, transform: [{ scale: 0.97 }] } : undefined}
        onPress={onOpen}
      >
        <Text className={`font-grotesk-medium text-[17px] ${active ? "" : "text-ink dark:text-paper"}`} style={active ? { color: ACCENT_CORAL } : undefined}>
          {place.name}
        </Text>
        {place.country && <Text className="font-grotesk text-[13.5px] text-ink/65 dark:text-paper/65">{place.country}</Text>}
      </Pressable>
      {/*
        Vrijeme iz burin:last-weather — bez ijednog novog upita. Značka
        vjetra stoji PRVA (lijevo od ikone vremena) jer je za priobalje
        najvažnija; ispod 10 m/s je nema pa red izgleda kao prije.
      */}
      {showWeather && windGusts !== undefined && (
        /* 22 px — nešto veća od ikone vremena (18), da bura odmah "skoči". */
        <View className="mr-1.5">
          {/* Redovi su BIJELE kartice — bijela vjetrulja bi bila nevidljiva. */}
          <WindFlag speedKmh={windGusts} size={20} tone={dark ? "dark" : "card"} />
        </View>
      )}
      {WeatherIcon && (
        <View className="mr-1.5">
          <WeatherIcon size={18} strokeWidth={2} color={fg} opacity={0.6} />
        </View>
      )}
      {temp !== undefined && (
        <Text className="mr-3 font-grotesk-bold text-[17px] text-ink dark:text-paper">
          {Math.round(convertTemp(temp, tempUnit))}
          {tempUnitSuffix(tempUnit)}
        </Text>
      )}
      {action}
    </View>
  );
}

/**
 * Tražilica gradova (redizajn 6.8.2026.): mist podloga, bijele kartice,
 * Space Grotesk, veći tekstovi. Hrvatska mjesta idu na vrh rezultata
 * (`croatiaFirst` u geokodiranju) — korisniku u Hrvatskoj su tuđi
 * kontinenti gotovo uvijek šum. Natrag se ide strelicom u headeru.
 */
export default function SearchScreen() {
  const { fg, dark } = useThemeColors();
  const [gpsAsked, setGpsAsked] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const saved = useCities((s) => s.saved);
  const selected = useCities((s) => s.selected);
  const addCity = useCities((s) => s.addCity);
  const removeCity = useCities((s) => s.removeCity);
  const select = useCities((s) => s.select);

  /*
   * GPS se pri otvaranju ekrana traži SAMO ako je mjesto s heroja već
   * "Moja lokacija" (`selected === null`) — tada je dozvola očito dana i
   * red odmah pokazuje mjesto. Inače se čeka dodir: dizati sustavni
   * dijalog za dozvolu samo zato što je korisnik otvorio tražilicu je
   * nametljivo. `gpsAsked` pamti da je dodir bio, pa se "Tražim
   * lokaciju..." ne pokazuje prije njega.
   */
  const gps = useLocation(selected === null || gpsAsked);

  const history = useSearchHistory((s) => s.entries);
  const addHistory = useSearchHistory((s) => s.add);
  const clearHistory = useSearchHistory((s) => s.clear);

  /*
   * Povijest bez spremljenih gradova — oni imaju svoju listu odmah ispod,
   * dupliranje bi bilo šum. Prvi unos ide na vrh kao "Zadnje gledano".
   */
  const savedIds = new Set(saved.map((p) => p.id));
  const unsavedHistory = history.filter((p) => !savedIds.has(p.id));
  const lastViewed = unsavedHistory[0];
  const olderHistory = unsavedHistory.slice(1, 8);

  /** Spremljeni najnoviji prvo — isti redoslijed kao u ladici. */
  const savedNewestFirst = [...saved].reverse();

  const confirmClearHistory = () =>
    Alert.alert(t.search.clearHistory, t.search.clearHistoryConfirm, [
      { text: t.common.cancel, style: "cancel" },
      { text: t.common.delete, style: "destructive", onPress: clearHistory },
    ]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setFailed(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setFailed(false);
      try {
        setResults(await geocode(q));
      } catch {
        setFailed(true);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, attempt]);

  /*
   * ODZIV PRVO, posao poslije (dorada 6.8.2026.).
   *
   * Redoslijed je bitan i naučen na uređaju:
   *  1. `select` MORA prvi — dok se ne promijeni mjesto, početna bi se
   *     nacrtala sa starim gradom pa tek onda preskočila na novi.
   *  2. navigacija odmah za njim, u istom kadru.
   *  3. čišćenje polja TEK NAKON prijelaza: `setQuery("")` ponovno
   *     pokreće debounce efekt (koji zove `setResults`), a to su bili
   *     dodatni re-renderi cijele liste usred navigacije.
   */
  const open = (place: Place) => {
    select(place);
    // Svako otvaranje ide u povijest (bez duplikata, s granicom).
    addHistory(place);
    router.navigate("/");
    // Polje se čisti pri odlasku: inače se povratkom na tražilicu
    // zatekne stari upit i piše se preko njega.
    setTimeout(() => {
      setQuery("");
      setResults([]);
    }, 250);
  };

  const isSaved = (id: string) => saved.some((p) => p.id === id);

  /**
   * "Moja lokacija" — otvara početnu s GPS mjestom (`select(null)`), isto
   * kao istoimena stavka u ladici. Ne ide u povijest: to nije grad koji se
   * traži, nego stanje "gdje sam".
   */
  const openMyLocation = () => {
    select(null);
    router.navigate("/");
  };

  return (
    <ScrollView className="flex-1 bg-mist dark:bg-night" contentContainerClassName="gap-5 px-4 py-4" keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center rounded-2xl bg-white pr-2 dark:bg-coal">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.search.placeholder}
          placeholderTextColor={dark ? "#FAFAF866" : "#14141466"}
          /*
           * Tipkovnica se NE otvara sama (Markov odabir 6.8.2026.). Ekran
           * je i popis spremljenih gradova i povijesti — najčešći potez je
           * dodir na već poznat grad, a ne tipkanje. Tipkovnica je preko
           * toga skakala i pola liste zaklanjala. Otvara se dodirom na
           * polje.
           */
          autoFocus={false}
          /*
           * Tipkovnica prati temu (6.8.2026.): svijetla na svijetloj,
           * tamna na tamnoj. Na iOS-u je to `keyboardAppearance`; Android
           * ga ignorira i slijedi sustav.
           */
          keyboardAppearance={dark ? "dark" : "light"}
          autoCorrect={false}
          returnKeyType="search"
          className="flex-1 px-4 py-3.5 font-grotesk-medium text-[17px] text-ink dark:text-paper"
        />
        {query.length > 0 && (
          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t.search.clear}
            onPress={() => {
              setQuery("");
              setResults([]);
              setFailed(false);
            }}
            className="px-2 py-2"
          >
            <X size={20} strokeWidth={2} color={fg} opacity={0.45} />
          </Pressable>
        )}
      </View>

      {selected === null && saved.length === 0 && query.length === 0 && <Text className="text-center font-grotesk-medium text-[15px] text-ink/65 dark:text-paper/65">{t.search.pickCityToStart}</Text>}

      {searching && <ActivityIndicator size="small" color={ACCENT_CORAL} />}

      {failed && <ErrorView onRetry={() => setAttempt((n) => n + 1)} />}

      {!failed && query.trim().length >= 2 && !searching && results.length === 0 && (
        <Text className="text-center font-grotesk-medium text-[15px] text-ink/65 dark:text-paper/65">{t.search.noResults}</Text>
      )}

      {results.length > 0 && (
        // mt-2: rezultati se odvajaju od polja za unos (dorada 6.8.2026.).
        <View className="mt-2 rounded-2xl bg-white py-0.5 dark:bg-coal">
          {results.map((place, i) => (
            <View key={`${place.id}-${i}`}>
              {i > 0 && <Hairline />}
              <PlaceRow
                place={place}
                onOpen={() => open(place)}
                action={
                  <Pressable hitSlop={12} onPress={() => (isSaved(place.id) ? removeCity(place.id) : addCity(place))}>
                    {isSaved(place.id) ? <BookmarkCheck size={22} strokeWidth={2} color={ACCENT_CORAL} /> : <Bookmark size={22} strokeWidth={2} color={fg} opacity={0.5} />}
                  </Pressable>
                }
              />
            </View>
          ))}
        </View>
      )}

      {/*
        MOJA LOKACIJA (6.8.2026.) — prva sekcija, iznad "Zadnje gledano":
        u tražilicu se dolazi i da se vrati na "gdje sam", ne samo da se
        traži novi grad. Sekcija je UVIJEK tu: bez dozvole je red poziv da
        se dopusti pristup, pa se odbijena dozvola može dati i odavde.
      */}
      <View className="mt-1 gap-3">
        <Text className="px-1 font-grotesk-bold text-[13.5px] text-ink/55 dark:text-paper/55">{t.search.myLocation}</Text>
        <View className="rounded-2xl bg-white py-0.5 dark:bg-coal">
          {gps.status === "granted" ? (
            <PlaceRow place={gps.place} active={selected === null} showWeather onOpen={openMyLocation} action={<MapPin size={20} strokeWidth={2} color={ACCENT_CORAL} />} />
          ) : (
            <Pressable
              className="flex-row items-center gap-3 px-4 py-4"
              onPress={() => {
                /*
                 * GPS se traži TEK NA DODIR: otvaranje tražilice ne smije
                 * samo od sebe dizati sustavni dijalog za dozvolu.
                 */
                setGpsAsked(true);
                gps.request();
              }}
            >
              <MapPin size={20} strokeWidth={2} color={fg} opacity={0.5} />
              <Text className="font-grotesk-medium text-[16px] text-ink/75 dark:text-paper/75">{gpsAsked && gps.status === "loading" ? t.search.locatingNow : t.search.allowLocation}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Zadnje gledano mjesto iz povijesti — na vrhu, iznad spremljenih. */}
      {lastViewed && (
        <View className="mt-1 gap-3">
          <Text className="px-1 font-grotesk-bold text-[13.5px] text-ink/55 dark:text-paper/55">{t.search.lastViewed}</Text>
          <View className="rounded-2xl bg-white py-0.5 dark:bg-coal">
            <PlaceRow
              place={lastViewed}
              active={selected?.id === lastViewed.id}
              showWeather
              onOpen={() => open(lastViewed)}
              action={
                <Pressable hitSlop={12} onPress={() => addCity(lastViewed)} accessibilityLabel={t.drawer.saveCity}>
                  <Bookmark size={22} strokeWidth={2} color={fg} opacity={0.5} />
                </Pressable>
              }
            />
          </View>
        </View>
      )}

      {/*
        Spremljeni gradovi stoje ISPOD polja i ostaju dostupni i dok se
        traži (dorada 6.8.2026.) — dodir na njih odmah otvara taj grad,
        pa se nedovršena pretraga ne mora prvo brisati. Najnoviji prvo,
        isti redoslijed kao u ladici.
      */}
      {saved.length > 0 && (
        <View className="mt-1 gap-3">
          <Text className="px-1 font-grotesk-bold text-[13.5px] text-ink/55 dark:text-paper/55">{t.search.savedCities}</Text>
          <View className="rounded-2xl bg-white py-0.5 dark:bg-coal">
            {savedNewestFirst.map((place, i) => (
              <View key={place.id}>
                {i > 0 && <Hairline />}
                <PlaceRow
                  place={place}
                  active={selected?.id === place.id}
                  showWeather
                  onOpen={() => open(place)}
                  action={
                    <Pressable hitSlop={12} accessibilityLabel={t.search.remove} onPress={() => removeCity(place.id)}>
                      <X size={20} strokeWidth={2} color={fg} opacity={0.45} />
                    </Pressable>
                  }
                />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Ostatak povijesti — s granicom (max 7), ne do beskraja. */}
      {olderHistory.length > 0 && (
        <View className="mt-1 gap-3">
          <Text className="px-1 font-grotesk-bold text-[13.5px] text-ink/55 dark:text-paper/55">{t.search.history}</Text>
          <View className="rounded-2xl bg-white py-0.5 dark:bg-coal">
            {olderHistory.map((place, i) => (
              <View key={place.id}>
                {i > 0 && <Hairline />}
                <PlaceRow place={place} active={selected?.id === place.id} showWeather onOpen={() => open(place)} action={<History size={19} strokeWidth={2} color={fg} opacity={0.35} />} />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Brisanje povijesti — uz potvrdu, jer se ne da vratiti. */}
      {history.length > 0 && (
        <Pressable onPress={confirmClearHistory} accessibilityRole="button" className="items-center py-3">
          <Text className="font-grotesk-medium text-[14px] text-ink/55 dark:text-paper/55">{t.search.clearHistory}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
