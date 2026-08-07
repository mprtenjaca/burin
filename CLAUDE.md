@AGENTS.md

# Burin — status projekta

Minimalistička vremenska aplikacija za Hrvatsku. Expo SDK 57, TypeScript
strict, Expo Router + Drawer, NativeWind, zustand + AsyncStorage, react-query.

SDK 54 je izvorno odabran da radi u Expo Go (iOS bez Maca). Od 5.8.2026. iOS
ide na EAS dev build (osobna Apple licenca, internal distribution), pa Expo Go
više nije ograničenje — nativni moduli su otvoreni (MapLibre, widget).

**Podignuto na SDK 57 dana 7.8.2026.** (RN 0.86.2, React 19.2.3, TypeScript
6.0.3) da se otvori `expo-widgets` za iOS widget. **Potvrđeno na uređaju**
— aplikacija, karta i ladica rade. Widgeti postoje za obje platforme
(`src/widgets/`, `src/widgets/android/`) i čekaju provjeru.

## Current Status

| Što | Status | Bilješka |
|---|---|---|
| **iOS widget** | **Bio prazan na uređaju; popravak čeka provjeru** | Build 7.8.2026. je dao BIJELU pločicu s "undefined" posvuda, bez ijedne greške. Uzrok nađen i popravljen (vidi Recent Decisions): ikone i upis crte su bili u istom `try`, pa je pad ikona preskočio propove. Sada su odvojeni i **greške se logiraju** — ako se ponovi, u konzoli piše `[burin] widget nije osvježen:` ili `[burin] widget ikone nisu spremne:`. Build `fe2f09e5` je gotov i čeka instalaciju |
| **Android widget** | Kod gotov, build prošao, **čeka provjeru na uređaju** | `react-native-android-widget` 0.21.0; `src/widgets/android/`. Dvije veličine (2×2, 4×2), isti izgled i podaci kao iOS. Prvi EAS build je pao na `checkDuplicateClasses` (sukob `androidx.work`) — popravljeno isključivanjem `expo-widgets` iz Android autolinkinga. Build `50b2679b` je gotov |
| **Engleski jezik** | Kod gotov, **čeka provjeru na uređaju** | 7.8.2026. Puni prijevod + postavka Sustav/Hrvatski/English. Provjeriti: dani u 14-dnevnoj (Thu, ne čet), smjer vjetra (N/NE/E, ne S/SI/I — hrvatski "S" je sjever, engleski JUG), tekst upozorenja (en-GB iz feeda), imena regija ("Knin region") |
| **Ikone (svijetla glavna)** | Kod gotov, **čeka provjeru na uređaju** | 7.8.2026. Papirnata podloga, potezi u tinti + koraljni srednji. iOS 18 set `light`/`dark`/`tinted`, Android tri sloja + `backgroundColor: #FAFAF8`. Provjereno renderom i mjerenjem (1024², alfa samo gdje Android traži) |
| **Vedra noć: zvijezde + mjesec** | Kod gotov, **čeka provjeru na uređaju** | 7.8.2026. `StarsLayer`: 54 sitne koje dišu + 11 krupnih koje SIJEVAJU (bljesak 260 ms, pa mirovanje) uz sjaj oko njih. Mjesec ima pravu mijenu (`moonPhase`), rezan maskom. Prva izvedba je imala prevelik pomak sjene pa je izgledala kao pomrčina |
| Heroj: tekst prati podlogu | Kod gotov, **čeka provjeru na uređaju** | 7.8.2026. `readableOn(stops[1])` umjesto `text-ink dark:text-paper` na 11 mjesta. Bilo je nužno jer je noć sada tamna i u SVIJETLOJ temi, pa je crni tekst padao na tamnoplavo |
| Razmaci u heroju | Dorada u tijeku | Marko fino štima `marginBottom` na imenu mjesta (~143) i `marginTop` na opisu (~230) u `Hero.tsx`. Izmjereno: okvir brojke nosi 38.8 px praznine gore, 36.3 dolje |
| Spinner pull-to-refresh na iPhoneu 13 | Open, ne pomiče se | `progressViewOffset={insets.top + 48}` u `app/(screens)/index.tsx`. Marko javio da povećavanje broja **više ne mijenja ništa** — na +28 se vidjela polovica, na +48 isto. Znači offset nije (jedini) uzrok; vidjeti crta li iOS spinner iza `style={{ backgroundColor: stops[0] }}` na ScrollViewu |
| Font u widgetu je sustavski | Open, svjesno | Widget je zaseban proces i nema Space Grotesk koji `expo-font` učita u aplikaciji. Ubacivanje fonta u widget target je izvedivo, ali zaseban zahvat |
| Traka sati u srednjem widgetu | Open, neodlučeno | Apple i V&R širinu 4×2 plaćaju trakom (6 sati / 3 dana); naš drži min/max i udare. Podaci su već tu (`hourly` ide u `updateTimeline`), pa traka ne bi tražila novo dohvaćanje. Otvoreno je pitanje ikona — SF Symbols rade odmah, ali su Appleov jezik |
| Domet regije: kod kaže 90 km, zapis je govorio 130 | Open, nije greška u radu | `REGION_RANGE_KM = 90` u `useWarnings.ts`; stariji zapis navodi 130 km (dodano zbog grada u Čileu s hrvatskim alarmom). Zaštita radi u oba slučaja — Čile nema feed, a filtar države blokira prelazak granice. Treba samo odlučiti koji je broj točan |
| Polača tip (zaleđe uz morsku postaju) | Open | Postaje su Šibenik/Veli Rat/Knin — sve pretople, pa korekcija **grije** mjesto na 122 m. Zemunika (21 °C, 12 km) nema u feedu; gušćeg DHMZ feeda nema |
| 14-dnevni min/max korekcija | Open | `debiasDaily` radi, ali korekcija mjerenjem se ne primjenjuje na dnevne vrijednosti — mogući blagi nesklad s razdobljima dana |
| Vremenske vijesti / blog | Open, neistraženo | Marko pitao ima li izvora za HR i svijet. Nije istraženo — DHMZ ima vijesti, za svijet treba provjeriti |
| Web kamere | Odgođeno | V&R koristi whatsupcams (komercijalni, bez API-ja); scraping ne dolazi u obzir. Čeka čist izvor (HAK/TZ popis?) |

## Next Step

**Instalirati oba gotova builda i provjeriti widgete.** SDK 57 je već
POTVRĐEN na uređaju (aplikacija i karta rade), pa je ostalo samo ono što
nije viđeno.

Buildovi od 7.8.2026., oba **gotova**:

- iOS `fe2f09e5` — nosi popravak praznog widgeta
- Android `50b2679b` — prvi widget build za Android

```bash
npx eas-cli build:list --limit 2   # linkovi za instalaciju
```

### 1. iOS widget — je li i dalje prazan?

Prethodni build je dao **bijelu pločicu s "undefined"**. Uzrok je nađen
i popravljen, ali NIJE potvrđen na uređaju.

Ako se ponovi, **greška je sada vidljiva** u konzoli (`npx expo start
--dev-client`, pa Metro log):

- `[burin] widget nije osvježen:` → pao je `updateTimeline`
- `[burin] widget ikone nisu spremne:` → pao je `syncWidgetIcons`, ali
  crta se svejedno upisala (widget radi, samo bez ikona)

Tiho gutanje grešaka je maknuto baš zato što se prvi put tražilo
naslijepo.

### 2. Widgeti — redoslijed provjere

1. **Dodavanje na zaslon** — iOS: dugi pritisak → „+“ → Burin (četiri
   veličine). Android: dugi pritisak → Widgeti → Burin (dvije)
2. **Podaci** — Android traži da je aplikacija BAREM JEDNOM dohvatila
   vrijeme prije dodavanja (handler čita `burin:last-weather`)
3. **Gradijent do ruba** — bez bijelog/crnog okvira
4. **Ikone** — moraju se pojaviti
5. **Mala pločica** — najveći vizualni rizik: zvijezde, pahulje i kiša
   moraju se vidjeti i na njoj, ne samo na srednjoj
6. **Zaključani zaslon (iOS)** — pravokutni (pune ikone, H/L) i kružni (luk)
7. **Tintani način (iOS)** — gradijent i ambijent moraju NESTATI

### 3. Ostalo iz ovog kruga, još neviđeno

Engleski (Postavke → Jezik; **N/NE/E** za smjer vjetra), svijetla ikona
na zaslonu, zvijezde koje SIJEVAJU na vedroj noći, prijelaz heroja u
kartice bez ruba, bijeli tekst na noćnom heroju u SVIJETLOJ temi.

Radni tijek: Marko gleda na uređaju, javi što bode, popravlja se odmah.

**SVAKA izmjena widgeta traži REBUILD** — i konfiguracije i samog
rasporeda (provjereno u izvoru 7.8.2026.). Widget bundle se ne poslužuje
s Metroa: `WidgetsJSRuntime.swift` ga čita iz `Bundle.main` kao
`ExpoWidgets.bundle`, dakle datoteku ugrađenu u instalaciju. Reload
osvježi aplikaciju, ali widget ostane na starom kodu.

Android je drugačiji: ondje se handler vrti u običnom JS kontekstu, pa
izmjene rasporeda idu reloadom kao i ostatak aplikacije.

Ako se temperatura još dira: jedino što ostaje je **gušći izvor mjerenja**.
Izmjereno je da se štimanjem težina više ne dobiva (visina i manji domet su
*gori*), a Polača se bez podatka iz Ravnih kotara ne može riješiti.

**Vjetar nema korekciju mjerenjem.** Temperatura ide kroz `debiasHourly` +
`observationDelta`, a `windSpeed`/`windGusts` se prenose iz modela kakvi su.
Na obali model na mreži od ~25 km podcjenjuje kanaliziranu buru — ako zastava
bude sustavno preblaga, uzrok je tu, ne u pragovima.

## Recent Decisions

| Odluka | Zašto |
|---|---|
| Vedar dan i djelomično oblačno su PLAVI i u aplikaciji | Markov odabir 8.8.2026.: widget je 7.8. prešao na plavo (narančasta ondje nije trpjela bijeli tekst), pa su aplikacija i pločica pokazivale isto vrijeme u dvije posve različite boje. Aplikacija sada preuzima ISTE vrijednosti (`#3E76AA/#2F5F8E/#234B72` i `#3A6B98/#2C567E/#204464`), provjereno testom koji pada ako se raziđu. Posljedice su NAMJERNE: `readableOn` na tim tonovima vraća BIJELI tekst (0.107 < 0.19), a heroj je tamniji nego prije. Tamna tema dijeli iste boje jer ih widget ionako ne razlikuje |
| Traka sati ima VLASTITI akcent (`stripAccent`), ne `heroAccent` | Nađeno na uređaju 8.8.2026.: nakon prelaska na zlatnu, postotci oborine u traci su nestali. Traka IZGLEDA kao dio heroja, ali ne stoji na njegovom nebu — dno gradijenta se stapa u podlogu stranice, pa su postotci na SVIJETLOM. Izmjereno: zlatna ondje daje **1.56:1**, hladna plava **4.81:1** (svijetla tema) i **3.46:1** (tamna). Ista greška u malom: jedan akcent za dvije različite podloge. Prvi pokušaj popravka je bio da i traka preuzme `readableOn` — to je sve pobijelilo i traka je nestala, jer podloga ondje NIJE tamna |
| Zaglavlje ladice prati GRADIJENT, stavke ispod prate TEMU | Zaglavlje crta gradijent vremena, pa mu tekst mora ići kroz `readableOn(stops[1])` kao u heroju — inače je na tamnoplavom vedrom danu `ink` bio taman na tamnom i wordmark se gubio. Stavke ispod stoje na `mist`/`night` podlozi i ostaju na `text-ink dark:text-paper`; granica je točno rub zaglavlja |
| Akcent na vedrom heroju je ZLATNA, ne narančasta | Otkad je nebo plavo, obje dosadašnje boje padaju na dnu gradijenta (#234B72): hladna plava **1.80:1**, topla narančasta **2.18:1** — plavo na plavom se utopi. Zlatna `#F4C542` prolazi sa **5.56:1** (djelomično oblačno 6.23:1) i nosi toplinu koju je podloga izgubila. `HERO_WARM` je time ostao bez pozivatelja i obrisan |
| Naoblaka je STUPNJEVANA: 0 ≠ 1 ≠ 2 | Nađeno na uređaju 8.8.2026. (Roč i Pazin): feed je javljao „pretežno vedro" (WMO 1), a aplikacija je crtala isto čisto sunce kao za potpuno vedro — bez ijednog oblaka. Sada: 0 = samo zrake, **1 = zrake + rijetki oblaci**, 2 = zrake + oblaci. Grana ide po WMO KODU unutar `backdropEffects`, ne po novom ključu palete — boja je za 0 i 1 ista, pa bi zaseban ključ značio duplu paletu i ovdje i u widgetu bez ijedne razlike u boji |
| Vedro i kišno razlikuje ZASIĆENOST, ne svjetlina | Pretpostavka pri pisanju testa je bila da je vedro svjetlije — izmjereno netočno: vedro je 350, kišno 449, jer je vedro preuzelo widgetovu potamnjenu plavu a kišna paleta nije mijenjana. Prava razlika je čistoća boje: vedro 108 razmaka između crvenog i plavog kanala, kiša 46, oblačno 17. Fizikalno točno — naoblaka oduzima boju |
| Okvir ambijenta se računa PO VELIČINI pločice, ne konstantom | Prvi popravak visine (isti dan) uveo je `TILE_W = 360`, što je otprilike točno za 4×2 ali DVOSTRUKO PREVIŠE za 2×2 (~158 px). Mali widget je time dobio ambijent širok 360 px, korijenski stack se rastegnuo s njim i sadržaj je izašao iz kadra — **ostala je samo slika, bez ijedne brojke**, dok je veliki radio. Isti kvar kao s visinom, samo po drugoj osi. Pouka: `environment.widgetFamily` je jedini pouzdan izvor dimenzije |
| Sadržaj widgeta na iOS-u treba VEĆI razmak nego na Androidu | Uz istih 14 px Android je izgledao prozračnije, a iOS pretijesno uz rub. Razlika nije u broju: iOS oko widgeta sam dodaje sustavne margine, a `Backdrop` ih isključuje s `ignoreSafeArea()` da gradijent ide do ruba — pa otpadnu i za sadržaj. 18 px vraća otprilike ono što je iOS oduzeo |
| Model NIJE mjerenje — pri provjeri vremena gledati DHMZ | 7.8.2026. je ECMWF za Roč davao „vedro", a najbliža postaja (Pazin, 18.6 km) je u istom terminu javljala **grmljavinu**; nad mjestom je stvarno bilo oblačno. Model je prognoza za točku i može promašiti naoblaku, pa se pri odgovaranju na „kakvo je vrijeme sada" prvo gleda `hrvatska_n.xml`, a model služi samo za ono što postaje ne mjere |
| Ambijent widgeta MORA imati `frame` + `clipped` | Nađeno NA UREĐAJU 8.8.2026.: na VEDROM danu je s pločice nestajalo sve osim velike brojke — ni mjesto, ni opis, ni min/max. Kiša i oblačno su bili uredni, pa je izgledalo kao greška u tekstu. Nije: `ZStack` u SwiftUI-u poprimi veličinu NAJVEĆEG djeteta, a sunčane zrake su duge `FULL_LEN` = 226 px u pločici od 158 px. Ambijentalni stack je time narastao na 226 px, s njim i korijenski, pa je sadržaj bio gurnut izvan kadra. Kiša ima crte do 32 px, oblaci krugove do 64 — oboje stane, zato se kvar vidio SAMO na suncu. Svih 6 ambijentalnih stackova je sada vezano na veličinu pločice |
| `size` na `Image` vrijedi samo za SF Symbole | Nađeno NA UREĐAJU 8.8.2026.: ikona vremena je bila golema i odrezana rubom pločice. U tipovima piše „fixed size of the **system image**" — naši PNG-ovi su datoteke i crtaju se u SVOJOJ punoj veličini dok im se izričito ne dopusti skaliranje. Sam `frame` ne pomaže: on odredi PROSTOR, a preveliku sliku samo OBREŽE. Treba `resizable()` → `aspectRatio({contentMode:"fit"})` → `frame()`, tim redom |
| `null` NE SMIJE u propove widgeta | Nađeno NA UREĐAJU 8.8.2026.: `Exception in HostFunction` iz `updateTimeline`, pa widget nije dobio nijedan prop i crtao je „undefined" posvuda. Propovi prelaze u nativni `[String: Any]` (`WidgetsRecords.swift`), gdje JS `null` nema parnjaka. Odsutnost se izražava BOOLEANOM (`hasGusts`), a broj nosi 0. Test `nijedan prop nikad nije null` čuva pravilo za sve buduće propove |
| Android widget se osvježava `requestWidgetUpdate`, ne sam | Nađeno NA UREĐAJU 8.8.2026.: widget je ostajao na STAROM GRADU nakon promjene mjesta. `pushWidget` je zvao samo iOS `updateTimeline`, a za Android ništa — ondje se widget budio sam tek na `updatePeriodMillis`, a to je 30 min (Androidov minimum). Crtež je zato izvučen u `android/render.tsx`, jer ga sada zovu DVA mjesta (headless zadatak i aplikacija) i izgled se ne smije razići |
| Meki rubovi na Androidu idu `radialGradient`, ne `feGaussianBlur` | Nađeno NA UREĐAJU 8.8.2026.: oblaci su imali tvrde rubove — vidio se obris kruga umjesto mrlje. `RemoteViews` ne izvršava SVG filtere pouzdano, pa blur otpadne i ostane goli `<circle>`. Gradijent nije filter nego ISPUNA, pa prolazi svuda. Izmjereno renderom: luminancija preko ruba ide 83→76→80, najveći skok 2 razine na 5 px |
| Ambijentalni slojevi se prorjeđuju na slabijim uređajima | Kiša je štucala na Galaxyju S10e. Uzrok nije animacija (transformi idu nativnim driverom) nego CRTEŽ: 63 `<Line>` sa `strokeDasharray` i okruglim krajevima, sve rasterizirano na CPU-u. Ispod Androida API 33: 32 crte i ravni krajevi. Prorjeđivanje mora nositi IZVORNI indeks, jer o njemu ovise uzorak i faza — inače se vraća vodoravni prazan „val" nađen 6.8. |
| `autoIncrement` ide na SVE profile, ne samo `production` | Nađeno 7.8.2026.: svaki dev build je izlazio kao **1.0.0 (1)**. Uz `appVersionSource: "remote"` broj drži EAS, ali ga podiže **samo profil koji ima `autoIncrement`** — `development` ga nije imao, pa je stajao na 1 zauvijek. Nije kozmetika: **iOS odbija instalirati dvije gradnje s istim `version` + `buildNumber`**, pa se novi build ne pojavi ili ostane stari. `version` u `app.config.ts` ostaje ručan (1.0.0) — to je marketinška verzija i mijenja se namjerno, dok build number mora rasti sam |
| Ladica se otvara `navigation.openDrawer()`, ne `DrawerActions` | Od **SDK 56** `expo-router` odbija uvoz iz `@react-navigation/*` u kodu aplikacije — `expo export` pukne s izričitom greškom. U cijelom projektu je to bila **jedna linija** (`DrawerActions` u `index.tsx`); `DrawerContent` je već zvao `closeDrawer()` kao metodu. `@react-navigation/drawer` je time postao mrtav teret i **izbačen** — expo-router nosi vlastitu kopiju (potvrđeno: hash bundlea je nakon izbacivanja **identičan**) |
| Pri dizanju SDK-a očekivati ČETIRI vrste sitnih zapreka | Iz upgradea 54 → 57 (7.8.2026.), sve već primijenjene u configu ali korisne za sljedeći put: (1) paketi koji se prestanu autolinkati moraju u `plugins` — `expo install --fix` ih traži ali ih **ne može upisati** u dinamičan `app.config.ts`, pa naredba završi kodom 1 iako je uspjela; (2) `tsconfig` `types` je IZRIČIT popis, pa se izgubljeni tipovi (`node`) moraju dodati ručno; (3) paketi ugniježđeni pod `expo/node_modules` trebaju `moduleNameMapper` u jestu, inače svi suiteovi padnu; (4) uvoz koji je knjižnica zabranila (`@react-navigation/*`) puca tek na `expo export`, ne na typecheck |
| `'widget'` direktiva izdvaja TIJELO funkcije u zaseban paket | Nađeno NA UREĐAJU 7.8.2026.: widget se nije prikazao uz `ReferenceError: Can't find variable: Backdrop`. Direktiva ne označava samo funkciju — njeno tijelo ide u **zaseban paket** koji se izvršava u WidgetKit procesu, uz vlastite stubove za react i react-native (`expo-widgets/bundle/`). Sve u dosegu MODULA ostaje u paketu aplikacije i widgetu je NEDOSTUPNO, pa su sve pomoćne komponente i konstante morale unutra. Iz istog razloga se zovu kao FUNKCIJE (`Backdrop({...})`), ne kao JSX (`<Backdrop />`): jsx stub zna složiti stablo od poznatih `@expo/ui` komponenti, ali ne montira našu vlastitu. **Typecheck, testovi i `expo export` su svi prošli** — greška je bila vidljiva tek na uređaju |
| `expo-widgets` je ISKLJUČEN iz Android autolinkinga | Gradle je pao na `checkDuplicateClasses` (EAS build 7.8.2026., reproducirano lokalno): **oba widget paketa traže `androidx.work` u različitim verzijama** — `react-native-android-widget` traži `work-runtime:2.8.1`, a `expo-widgets` preko Glancea vuče `work-runtime-ktx:2.7.1`. Gradle podigne prvi na 2.8.1, `-ktx` ostane na 2.7.1, iste klase u dva paketa. Rješenje: `expo.autolinking.android.exclude` u `package.json` — ondje ionako radi ništa (vidi red ispod), a iOS ostaje netaknut |
| Widget ikone su ODVOJENA briga od upisa crte | Nađeno NA UREĐAJU 7.8.2026.: widget se crtao kao bijela pločica s "undefined" posvuda, bez ijedne greške. Uzrok: `syncWidgetIcons` i `updateTimeline` su stajali u ISTOM `try`, pa je pad ikona preskakao upis crte — widget je ostajao bez ijednog propa. Uz to je `catch` bio prazan, pa se ništa nije vidjelo. Sada su dva odvojena `try` bloka i **greške se logiraju** (`console.warn`), a ne gutaju. `expo-file-system` i `expo-asset` su time postali IZRAVNE ovisnosti — bili su samo tranzitivni, pa `require` u nativnom buildu nije bio zajamčen |
| `expo-widgets` na Androidu je KOSTUR — ne koristi se | Provjereno u izvoru 7.8.2026.: `ExpoWidgetsGlanceWidget.kt` ima 17 redaka i crta doslovno `Text(widgetName)`, a `WidgetsModule.kt` registrira samo ime. Config prima `android` blok, pa izgleda kao da radi — ali iza njega nema izvedbe. Android zato ide kroz `react-native-android-widget` |
| Android widget je ispao LAKŠI od iOS-a | Suprotno od prve procjene (koja je govorila o RemoteViews i PNG-ovima): `SvgWidget` prima **SVG kao string**, pa gradijent s tri stopa i cijeli ambijent idu kao prava grafika umjesto slaganja od pravokutnika. `backgroundGradient` u knjižnici prima samo dvije boje, pa se SVG koristi i zbog toga. Handler se izvršava u JS-u, pa čita AsyncStorage IZRAVNO — nema App Groupa, nema kopiranja ikona, podaci su svježi u trenutku crtanja |
| `index.js` postoji samo zbog Android widgeta | Headless zadatak mora biti registriran PRIJE nego RN pokrene aplikaciju, jer ga Android zove i kad aplikacija ne radi. Sve ide kroz `require`, ne `import`: ES uvozi se **hoistaju**, pa bi se `expo-router/entry` izvršio prvi bez obzira na redoslijed u datoteci, i zadatak bi ostao neregistriran |
| Widget ima JEDNU verziju, uvijek tamnu | Tema telefona se ne prati (Markov odabir 7.8.2026.): pločica izgleda isto ujutro i navečer, jer korisnik ne mijenja temu zbog widgeta. Sve palete su potamnjene inačice onih iz aplikacije — isti ton, spuštena svjetlina dok bijeli tekst ne prijeđe **4.5:1**. Izmjereno svaku; najniže je djelomično oblačno sa 4.78:1. `dark` je time ispao iz cijelog lanca |
| Vedar dan u widgetu je PLAVO NEBO, ne žuto sunce | Žuta iz aplikacije (`#F4C542`) daje bijelom tekstu **1.63:1**, a potamnjena postaje pečena narančasta u kojoj sunčan dan izgleda kao prašina (provjereno renderom). Plava (`#3E76AA`) prolazi sa **4.80:1** i čita se kao vedro NEBO — što je i točnije. Sunce ostaje u ikoni i u sjaju, ne u podlozi. Djelomično oblačno je isto plavo, samo tamnije: naoblaka nebo prigušuje, ne pretvara ga u narančasto |
| Ambijent widgeta se slaže od `Rectangle` i `Circle` | Nema `Path` ni `Canvas`, pa se prave krivulje ne mogu crtati. Kose crte su zarotirani pravokutnici pod **29°** — izračunato iz `SLOPE = 0.55` u aplikaciji, da se poklapaju s kišom i zrakama na ekranu. Duljina 226 px je isto izračunata: 158 / cos(29°) = 181 px za visinu pločice, plus rezerva da se rez ne vidi. Oblaci i sjaj su zamućeni krugovi (`blur`) |
| MALA pločica vidi samo pojas ±79 px od sredine | Uzrok dvaju bugova nađenih na pregledu (7.8.2026.): zvijezde, pahulje i kiša su bile raspoređene po širini SREDNJE pločice, pa je na maloj ostajala jedna-dvije ili nijedna. Sve što mora raditi na obje veličine mora biti unutar tog pojasa |
| Ikone widgeta su PNG, ne SVG ni SF Symbols | Putanje se ne mogu crtati (nema `Path`), pa se glifovi renderiraju u `sharp` i učitavaju kroz `<Image uiImage>`. SF Symbols se NE koriste — to je Appleov vizualni jezik, a widget koji ga posudi izgleda kao Appleov widget. Vjetar je glif „Zapuh“ iz ikone aplikacije, iste putanje |
| Zaključani zaslon dobiva PUNE ikone | iOS ondje crta u `vibrant` načinu: sve svede na jedan ton i masku, pa se prazna unutrašnjost obrisne ikone ne razlikuje od podloge, a tanke linije se stanje do neprimjetnosti. Zato i Apple ondje koristi `*.fill` simbole. Otud 20 ikona umjesto 10 |
| Preklopljene ikone se režu MASKOM, ne ispunom | Mjesec iza oblaka je prvo bio samo obris, pa se linija mjeseca vidjela KROZ oblak i izgledalo je kao dva prstena koja se sijeku (Marko uočio). Ispuna ne dolazi u obzir jer je podloga gradijent — nema jedne boje. Maska ne dodaje boju, samo uklanja ono što je iza. Isto primijenjeno na sunce iza oblaka i munju |
| Tintanu verziju widgeta iOS radi SAM | Ne postoji zasebna „tinted“ pločica koju bismo crtali — sustav uzme isti raspored i pretvori ga u jednobojnu masku (`widgetRenderingMode === "accented"`). Kod samo IZOSTAVLJA gradijent i ambijent u tom načinu, jer bi ostale nasumične sive crte preko ničega. To je druga stvar od `icon-tinted.png`, koji je ikona aplikacije |
| Gradijent u widgetu ide `Rectangle` + `foregroundStyle`, ne `containerBackground` | **Ispravak prvotnog zaključka** (7.8.2026.): dokumentacijska stranica `@expo/ui` NE navodi oblike, pa je prvo zapisano da crtaćih primitiva nema. Čitanje instaliranih tipova pokazalo je suprotno — `@expo/ui/swift-ui/Shapes` izvozi **`Rectangle`, `Circle`, `Ellipse`, `Capsule`, `RoundedRectangle`**. Prava granica je drugdje: `containerBackground`, `background` i `backgroundOverlay` primaju samo `Color` (jednu boju), a **jedini** modifikator koji prima `linearGradient` je `foregroundStyle` — koji boji SADRŽAJ. Zato podloga = `Rectangle` s `foregroundStyle` kao najdublji sloj `ZStacka`, uz **obavezan `ignoreSafeArea()`** (bez njega iOS ostavi margine i vidi se okvir oko gradijenta). Smjer je isti dijagonalni (0,0)→(0.6,1) kao u heroju. Pouka: **tipove čitati iz `node_modules`, ne iz dokumentacije** |
| Widget dobiva IZRAČUNATE boje i tekstove, ne WMO kod | Widget je zaseban proces: ne vidi AsyncStorage, ne ide na mrežu i **ne izvršava naš JS**, pa ne može uvesti `weatherLook.ts` ni `t`. Sve se računa u aplikaciji (`widgetData.ts`) i pošalje kao plosnati primitivi. Time paleta i pragovi ostaju na JEDNOM mjestu — promjena boje vremena stigne u widget bez ijedne izmjene u njemu |
| Tip propova widgeta stoji u ZASEBNOJ datoteci (`props.ts`) | `BurinWidget.tsx` uvlači `expo-widgets` i `@expo/ui/swift-ui`, oboje nativno. Dok je tip živio tamo, `widgetData.ts` ga je uvozom povukao i **srušio vlastite testove** ("Cannot find native module 'ExpoWidgets'"). Isto pravilo koje je već naučeno na `MapTimeline` + AsyncStorage. `pushWidget` zato radi `require` LIJENO i u `try` — tako i Android prolazi (`expo export` potvrdio) |
| Widget se puni `updateTimeline`, ne `updateSnapshot` | iOS **budžetira** buđenja widgeta (~40–70 dnevno) i sam odlučuje kad — snapshot bi do večeri prikazivao jutarnju temperaturu. Šalje se 12 sati unaprijed iz `hourly` (već korigiranog mjerenjem), pa widget ostaje točan i bez ijednog buđenja aplikacije. Tekući sat se **preskače** jer ga već nosi unos iz `current` — dva unosa s istim datumom su neispravna crta |
| Widget podatke dobiva `updateSnapshot`, ne čitanjem AsyncStoragea | Widget je zaseban proces u drugom kontejneru i **fizički ne vidi** AsyncStorage aplikacije (na iOS-u je to datoteka u sandboxu). Dijeljenje ide preko App Groupa, a `expo-widgets` to pakira u `updateSnapshot()` / `updateTimeline()`. Svi potrebni podaci su ionako već u `burin:last-weather` — nema novog dohvaćanja |
| `updateTimeline` za buduće sate, ne samo `updateSnapshot` | iOS **budžetira** osvježavanje widgeta (~40–70 buđenja dnevno) i sam odlučuje kad. `updateTimeline` unaprijed upiše niz unosa iz `hourly[]`, pa widget ostaje točan i kad ga sustav ne probudi — bez toga bi pokazivao zastarjelu temperaturu |
| Lock screen widget je JEDNOBOJAN, i to je u redu | iOS `accessoryRectangular` renderira u jednom tonu — gradijenta tu nema i ne može biti. Dijeli podatke s velikim widgetom, ali ne izgled; ide unutra jer je gotovo besplatan, ne zato što će izgledati kao aplikacija |
| Značka bure ide po UDARIMA, ne po stalnom vjetru | Izmjereno 6.8.2026. za Polaču: ECMWF daje 4.2 m/s stalnog uz **9.1 m/s u udarima**. Bura se osjeti i pamti po udarima; po stalnom vjetru se značka u zaleđu ne bi upalila gotovo nikad. V&R prikazuje isto (njihovih 11 m/s nisu ni model ni DHMZ postaja — Zadar je tada mjerio 3.1 m/s) |
| Prag značke 10 m/s (bijela) / 17 m/s (crvena) | Markov odabir po V&R-u. 17.2 m/s je i granica 8 Beauforta (olujno), pa se skala poklapa s pomorskom prognozom. Ispod praga NEMA značke — inače stoji uvijek i prestane nositi informaciju |
| Značka vjetra je VJETRULJA, ne zastava | Vjetrulja je instrument za vjetar pa se sama čita kao "vjetar"; zastava je signal i značenje nosi samo bojom. Marko dao izvorni SVG. Izvedba: stup + TRI pune pruge s **PROZIRNIM rasjecima** (naizmjenične pruge SU oblik — bez rasjeka je znak puni blok). Crvena za olujno je ista na svim podlogama, jer crveno znači opasnost; jarbol nikad nije crven |
| Značka ima TRI tona po podlozi, ne dva | `card` (#6E6E69) za bijele kartice, `hero` (#9A9A93) za obojeni gradijent, `dark` (bijela) za tamno. Jedan `onLight` za oboje je heroju davao ton kartice i izgledao pretežak. **Bijela na bijeloj kartici je nevidljiva** — dok je rukav imao obris se nazirala, s prozirnim rasjecima je obris otpao |
| SVG ikonu provjeriti RENDEROM u PNG prije uređaja | Dvije izvedbe su pale NA UREĐAJU (krug = "mala točka", pa bijela na bijelom). Render u `sharp` je uhvatio treću grešku bez telefona: `strokeWidth: 2` + široke pruge na rukavu visokom ~11 jedinica pojedu svu bijelu površinu, pa je znak izgledao siv. Isto je pokazalo da 64×64 viewBox nosi trećinu praznine — odatle "izgleda sitno" |
| Koordinate u SVG-u se IZRAČUNAJU, ne pogađaju | Rubovi rukava se sužavaju (gore 12 → 16.5, dolje 28 → 23.5 na x = 21 → 52), pa pruge moraju pratiti tu jednadžbu da "leže" u perspektivi. `viewBox` isto: granice su izračunate rotacijom vrhova oko (21,18). Kod wordmarka je pogađanje odrezalo kovrču (luk seže do x=22, kadar je bio do 21) |
| `transform-origin` i `skewX` iz weba ne postoje u react-native-svg | Markov SVG ih koristi. Rotacija mora ići kao `rotate(kut, cx, cy)` — bez zadanog centra ide oko (0,0) i rukav odleti izvan kadra |
| Djelomično oblačno = zrake + oblaci | Prije je vraćalo samo `["rays"]`, isto kao čisto sunce, pa se na uređaju vidjelo kao "vedro, samo malo manje vedro" — bez ijednog oblaka. Oblaci dolaze u `density="sparse"` (3 umjesto 5, blijeđi, gornja trećina), a paleta NE prelazi u "duboku" — inače bi se promijenio već odobren izgled |
| m/s je zadana jedinica vjetra | DHMZ, pomorska prognoza i Beaufort u Hrvatskoj govore u m/s, pa i pragovi bure imaju smisla samo tako. `persist` znači da postojeće instalacije **zadržavaju** stari `kmh` — zadana vrijednost vrijedi za nove |
| Fahrenheit dobiva slovo, Celzijus ne | Celzijus je zadan pa mu slovo ne treba ("24°"); "75°" bez slova je neodredivo. Na velikoj brojci F stoji ISPOD kružića (poravnat s njim slijeva, spušten na dno znamenki), a NE desno od njega |
| 14 dana ostaje bez slova jedinice | Kolone MIN/MAX su 38 px (`KOL_TEMP`); "-15°F" u dvije kolone jedna do druge se ne uklopi. Zaglavlje kolona ionako kaže što je što |
| Jedinice se u `MapTimeline` prosljeđuju PROPOM, ne čitaju iz storea | `useSettings` u tom modulu uvuče AsyncStorage, a njegovi testovi su čista logika bez nativnih modula — cijeli suite se prestao pokretati ("NativeModule: AsyncStorage is null") |
| Tipkovnica se u tražilici ne otvara sama | Ekran je i popis spremljenih i povijesti — najčešći potez je dodir na poznat grad, a tipkovnica je preko toga skakala i zaklanjala pola liste. Time je i parametar `focus=0` postao nepotreban pa je maknut |
| GPS u tražilici se traži TEK NA DODIR | Dizati sustavni dijalog za dozvolu samo zato što je korisnik otvorio tražilicu je nametljivo. Iznimka: kad je mjesto s heroja već "Moja lokacija", dozvola je očito dana pa se red puni odmah |
| Hamburger OSTAJE desno, tražilica lijevo | Ladica izlazi zdesna; hamburger slijeva bi značio "tapni lijevo, panel dođe zdesna". V&R ima obrnuto jer im se i ladica otvara ulijevo — kopirati samo položaj gumba dalo bi najgore od oboje |
| Wordmark je "Podcrt" — logo je UPLETEN u slog | Marko odabrao među 6 prijedloga. Nema zasebne ikone slijeva: riječ `burin` + srednji zapuh glifa koji se uvija DESNO od riječi, u visini slova. Akcent time NOSI cijeli logo, pa na toplim podlogama (zaglavlje ladice) mora dobiti `heroAccent` — inače se koraljna utopi i ostane samo tekst |
| Boja aktivne stavke u ladici prati podlogu | Rep gradijenta zaglavlja se prelijeva preko prvih stavki s gradovima (`FADE_H = 130`), pa tamo koraljna gubi kontrast → `cityAccent` = `heroAccent`. Grupe KARTE i APLIKACIJA stoje na mist podlozi i ostaju koraljne. Tražilica isto ostaje koraljna — njeni redovi nisu na gradijentu |
| Hrvatska = ručna tablica regija, ostatak Europe = geokodiranje | Meteoalarm NE objavljuje granice ni koordinate regija — samo ime i EMMA ID. Regija po zemlji: Italija 19, Austrija 116, **Njemačka 409**, pa ručna tablica nije izvediva. HR ostaje ručna jer je provjerena i točna |
| Filtar države pri geokodiranju regije je OBAVEZAN | Izmjereno: "Velebit channel" bez njega geokodira u Velebit u **Srbiji** — mjesto bi dobilo upozorenje iz krive zemlje |
| Sve što ide na disk mora biti malo | `hourlyAll` (16 dana × 24 h) je ~69 kB po gradu; `persist` ga je serijalizirao na JS threadu pri svakoj promjeni mjesta. Ne piše se na disk — 413 kB → 35 kB za 6 gradova |
| Skupa montiranja odgoditi za jedan kadar | Sadržaj ispod pregiba (bento, 14 dana, MapLibre) i skeleton pri promjeni grada: hero se vidi prvi, pa ne smije čekati najskuplji dio ekrana |
| Animirani elementi idu u SKUPINE koje dijele petlju | Po element = po `Animated.View` + petlja se ne skalira: sunce je montiralo 31 sloj, snijeg 26. Nepravilnost se čuva razlikama unutar skupine (položaj, veličina, faza) |
| `pressed` stil na Pressableu NE radi uz NativeWind | NativeWind pretvara `className` u `style` i prepisuje `style={({pressed}) => …}`. Odziv na dodir ide preko `onPressIn`/`onPressOut` i vlastitog stanja |
| Animirani slojevi trebaju rezervu platna, izračunatu | Svi rezovi na rubovima (magla, oblaci, kiša) imali su isti uzrok. Rezerva mora pokriti i FIKSNE pomake, ne samo udio visine — kiša je u ladici presušila jer je 1.3 × 200 px < 464 px ambijentalnog pomaka |
| `width="100%"` u SVG-u bez `viewBox` daje kvadrat | Nađeno na uređaju (veo magle). Uvijek izričite dimenzije |
| Zrake sunca se NE pomiču, samo dišu | Kad se kose crte kližu, oko ih čita kao oborinu. Sunčano vrijeme dobiva mirnu geometriju + promjenu svjetline |
| Dizajn se zaključava u HTML mockupu prije koda | 7 iteracija u browseru prije ijedne linije redizajna; isto za logo i wordmark (artifact s prijedlozima). Jeftinije od ciklusa build→pogledaj→popravi |
| Vizualno se provjerava NA UREĐAJU, ne u kodu | **Nijedan** vizualni bug do sada nije uhvaćen provjerama: odrezana velika brojka, kvadrat magle, skakanje zvjezdica, swipe u krivi ekran, flex hero na pola visine, traka sati izvan ruba, pad na Zagrebu, 4 kruga kartografskih bugova, tri promašene izvedbe vjetrulje — sve je prošlo typecheck, testove i `expo export`. Za SVG ikone render u PNG (`sharp`) hvata dio grešaka prije telefona, ali ne zamjenjuje ga |
| react-query queryFn NIKAD ne smije vratiti `undefined` | Ruši ekran greškom "Query data cannot be undefined". `fetchSeaTemperature` zato vraća `null` za kopno, a hook ga pretvara u `undefined` za `WeatherBundle` |
| `keepPreviousData` na upitima vezanim uz poziciju karte | Bez toga svaki pomak mijenja `queryKey`, `data` na tren nestane i kontrole vremenske crte se onemoguće — izgleda kao da je aplikacija pukla |
| Boja akcenta ovisi o podlozi (`heroAccent`) | Koraljna `#EE6E3C` je zadana, ali na toplim narančastim gradijentima heroja se utapa — tamo prelazi u čeličnu plavu. Instrumenti u karticama su uvijek koraljni jer su kartice neutralne |
| Veličine ciljaju starije korisnike | Pravilo kroz cijeli UI: ništa sitno ispod 11px, ništa bitno ispod 65 % kontrasta. Iz toga su izašle i kratice razdoblja dana ("Popodne" umjesto "Poslijepodne") |
| Radar `maxNativeZ` je 7, ne 8 | Nađeno NA UREĐAJU: pri približavanju se pokazivala siva pločica "Zoom Level Not Supported". Izmjereno dekodiranjem: RainViewer od z=8 vraća HTTP 200 i bajt-identičnu sliku (1370 B, md5 2cc6649e) na SVIM koordinatama — **ta slika JE taj natpis**. Ranija bilješka "iznad 8 nema novih podataka" je bila točno zapažanje s krivim zaključkom |
| Vjetar je vlastiti sloj, ne OWM pločica | Besplatni `wind_new` je polje boja bez smjera — izgledao je gotovo isto kao naoblaka. Sada: kratke crtice iz Open-Meteo mreže (154 točke, jedan upit, 364 ms) koje klize u smjeru strujanja |
| Crtice se animiraju `line-dasharray`, ne pomicanjem geometrije | Geometrija bi se morala slati nativnom sloju 8×/s (stotine linija); dasharray je promjena stila koju GL primi odmah. Svi kadrovi moraju imati isti zbroj ciklusa i nenegativne članove — inače crtice pulsiraju umjesto da teku |
| Smjer vjetra se interpolira preko u/v, ne stupnjeva | Prosjek 350° i 10° u stupnjevima daje 180° — točno suprotno od stvarnog (0°) |
| OWM slojevi dobivaju `raster-saturation`/`contrast` | Izmjereno: `temp_new` ima alfu **76/255 na svakom pikselu** (30 % vidljivosti) — izvor je poluproziran pa boje izlaze isprane. `raster-opacity` to ne može (1.0 je maksimum), zasićenje i kontrast mogu |
| Animacija karte izmjenom `raster-opacity`, ne `tiles` | Izmjereno u knjižnici (MLRNSource.kt): `tiles` na živom izvoru se NE primjenjuje — native ga čita samo u `makeSource()`. Paint se primjenjuje odmah (`setReactStyle` → `addStyles()`). Zato: aktivni okvir + susjedi s opacity 0 (GL inačica starog 0.01-trika), key po URL-u |
| Zoom granice globalne (4–12), ne po sloju | MapLibre iznad `maxzoom` izvora rasteže pločicu i nikad ne traži nepostojeću — "zoom level not supported" strukturno ne postoji. `maxZoom` po sloju obrisan iz `MapLayer` |
| Open-Meteo ima SATNU kvotu (~600/h) | Probijena testiranjem mreže vjetra (154 točke po upitu) → HTTP 429 na SVA tri sloja koja o njemu ovise. Zato: duži `staleTime`, grublje zaokruživanje kadra, odmak među pokušajima i vidljiva poruka umjesto mrtvih kontrola |
| Sva mjerenja izmjeriti, ne procijeniti | Više puta je "logična" ideja izmjerena kao pogoršanje (postajno učenje, GFS, puna korekcija, težina po visini) |
| Mjeriti protiv termometra, ne protiv Vrijeme&Radara | Bug je 3 commita bio nevidljiv jer je slučajno približavao V&R-u na Starigradu, dok je štetio na 12 drugih mjesta |
| `PRIMARY_MODEL` se izvozi iz `openMeteo` i dijeli s `bias` | Bias se MORA učiti iz modela koji se prikazuje. Dok su bili razdvojeni, učio se `best_match` a prikazivao ECMWF: odmak 2.66 vs 2.40 °C, pogrešan predznak u Lici i Istri |
| ECMWF IFS kao glavni model, ne `best_match` | Izmjereno 0.97 vs 1.83 °C promašaja jutarnjih minimuma na 12 mjesta; najbolji na 8/12 |
| Udaljenost kažnjavati JEDNOM u `observationDelta` | Množenje prosjeka s `bestCloseness` je puštalo ~30 % stvarne razlike. Leave-one-out: 1.99 vs 2.37 °C. Arhiva noćnu grešku ne vidi (Polača: nauči +0.14 uz stvarnih +4 °C) |
| Domet korekcije 60 km, ne 40 | DHMZ u međuterminima objavi ~29 postaja; na 40 km je pola zemlje bez korekcije. Izmjereno 1.99 vs 2.09 °C |
| Prigušenje pristranosti po dosljednosti, ne fiksni faktor | Fiksni 0.75 gušio stvarnu dosljednu grešku; puna korekcija pojačava šum (1.86 vs 1.67 °C) |
| Korekcija iz prosjeka 3 DHMZ postaje, ne najbliže | Leave-one-out: 1.73 vs 1.91 °C; jedna nereprezentativna postaja (aerodrom u udolini) ne odlučuje sama |
| Ne učiti pristranost iz DHMZ postaja | Izmjereno da pogoršava — okolne postaje su u drugom reljefu, greška se ne prenosi preko krajolika |
| Ne vagati postaje po visini, ne smanjivati domet (15–25 km) | Oboje izmjereno gore od sadašnjeg (2.46–2.63 vs 2.44 °C) — s ~29 postaja ostane se bez ijedne reference |
| Ne tražiti prognozu s kopnene točke za obalna mjesta | Izmjereno: 5 km u kopno od Starigrada = 623 m n.v. i 20.9 °C — vrijeme Velebita, ne mjesta |
| iOS ide na EAS dev build, ne Expo Go | Osobna Apple licenca + jedini developer → internal distribution bez TestFlighta. Otvara nativne module (MapLibre, widget) i ukida razlog za SDK 54 |
| OWM 1.0 pločice primaju `&date=<unix>` | Nedokumentirano, ali izmjereno: −48 h do +120 h daju različite slike (MD5). Bez toga klizanje po crti mijenja samo oznaku |
| OWM slojevi bez dodatnog prigušenja (`opacity: 1`) | Pločice su već poluprozirne u izvoru (maks. alfa 76/255 temp, 12/255 naoblaka). Množenje ispod 1 ih je gasilo — naoblaka na ~4 % vidljivosti |
| Strelice vjetra ne postoje u besplatnom OWM-u | `wind_new` je polje boja; `WND` sa strelicama vraća 401. Animirane crte na njihovom webu su klijentska animacija, ne pločica → radit ćemo vlastiti sloj iz Open-Metea |
| yr.no / MET Norway ne pokriva Hrvatsku | Nowcast: "location is outside the geographic area supported"; sva radarska područja su norveška |
| Open-Meteo nema tile endpoint | 404 — služi samo JSON po točki. Za obojene slojeve preko površine nema alternative OWM-u |

## Development

```bash
npx expo start --dev-client   # dev server; JS izmjene idu reloadom, BEZ rebuilda
npm run typecheck             # tsc --noEmit
npm test                      # jest, 263 testa u 25 skupina
node scripts/generate-widget-icons.mjs  # 20 ikona widgeta (traži sharp)
npx expo export --platform android   # puni Metro/Babel/NativeWind pipeline
npx expo run:android          # nativni dev build
node scripts/generate-icons.mjs      # ikone iz SVG glifa (traži sharp)
```

**Rebuild treba pri dodavanju nativnog modula, pri promjeni ikona I pri
SVAKOJ izmjeni iOS widgeta** — `assets/*.png` se ugrađuju u build, a widget
bundle se čita iz `Bundle.main` (vidi Recent Decisions). Font, SVG
gradijenti i ambijentalne animacije su JS — vidljive običnim reloadom.
**Android widget je iznimka**: njegov handler je običan JS, pa izmjene
rasporeda idu reloadom.

EAS dev build (bez Maca, bez TestFlighta — internal distribution; `eas.json`
postoji, profil `development`):

```bash
npx eas-cli login                                          # jednokratno
npx eas-cli device:create                                  # jednokratno po iOS uređaju
npx eas-cli build --profile development --platform ios     # ~8 min
npx eas-cli build --profile development --platform android # ~25 min
npx eas-cli build:list --limit 2                           # linkovi za instalaciju
```

**EAS ne povlači s GitHuba** — pakira LOKALNO radno stablo, uključujući
necommitane izmjene. Push i build su neovisni.

Provjera prije commita: `typecheck` + `test` + `expo export` moraju biti čisti.
**Za sve vizualno to nije dovoljno** — svaki kartografski bug i svaki bug
redizajna (hero na pola visine, traka izvan ruba, pad na Zagrebu) prošao je
sve tri provjere i bio vidljiv tek na uređaju.

## Architecture

Tok podataka: `useWeatherBundle` sastavlja `WeatherBundle` iz odvojenih
react-query upita (trenutno 10 min, prognoza 30 min, AQI/more 30–60 min,
DHMZ 10 min, pristranost 12 h) i primjenjuje korekcije u **ovom redoslijedu**:

1. `debiasHourly` / `debiasDaily` — ukloni naučenu pristranost modela
   (rješava prognozu za sutra i dalje)
2. `observationDelta` + `correctHourly` — pripiši ostatak razlike mjerenju
   DHMZ postaja (rješava "sada")

Redoslijed je bitan: obrnuto bi se ista greška ispravila dvaput. Hero i prvi
sat u traci koriste **isti** `delta` da se ne razlikuju.

`fetchForecast` spaja dva izvora (`mergeForecasts`): temperature iz ECMWF-a,
UV/vidljivost i zadnja 2 dana iz `best_match`.

Svi vanjski izvori su sigurni na neuspjeh: DHMZ nevaljan XML → `null` →
tihi prelaz na Open-Meteo; bez arhive → pristranost 0; bez OWM ključa →
OWM čipovi sivi uz napomenu, Radar i ostatak rade.

**Karta** ima vlastiti tok, odvojen od `WeatherBundle`: `MAP_LAYERS` opisuje
slojeve, `mapLayerTileUrl` gradi URL pločice (radar iz RainViewer okvira, OWM
uz `&date=` sa satnice), a `useTimelineHours` dohvaća lagan zaseban upit za
centar karte — karti ne trebaju ni korekcije mjerenjem ni DHMZ, samo sirova
krivulja za tu točku.

Render karte je **MapLibre GL** (`@maplibre/maplibre-react-native` 11.3.6,
nativni modul — ne radi u Expo Go): jedna živa karta za sve slojeve (bez
`key` remounta), CARTO vektorski stil kao podloga (`baseStyleFor`), vremenske
pločice kao `RasterSource` + raster `Layer` umetnute `beforeId:
MAP_LABELS_LAYER_ID` da imena ostanu iznad boja. Animacija/klizanje: montiran
je aktivni korak + susjedi (opacity 0, predučitavanje), korak mijenja samo
`raster-opacity` — `tiles` na živom izvoru se ne smije mijenjati (ne radi
ništa), a remount vidljivog izvora bi treperio.

**Izgled** (redizajn + ambijent, 6.8.2026.): `weatherLook.ts` je izvor istine
— `weatherGradient` (WMO + doba dana + tema → 3 stopa), `backdropEffects`
(WMO → **niz** slojeva, pa susnježica = kiša + snijeg, grmljavina = kiša +
bljeskovi, **djelomično oblačno = zrake + oblaci**), `precipIntensity`,
`heroAccent`, `windStrength` + `WIND_FLAG_COLORS`, `dewPoint`, `pollenInfo`,
`warningColor`, `readableOn`. Sve čiste i testirane.

`HeroBackdrop` crta gradijent i bira ambijentalne slojeve iz
`components/backdrop/` (sve u `react-native-svg`, bez nativnog modula).
Pravila za slojeve: `useNativeDriver: true` uvijek (JS driver štuca nakon
reloada), elementi u skupinama koje dijele petlju, platno s izračunatom
rezervom, bešavne petlje (pomak ciklusa = period uzorka). **Isti slojevi
idu i u zaglavlje ladice.** `density="sparse"` daje rjeđu i blijeđu inačicu
sloja (koristi ga djelomično oblačno, gdje oblaci stoje uz sunčane zrake).

**Vjetar i jedinice:** `WindFlag` (vjetrulja) čita **udare** iz
`current.windGusts` u km/h i sam odlučuje hoće li se nacrtati — ispod 10 m/s
vraća `null`, pa se pozivatelji ne bave pragom. Ton se zadaje propom
(`card` / `hero` / `dark`) jer isti znak stoji i na bijeloj kartici i na
gradijentu. Jedinice se svugdje pretvaraju iz metričkih (`convertTemp`,
`convertWind`); `tempUnitSuffix` daje "°" za Celzijus i "°F" za Fahrenheit.
`MapTimeline` jedinice prima **propom**, ne iz storea — `useSettings` bi u
taj modul uvukao AsyncStorage i srušio njegove testove čiste logike.

Tipografija je Space Grotesk kroz `font-grotesk*` klase — RN nema sintetički
bold, pa je svaka debljina zasebna klasa. Naslovi su **normalna slova**, ne
verzal s razmakom (maknuto 6.8.2026. kao generičko).

**Upozorenja** (`useWarnings`): dva puta — Hrvatska preko ručne tablice 14
EMMA regija (`emmaRegions.ts`), ostatak Europe (38 zemalja) preko
geokodiranja imena regije uz **obavezan filtar države**. Bez feeda ili bez
pogotka: prazan niz, traka se ne prikazuje.

**Widgeti** (7.8.2026.) dijele JEDAN izvor istine — `widgetData.ts` pretvara
`WeatherBundle` u plosnate propove (boje, jedinice, pragovi, prijevodi već
izračunati). `useWeatherBundle` ga zove nakon svakog uspješnog dohvata.
Odatle se dvije platforme razilaze:

- **iOS** (`expo-widgets`): widget je zaseban proces koji NE izvršava naš
  JS, pa mu se propovi guraju unaprijed (`updateTimeline`, 12 sati) preko
  App Groupa. Raspored mora biti CIJEL unutar `'widget'` funkcije.
- **Android** (`react-native-android-widget`): handler se vrti u JS-u i
  čita AsyncStorage izravno, pa nema App Groupa ni guranja — podaci se
  čitaju u trenutku crtanja.

Sve nativno se dira samo kroz LIJENE `require` unutar `try`, pa
`widgetData` ostaje čista logika koja se testira, a Android build ne vidi
iOS pakete.

## Files

```
app/_layout.tsx       Drawer (ladica zdesna) — sadrži (screens) i map
app/(screens)/        Stack: index (početna, korijen), search, warnings,
                      pollen, preview, settings, sources — swipe-back radi
                      jer je početna KORIJEN stacka, a ladica prije
                      navigacije radi `dismissAll`
app/map.tsx           fullscreen karta, izvan stacka (vlastite kontrole)
src/api/              openMeteo, dhmz, meteoalarm, meteoalarmEurope,
                      rainviewer, owm, mapLayers, windGrid, windStyle,
                      bias, weather, client, types
src/store/            settings, cities, lastWeather, searchHistory,
                      mapTimeline (zustand + AsyncStorage)
src/components/       Hero, HeroBackdrop, HourlyStrip, BentoGrid, WarningBar,
                      Wordmark ("Podcrt"), WindFlag (vjetrulja), MapPin,
                      Skeleton, SunCycle, DailyList, DayDetails, DhmzCard,
                      MapTimeline, LayerChips...
src/components/backdrop/  ambijentalni slojevi po vremenu: RaysLayer,
                      RainLayer, SnowLayer, CloudsLayer, FogLayer,
                      LightningLayer + shared.ts (LayerProps, rnd, SLOPE)
src/hooks/            useWeatherBundle, useWarnings, useNow, useRadarFrames,
                      useTimelineHours, useWindGrid, useWindStyle, useLocation
src/utils/            weatherCodes, weatherLook, emmaRegions, format, geo, dayParts
src/theme/colors.ts   paper/ink/night/mint + mist (podloga) i coal (tamna kartica)
src/i18n/hr.ts        SVI UI stringovi (kanonski rječnik = izvor tipa)
index.js              ulazna točka; registrira Android widget zadatak pa
                      tek onda diže expo-router (require, ne import)
src/widgets/          iOS widget: BurinWidget (raspored + ambijent),
                      widgetData (most iz WeatherBundle u propove,
                      DIJELI ga i Android), props/iconNames (čisti
                      tipovi), widgetIcons (PNG-ovi u App Group)
src/widgets/android/  Android widget: BurinAndroidWidget (raspored,
                      ambijent kao SVG), widgetTaskHandler (headless —
                      čita AsyncStorage, bez hookova)
assets/widget/        20 PNG ikona widgeta (obrisne + `-fill`)
scripts/generate-icons.mjs  ikone iz glifa "Zapuh" (traži sharp)
scripts/generate-widget-icons.mjs  ikone widgeta (traži sharp)
docs/                 LOKALNO, u .gitignoreu od 6.8.2026. — zapisi odluka i
                      specovi su radni materijal; opće odluke žive OVDJE
                      (Recent Decisions) i u README-u
```

**Razvojni ekran:** Postavke → *Pregled pozadina po vremenu* (`/preview`)
prikazuje svih 15 kombinacija vremena s pravim `HeroBackdrop`-om. Postoji
jer se snijeg i magla ne mogu vidjeti u kolovozu.

Karta: `src/api/mapLayers.ts` je jedini izvor istine o slojevima (`MAP_LAYERS`
— id, oznaka, URL, prozirnost, zoom granice, vrsta vremenske crte). Dodavanje
sloja = jedan unos. `MapTimeline` + `useMapTimeline` (zustand) drže crtu
zajedničkom za sve slojeve, pa prebacivanje čipa ne resetira sat ni play.
