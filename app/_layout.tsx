import "../global.css";

import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { experimental_createQueryPersister } from "@tanstack/query-persist-client-core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import { InteractionManager } from "react-native";

import { DrawerContent } from "@/components/DrawerContent";
import { useRefreshSavedCities } from "@/hooks/useRefreshSavedCities";
import { t } from "@/i18n";
import { useLanguage } from "@/i18n/useLanguage";
import { useSettings } from "@/store/settings";
import { QUERY_BUSTER, QUERY_MAX_AGE_MS, QUERY_PREFIX, shouldPersistQuery } from "@/utils/queryPersist";
import { colors } from "@/theme/colors";

/*
 * `gcTime` 60 min, ne 24 h (10.9.2026.). Neopaženi upiti (grad koji je
 * korisnik napustio) ostaju u MEMORIJI do isteka: s 24 h je svaki
 * posjećeni grad — devet upita, uključivo dva sirova odgovora s po 384
 * satne točke — živio u RAM-u cijeli dan. Sat je dovoljan za „vratio sam
 * se za minutu"; dulje pamćenje je posao DISKA: per-query persister
 * (`experimental_createQueryPersister`) čuva zapis po upitu, a GC u
 * memoriji ga ne dira. Iznimke s duljim `gcTime` stoje uz sam upit
 * (DHMZ feed, Štampar).
 */
/**
 * KEŠ UPITA NA DISKU — PO UPITU (10.9.2026.).
 *
 * `experimental_createQueryPersister` omota `queryFn` svakog upita: prvi
 * poziv nakon pokretanja najprije pročita zapis s diska (ključ = hash
 * upita) i vrati ga ODMAH; ako je stariji od `staleTime`, refetch ide u
 * pozadini. Za poznati grad to znači: nema kapanja odgovora i nema skoka
 * temperature — sve što je jučer bilo dohvaćeno, uključivo pristranost
 * modela koja je stizala zadnja i pomicala brojku, tu je prije prvog
 * kadra. Rješava i „14 dana offline" za posjećene gradove.
 *
 * ZAŠTO PO UPITU, A NE `persistQueryClient`: onaj serijalizira CIJELI keš
 * pri svakoj promjeni — isti obrazac zbog kojeg je `hourlyAll` izbačen s
 * diska u `lastWeather` (stotine kB na JS threadu usred prebacivanja
 * grada). Ovdje je zapis po upitu (~70 kB za prognozu, sitno za ostalo),
 * a GC u memoriji (`gcTime` 60 min) disk ne dira — RAM ostaje omeđen,
 * disk pamti dan. Zajednica: „storing queries individually … when cache
 * reaches several MB" (TanStack #2649, #6213).
 *
 * Što NE ide na disk, prefiks, `maxAge` i `buster` stoje u
 * `utils/queryPersist.ts` — čist modul s testom (kamere s tokenom koji
 * istječe NIKAD ne smiju na disk). Zapisi stariji od `maxAge` čiste se
 * jednom po pokretanju (`persisterGc` niže).
 */

const queryPersister = experimental_createQueryPersister({
  storage: {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
    /*
     * `persisterGc` čisti kroz `entries()`, kojeg AsyncStorage nema —
     * sastavlja se iz `getAllKeys` + `multiGet`, samo za naše ključeve.
     */
    entries: async () => {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(QUERY_PREFIX));
      const pairs = await AsyncStorage.multiGet(keys);
      return pairs.filter((pair): pair is [string, string] => pair[1] != null);
    },
  },
  prefix: QUERY_PREFIX,
  maxAge: QUERY_MAX_AGE_MS,
  buster: QUERY_BUSTER,
  filters: { predicate: (q) => shouldPersistQuery(q.queryKey) },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, gcTime: 60 * 60 * 1000, persister: queryPersister.persisterFn },
  },
});

export default function RootLayout() {
  const theme = useSettings((s) => s.theme);
  /*
   * Jezik se razrješava OVDJE, u korijenu (6.8.2026.): hook postavi
   * modul-razinski `t` prije nego se ijedan ekran nacrta. Vraćena
   * vrijednost ide u `key` na Draweru — bez toga React Navigation
   * zadrži stare naslove ekrana, jer ih kešira po ekranu i ne prati
   * promjene izvan svog stabla.
   */
  const lang = useLanguage();
  const { colorScheme, setColorScheme } = useColorScheme();

  /*
   * Space Grotesk — potpis redizajna (6.8.2026.). Učitava se iz bundlea
   * (JS-only, bez nativnog rebuilda); do učitavanja se ne renderira ništa,
   * a traje par milisekundi jer je font lokalan asset.
   */
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    setColorScheme(theme);
  }, [theme, setColorScheme]);

  /*
   * Temperature u ladici i tražilici se osvježavaju JEDNIM upitom pri
   * pokretanju (8.8.2026.) — bez toga ondje stoji keširana brojka od
   * zadnjeg otvaranja tog grada. Stoji u korijenu jer keš dijele dva
   * ekrana, pa ne pripada nijednom od njih.
   */
  useRefreshSavedCities();

  /*
   * Stari zapisi keša upita čiste se jednom po pokretanju, IZA prvog
   * prijelaza — čitanje svih ključeva nije posao za kadar u kojem se
   * crta heroj.
   */
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void queryPersister.persisterGc();
    });
    return () => task.cancel();
  }, []);

  const dark = colorScheme === "dark";

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Drawer
        key={lang}
        drawerContent={(props) => <DrawerContent navigation={props.navigation} />}
        screenOptions={{
          /*
           * Svi ekrani crtaju vlastito zaglavlje: početna i karta nemaju
           * header, a podekrani ga dobivaju iz svog Stacka — ondje ide i
           * ← natrag, jer ondje uopće postoji povijest.
           */
          headerShown: false,
          // Zdesna (6.8.2026.): hamburger je gore desno na heroju, pa
          // ladica izlazi ispod prsta koji ju je otvorio.
          drawerPosition: "right",
          drawerStyle: { backgroundColor: dark ? colors.night : colors.mist },
          sceneStyle: { backgroundColor: dark ? colors.night : colors.mist },
        }}
      >
        {/*
          Početna i podekrani žive u ugniježđenom Stacku (`app/(screens)`),
          s početnom kao korijenom — podekrani zato imaju pravi swipe-back
          koji uvijek vodi na početnu, uz kliznu animaciju.
        */}
        <Drawer.Screen name="(screens)" options={{ title: t.common.appName }} />
        {/*
          Karta je FULLSCREEN (dorada 6.8.2026.): svaki piksel ide karti —
          natrag i ostale kontrole crta sam ekran preko nje.
        */}
        <Drawer.Screen name="map" options={{ title: t.map.title }} />
      </Drawer>
    </QueryClientProvider>
  );
}
