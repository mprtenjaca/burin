import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Burin",
  slug: "burin",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "burin",
  /*
   * SVIJETLA je glavna ikona (Markov odabir 6.8.2026.): zadana tema
   * aplikacije je svijetla, pa je tamna pločica odudarala od ekrana koji
   * se otvori dodirom. Ova vrijednost pokriva Android i web; iOS dobiva
   * tri varijante ispod.
   */
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.markop.burin",
    supportsTablet: false,
    /*
     * iOS 18 bira ikonu po izgledu sustava (Expo SDK 52+ podržava objekt):
     *  - `light`   svijetla pločica, ujedno i zadana
     *  - `dark`    dosadašnja tamna, za tamnu temu sustava
     *  - `tinted`  jednobojna; iOS joj sam nanosi korisnikovu boju, pa
     *              MORA biti sivi glif na CRNOJ podlozi — prozirno ovdje
     *              ne radi kao kod Androidovog monochromea
     */
    icon: {
      light: "./assets/icon.png",
      dark: "./assets/icon-dark.png",
      tinted: "./assets/icon-tinted.png",
    },
    infoPlist: {
      // Aplikacija koristi samo standardni HTTPS — bez toga EAS pri svakom
      // buildu pita za izvozne propise o kriptografiji.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.markop.burin",
    /*
     * Adaptivna ikona = TRI SLOJA. Android NEMA zasebnu tamnu ikonu —
     * `monochrome` je taj mehanizam: uz Material You sustav uzme taj glif
     * i sam ga oboji svojom paletom, jednako u svijetloj i tamnoj temi.
     *
     * `backgroundColor` mora pratiti `backgroundImage` (oboje papirnato):
     * to je boja koju launcher vidi kad sliku maskira u svoj oblik, pa bi
     * tamna vrijednost dala tamni rub oko svijetle pločice.
     */
    adaptiveIcon: {
      backgroundColor: "#FAFAF8",
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
    // Čita jezik sustava za zadani jezik sučelja (6.8.2026.). Samo čitanje
    // postavke uređaja — nema dozvola ni nativnog koda našeg pisanja.
    "expo-localization",
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
