import "../global.css";

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

  useEffect(() => {
    setColorScheme(theme);
  }, [theme, setColorScheme]);

  const dark = colorScheme === "dark";

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Drawer
        drawerContent={(props) => <DrawerContent navigation={props.navigation} />}
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: dark ? colors.night : colors.paper },
          headerTintColor: dark ? colors.paper : colors.ink,
          headerTitleStyle: { fontWeight: "400" },
          drawerStyle: { backgroundColor: dark ? colors.night : colors.paper },
          sceneStyle: { backgroundColor: dark ? colors.night : colors.paper },
        }}
      >
        <Drawer.Screen name="index" options={{ title: t.common.weather }} />
        <Drawer.Screen name="map" options={{ title: t.map.title }} />
        <Drawer.Screen name="search" options={{ title: t.search.title }} />
        <Drawer.Screen name="settings" options={{ title: t.settings.title }} />
        <Drawer.Screen name="sources" options={{ title: t.sources.title }} />
      </Drawer>
    </QueryClientProvider>
  );
}
