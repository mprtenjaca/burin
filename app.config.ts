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
    /*
     * App Group za widget (7.8.2026.). Mora stajati i OVDJE, ne samo u
     * `expo-widgets` pluginu: to je zajednički sandbox, pa ga obje strane
     * moraju imati u entitlementima. Aplikacija bez njega ne može
     * upisati podatke koje widget čita.
     */
    entitlements: {
      "com.apple.security.application-groups": ["group.com.markop.burin"],
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
    /*
     * Od SDK 57 se ova dva moraju NAVESTI IZRIJEKOM (7.8.2026.). Prije su
     * se autolinkirala; `expo install --fix` ih traži u `plugins`, ali ih
     * ne može sam upisati jer je ovo dinamički config (`app.config.ts`),
     * pa je dodano ručno.
     */
    "expo-font",
    "expo-status-bar",
    /*
     * ANDROID widget (7.8.2026.) — zaseban paket od iOS-a.
     *
     * `expo-widgets` na Androidu ima samo KOSTUR (njegov Glance widget
     * crta doslovno `Text(widgetName)`), pa Android ide kroz
     * `react-native-android-widget`. Isti podaci i isti izgled, druga
     * knjižnica — vidi `src/widgets/android/`.
     *
     * `updatePeriodMillis` ima MINIMUM od 30 minuta (Android ga niže ne
     * dopušta iz manifesta); kraće bi tražilo WorkManager i trošilo
     * bateriju. Widget se i inače osvježi kad aplikacija dohvati podatke.
     */
    [
      "react-native-android-widget",
      {
        widgets: [
          {
            name: "BurinSmall",
            label: "Burin",
            description: "Trenutna temperatura i opis vremena.",
            minWidth: "140dp",
            minHeight: "140dp",
            targetCellWidth: 2,
            targetCellHeight: 2,
            resizeMode: "none",
            updatePeriodMillis: 1800000,
          },
          {
            name: "BurinMedium",
            label: "Burin (široki)",
            description: "Temperatura, opis, dnevni raspon i udari vjetra.",
            minWidth: "300dp",
            minHeight: "140dp",
            targetCellWidth: 4,
            targetCellHeight: 2,
            resizeMode: "horizontal",
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
    /*
     * iOS widget (7.8.2026.). `groupIdentifier` je App Group — widget je
     * ZASEBAN PROCES u drugom kontejneru i bez njega ne može primiti ni
     * jedan podatak od aplikacije (AsyncStorage mu je nedostupan).
     *
     * `name` mora biti identičan imenu u `createWidget()`; po njemu iOS
     * spaja nativni target s TS rasporedom.
     *
     * Widget je nativni target → dodavanje ili promjena OVOG bloka traži
     * rebuild. Mijenjanje samo izgleda u `BurinWidget.tsx` ide reloadom.
     */
    [
      "expo-widgets",
      {
        groupIdentifier: "group.com.markop.burin",
        widgets: [
          {
            name: "BurinWeather",
            displayName: "Burin",
            description: "Trenutna temperatura, opis vremena i dnevni raspon.",
            /*
             * `accessoryCircular` je LUK s trenutnom temperaturom na
             * dnevnom rasponu (Markov odabir 7.8.2026., po Appleovom
             * widgetu): `Gauge` u stilu `circular` s min/max na krajevima.
             */
            supportedFamilies: [
              "systemSmall",
              "systemMedium",
              "accessoryRectangular",
              "accessoryCircular",
            ],
            /*
             * Bez ovoga iOS ostavi svoje margine oko sadržaja, pa
             * gradijent ne dolazi do ruba pločice (vidi `Backdrop`).
             */
            contentMarginsDisabled: true,
          },
        ],
      },
    ],
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
