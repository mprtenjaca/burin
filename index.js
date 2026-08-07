/**
 * Ulazna točka aplikacije (7.8.2026.).
 *
 * Postoji SAMO zbog Android widgeta: njegov headless zadatak mora biti
 * registriran PRIJE nego React Native pokrene aplikaciju, jer ga Android
 * može pozvati i kad aplikacija ne radi.
 *
 * SVE ide kroz `require`, ne `import`: ES uvozi se HOISTAJU, pa bi se
 * `expo-router/entry` izvršio prije registracije bez obzira na to gdje
 * stoji u datoteci — a onda bi Android zadatak ostao neregistriran.
 *
 * Registracija je u `try` i samo za Android: na iOS-u tog paketa nema u
 * grafu, a widget ondje ide preko `expo-widgets`.
 */
const { Platform } = require("react-native");

if (Platform.OS === "android") {
  try {
    const { registerWidgetTaskHandler } = require("react-native-android-widget");
    const { widgetTaskHandler } = require("./src/widgets/android/widgetTaskHandler");
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // Bez widgeta aplikacija radi normalno — ukras ne smije rušiti start.
  }
}

require("expo-router/entry");
