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
  },
  android: {
    package: "com.markop.burin",
    adaptiveIcon: {
      backgroundColor: "#0E0E0E",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    config: {
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "" },
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
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
};

export default config;
