/**
 * UGOVOR IZMEĐU APLIKACIJE I WIDGETA (7.8.2026.).
 *
 * Stoji u ZASEBNOJ datoteci, bez ijednog uvoza, iz jednog razloga:
 * `BurinWidget.tsx` uvlači `expo-widgets` i `@expo/ui/swift-ui`, oboje
 * NATIVNO. Da tip živi tamo, `widgetData.ts` bi ga uvozom povukao i
 * srušio svoje testove ("Cannot find native module 'ExpoWidgets'") —
 * isto pravilo koje je već jednom naučeno na `MapTimeline` + AsyncStorage.
 *
 * Ovako `widgetData` ostaje čista logika koja se testira, a nativno se
 * dotiče samo `pushWidget`.
 */

/**
 * Ono što widget crta. Namjerno PLOSNATO i samo primitivi — svaki prop
 * prelazi granicu procesa, pa ovdje ne idu `Date`, ugniježđeni objekti
 * ni funkcije.
 *
 * Boje se šalju IZRAČUNATE (`stops`, `fg`), a ne kao WMO kod: gradijent
 * i čitljivost teksta žive u `weatherLook.ts`, koji widget ne može
 * uvesti (drugi proces, drugi paket). Tako ostaje JEDAN izvor istine za
 * paletu — vidi `widgetData.ts`.
 */
export type WidgetProps = {
  /** Ime mjesta ("Polača"). */
  place: string;
  /** Temperatura, već pretvorena u korisnikovu jedinicu i zaokružena. */
  temp: number;
  /** "°" ili "°F" — Celzijus ne nosi slovo (odluka projekta). */
  unit: string;
  /** Opis vremena na jeziku sučelja ("Vedro", "Clear"). */
  condition: string;
  /** Dnevni maksimum i minimum, iste jedinice kao `temp`. */
  tMax: number;
  tMin: number;
  /**
   * Tri stopa gradijenta iz `weatherGradient()`. Uvijek 3 — širina niza
   * je dio ugovora, jer `foregroundStyle` traži boje unaprijed.
   */
  stops: [string, string, string];
  /** Boja teksta, iz `readableOn(stops[1])` — prati podlogu, ne temu. */
  fg: string;
  /**
   * Ima li udara vrijednih prikaza (iznad praga značke).
   *
   * Postoji jer `gusts` VIŠE NE SMIJE BITI `null` (popravak 8.8.2026.).
   * Propovi prelaze u nativni `[String: Any]`, a JS `null` ondje nema
   * parnjaka — konverzija je pucala kao `Exception in HostFunction`, pa
   * cijela crta nije bila upisana i widget je ostajao prazan.
   *
   * Odsutnost se zato izražava BOOLEANOM, a `gusts` nosi 0 kad udara
   * nema. Isto pravilo vrijedi za sve buduće propove: preko granice idu
   * samo brojevi, stringovi i booleani — nikad `null` ni `undefined`.
   */
  hasGusts: boolean;
  /** Udari vjetra u korisnikovoj jedinici; 0 kad je ispod praga. */
  gusts: number;
  /** Oznaka jedinice vjetra ("m/s"). */
  windUnit: string;
  /** "14:20" — kad su podaci dohvaćeni. */
  fetchedAt: string;
  /**
   * PUTANJA do ikone vremena (`file:///…/ExpoWidgets/sun.png`).
   *
   * Ide kao putanja, a ne ime: `@expo/ui/swift-ui` nema crtaće primitive
   * za putanje (nema `Path` ni `Canvas`), pa se naši glifovi ne mogu
   * nacrtati komponentama — učitavaju se kao PNG preko `Image uiImage`.
   * Datoteke aplikacija kopira u dijeljeni App Group folder pri pokretanju
   * (vidi `widgetIcons.ts`). Prazan string = ikona još nije spremna, i
   * tada se ne crta ništa.
   */
  icon: string;
  /** Putanja do ikone vjetra ("zapuh"); prazno kad udara nema. */
  windIcon: string;
  /**
   * PUNA inačica ikone vremena, za zaključani zaslon.
   *
   * iOS ondje crta u `vibrant` načinu — sve postane jedan ton i maska, pa
   * se obrisne ikone stanje do neprimjetnosti. Zato lock screen dobiva
   * ispunjeni oblik, kao i Appleov widget.
   */
  iconFill: string;
  /**
   * Ambijentalni sloj preko gradijenta ("rays", "stars", "rain"…).
   *
   * Ime, a ne gotov oblik: sloj se slaže od `Rectangle`/`Circle` u samom
   * widgetu, pa ovamo prelazi samo odluka KOJI sloj crtati. Vrijednosti
   * su `AmbientKind` iz `iconNames.ts`.
   */
  ambient: string;
  /**
   * Dnevni raspon kao BROJEVI u korisnikovoj jedinici, za `Gauge` na
   * zaključanom zaslonu. `temp`/`tMin`/`tMax` su isti podaci, ali `Gauge`
   * traži čiste brojeve bez znaka stupnja.
   */
  gaugeMin: number;
  gaugeMax: number;
};
