import "../global.css";

import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";

import { DrawerContent } from "@/components/DrawerContent";
import { t } from "@/i18n";
import { useSettings } from "@/store/settings";
import { colors } from "@/theme/colors";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, gcTime: 24 * 60 * 60 * 1000 },
  },
});

export default function RootLayout() {
  const theme = useSettings((s) => s.theme);
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

  const dark = colorScheme === "dark";

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Drawer
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
