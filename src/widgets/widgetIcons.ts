import type { WidgetIconName } from "./iconNames";
import { WIDGET_ICON_NAMES } from "./iconNames";

/**
 * IKONE ZA WIDGET — kopiranje u dijeljeni folder (7.8.2026.).
 *
 * Widget ne može čitati assete aplikacije: to je zaseban proces u drugom
 * kontejneru. Jedino zajedničko tlo je App Group, koji `expo-widgets`
 * izlaže kao `widgetsDirectory`.
 *
 * Zato se PNG ikone pri pokretanju prepišu iz paketa aplikacije u taj
 * folder, a widget ih učita preko `<Image uiImage="file://…">`.
 *
 * Cijeli modul je "best effort": ako bilo što ne uspije, widget dobije
 * prazne putanje i **ne crta ikonu**, ali radi. Ikona je ukras, a widget
 * ne smije pasti zbog ukrasa.
 */

/**
 * `require` je OBAVEZAN za assete (Metro ih tako pakira) i mora biti
 * statičan — dinamički `require(varijabla)` Metro ne vidi, pa datoteka ne
 * uđe u paket. Zato je popis ispisan doslovno.
 */
const SOURCES: Record<WidgetIconName, number> = {
  sun: require("../../assets/widget/sun.png"),
  partly: require("../../assets/widget/partly.png"),
  cloud: require("../../assets/widget/cloud.png"),
  rain: require("../../assets/widget/rain.png"),
  snow: require("../../assets/widget/snow.png"),
  thunder: require("../../assets/widget/thunder.png"),
  fog: require("../../assets/widget/fog.png"),
  night: require("../../assets/widget/night.png"),
  "night-cloudy": require("../../assets/widget/night-cloudy.png"),
  wind: require("../../assets/widget/wind.png"),

  // Pune inačice — zaključani zaslon (vidi `filled` u `iconNames.ts`).
  "sun-fill": require("../../assets/widget/sun-fill.png"),
  "partly-fill": require("../../assets/widget/partly-fill.png"),
  "cloud-fill": require("../../assets/widget/cloud-fill.png"),
  "rain-fill": require("../../assets/widget/rain-fill.png"),
  "snow-fill": require("../../assets/widget/snow-fill.png"),
  "thunder-fill": require("../../assets/widget/thunder-fill.png"),
  "fog-fill": require("../../assets/widget/fog-fill.png"),
  "night-fill": require("../../assets/widget/night-fill.png"),
  "night-cloudy-fill": require("../../assets/widget/night-cloudy-fill.png"),
  "wind-fill": require("../../assets/widget/wind-fill.png"),
};

/** Putanje u dijeljenom folderu, popunjene nakon `syncWidgetIcons`. */
const paths: Partial<Record<WidgetIconName, string>> = {};

let synced = false;

/**
 * Prepiše ikone u dijeljeni folder. Zove se JEDNOM po pokretanju.
 *
 * Kopira se svaki put (a ne samo kad datoteka ne postoji): ikone se mogu
 * promijeniti s novom verzijom aplikacije, a datoteke su sitne (~1.5 kB),
 * pa je provjera skuplja od samog kopiranja.
 */
export async function syncWidgetIcons(): Promise<void> {
  if (synced) return;
  synced = true;

  try {
    /*
     * Lijeni uvozi: `expo-widgets` je nativan i ne postoji na Androidu ni
     * na starijem buildu, a `expo-asset`/`expo-file-system` se ne trebaju
     * dizati ako widgeta nema.
     */
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { widgetsDirectory } = require("expo-widgets") as { widgetsDirectory: string | null };
    if (!widgetsDirectory) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Asset } = require("expo-asset") as {
      Asset: { loadAsync: (m: number) => Promise<{ localUri: string | null }[]> };
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Directory, File } = require("expo-file-system") as {
      Directory: new (...uris: string[]) => { create: (o?: { intermediates?: boolean; idempotent?: boolean }) => void };
      File: new (...uris: string[]) => { copy: (to: unknown) => void; uri: string; delete: () => void; exists: boolean };
    };

    const dir = new Directory(widgetsDirectory);
    dir.create({ intermediates: true, idempotent: true });

    for (const name of WIDGET_ICON_NAMES) {
      const [asset] = await Asset.loadAsync(SOURCES[name]);
      if (!asset?.localUri) continue;

      const target = new File(widgetsDirectory, `${name}.png`);
      /*
       * `copy` pada ako odredište postoji, pa se staro prvo briše.
       * Obavijeno u `try` zasebno: neuspjeh jedne ikone ne smije
       * zaustaviti ostale.
       */
      try {
        if (target.exists) target.delete();
        new File(asset.localUri).copy(target);
        paths[name] = target.uri;
      } catch {
        // Ova ikona ostaje bez putanje — widget je preskoči.
      }
    }
  } catch {
    // Widget nije dostupan (Android, stari build) — bez ikona.
  }
}

/**
 * Putanja do ikone ili PRAZAN STRING kad je nema.
 *
 * Prazan string, a ne `undefined`: `WidgetProps` prelazi granicu procesa,
 * pa je jedan tip (string) sigurniji od izbora string-ili-ništa.
 */
export function widgetIconPath(name: WidgetIconName): string {
  return paths[name] ?? "";
}
