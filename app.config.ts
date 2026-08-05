import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Burin",
  slug: "burin",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "burin",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.markop.burin",
    supportsTablet: false,
    infoPlist: {
      // Aplikacija koristi samo standardni HTTPS — bez toga EAS pri svakom
      // buildu pita za izvozne propise o kriptografiji.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.markop.burin",
    adaptiveIcon: {
      backgroundColor: "#0E0E0E",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    // Nativni modul (nije u Expo Go) — traži dev build; na iOS-u plugin
    // dodaje $MLRN.post_install u Podfile.
    "@maplibre/maplibre-react-native",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Burin koristi tvoju lokaciju za prikaz vremena u tvom mjestu.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  // EAS projekt (expo.dev/accounts/mprtenja/projects/burin). Dinamički config
  // se ne može sam upisati, pa `eas init` traži da se projectId doda ručno.
  extra: {
    eas: {
      projectId: "a3051112-d9b2-49cd-9e93-d2eeffde3d52",
    },
  },
  owner: "mprtenja",
};

export default config;
