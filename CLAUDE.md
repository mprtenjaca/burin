@AGENTS.md

# Burin — status projekta

Minimalistička vremenska aplikacija za Hrvatsku. Expo SDK 57, TypeScript
strict, Expo Router + Drawer, NativeWind, zustand + AsyncStorage, react-query.

SDK 54 je izvorno odabran da radi u Expo Go (iOS bez Maca). Od 5.8.2026. iOS
ide na EAS dev build (osobna Apple licenca, internal distribution), pa Expo Go
više nije ograničenje — nativni moduli su otvoreni (MapLibre, widget).

**8.8.2026. — veliki plavi redizajn.** Widgeti su POTVRĐENI na uređaju
(iOS i Android rade s podacima). Cijela aplikacija je prešla s narančaste
na plavu: vedro nebo dijeli boje s widgetom, odabrano stanje je `ACCENT_UI`,
nova ikona aplikacije (tamna pločica + čelično plavi zapuh). Uz to hrpa
popravaka nađenih na uređaju — svi u Recent Decisions.

## Current Status

| Što | Status | Bilješka |
|---|---|---|
| **Novi buildovi (iOS + Android)** | **ČEKA REBUILD** | Buildovi od 7.8. (`fe2f09e5`/`50b2679b`) su ZASTARJELI. Od tada u repo ušlo: nova ikona (varijanta 7), iOS widget popravci (`resizable` ikona, sunčani ambijent `frame`+`clipped`, širina po veličini pločice, padding 18, `hasGusts` umjesto `null`), Android `clickAction: OPEN_APP` + `requestWidgetUpdate`. Ništa od toga se ne vidi bez rebuilda |
| **TestFlight** | **Sljedeći korak** | Upute niže u Next Step — uključuju odgovore na bundle ID, SKU i auto-submit |
| Plavi redizajn | Kod gotov, provjera reloadom | Nebo umjesto narančaste (iste boje kao widget), zlatni akcent heroja, bento brojke 40 + bilješka naoblake, osjet+more dva reda bez naslova, kompas 144 centriran na karticu, UV/tlak obrat s prigušenom `#D9D9D3` u tamnoj temi |
| Smjer strujnica vjetra na karti | Otvoreno | TRI izvedbe odbačene (vidi Recent Decisions — ne pokušavati ponovno). Jedino preostalo: vlastita sličica strelice registrirana u stil karte (`icon-image` u `buildWindStyle`), zaseban zahvat |
| 14-dnevna „nema podataka" offline | Otvoreno, čeka Markovu odluku | `hourlyAll` se NAMJERNO ne sprema na disk (69 kB/grad), pa detalji dana bez mreže nemaju izvor. Opcije: (1) spremati samo za odabrani grad, (2) prorijeđeno (svaka 3. točka), (3) samo jasnija poruka |
| Engleski jezik | Čeka provjeru na uređaju | Dani (Thu), smjer vjetra **N/NE/E**, upozorenja en-GB, regije. Kompas i DHMZ kartica su od 8.8. prevedeni (HR „S" = sjever, EN „S" = JUG!) |
| Spinner pull-to-refresh na iPhoneu 13 | Open | `progressViewOffset` više ne mijenja ništa — vidjeti crta li iOS spinner iza `backgroundColor: stops[0]` na ScrollViewu |
| Font u widgetu je sustavski | Open, svjesno | Widget je zaseban proces bez Space Groteska; ubacivanje fonta u target je izvediv zaseban zahvat |
| Traka sati u srednjem widgetu | Open, neodlučeno | Podaci već idu u `updateTimeline`; otvoreno pitanje ikona (SF Symbols su Appleov jezik) |
| Domet regije: kod 90 km, stari zapis 130 | Open, nije greška u radu | `REGION_RANGE_KM = 90` u `useWarnings.ts`; treba samo odlučiti koji broj |
| Polača tip / 14-dnevni min-max korekcija | Open | Bez gušćeg izvora mjerenja se ne rješava; `debiasDaily` radi ali se mjerenje ne primjenjuje na dnevne vrijednosti |
| Vremenske vijesti / web kamere | Open / odgođeno | DHMZ ima vijesti; kamere čekaju čist izvor (whatsupcams je komercijalan) |

## Next Step

### 1. Rebuild oba builda

```bash
npx eas-cli build --profile development --platform ios
npx eas-cli build --profile development --platform android
```

Bez toga se ne vide: nova ikona, svi widget popravci, Android klik na widget.

### 2. TestFlight (prvi upload)

Osobni račun = tim si samo ti, pa **nitko ne vidi build dok ga ti ne
pozoveš**. Nema javne liste.

Jednokratno, u [App Store Connectu](https://appstoreconnect.apple.com):
My Apps → **+ New App** → bundle ID **`com.markop.burin`** (onaj BEZ
`.ExpoWidgetsTarget` — to je widget extension i nikad ne dobiva vlastiti
zapis), SKU **`burin`** (interno, korisnici ne vide, ne može se mijenjati).

Po buildu — dva u jedan:

```bash
npx eas-cli build --profile production --platform ios --auto-submit
```

Obrada ~10–30 min, pa se build pojavi u kartici TestFlight. Prvi put pita
za enkripciju: aplikacija koristi samo HTTPS → „standard/exempt". Da nikad
više ne pita, dodati u `app.config.ts`:
`ios.infoPlist.ITSAppUsesNonExemptEncryption: false`.

Tko vidi build:
- **Ti**: Internal Testing grupa (tvoj Apple ID) — odmah, bez reviewa
- **Kolega kojeg TI dodaš**: External Testing grupa → e-mail → pozivnica u
  TestFlight aplikaciju. Prvi build u external grupi prolazi Beta App
  Review (~1 dan); sljedeći buildovi iste verzije idu odmah
- **Nitko drugi** — jedino NE kreirati public link
- Buildovi istječu nakon **90 dana**

### 3. Provjera na uređaju (reload za JS, rebuild za ostalo)

Sunčani widget (tekst se mora vidjeti — bio gurnut iz kadra), mala pločica
(brojke — bila je rastegnuta na 360 px), ikona u widgetu (`resizable`),
klik na Android widget otvara aplikaciju, promjena grada osvježava Android
widget, radar staje na z=9, temperaturni sloj jači (`doubleUp`), UV/tlak u
tamnoj temi (prigušena bijela), veliki kompas, tražilica: cijeli red
klikabilan + akcijske ikone rade na dodir.

Radni tijek: Marko gleda na uređaju, javi što bode, popravlja se odmah.

**SVAKA izmjena iOS widgeta traži REBUILD** — widget bundle se čita iz
`Bundle.main`, ne s Metroa. Android widget handler je običan JS pa izmjene
rasporeda idu reloadom; ali `clickAction` i config su nativni.

**Vjetar nema korekciju mjerenjem.** Temperatura ide kroz `debiasHourly` +
`observationDelta`, a `windSpeed`/`windGusts` se prenose iz modela kakvi su.

## Recent Decisions

| Odluka | Zašto |
|---|---|
| TestFlight buildovi su nevidljivi dok se tester ne pozove | Osobni račun = tim si samo ti. Internal grupa (ti) bez reviewa; external po e-mailu uz jednokratni Beta review; **public link nikad** — to je jedino što bi build otvorilo svima |
| Ikona aplikacije je varijanta 7: tamna pločica + plavi zapuh | Markov odabir 8.8. između 10 prijedloga. Podloga `#141821` (blagi plavi pomak — čista crna uz plavi potez izgleda kao odsutnost boje), bijeli vanjski potezi, `ACCENT_STEEL` srednji. Svijetla i tamna su ISTA pločica: ikona koja mijenja podlogu s temom prestaje biti isti znak, a widget ionako ima jednu verziju |
| Ikonski gumbi: pravi padding + `pointerEvents="none"` na ikonu | Nađeno na uređaju 8.8.: dodir NA glif nije radio, tek desno od njega. Lucide ikone su SVG (`react-native-svg`), koji na Androidu zna PROGUTATI dodir umjesto da ga pusti Pressableu; a sama ikona 22 px + nevidljivi `hitSlop` je premala meta. Pravilo za svaki ikonski gumb: `p-2` (uz `-m-2` da glif ostane na mjestu) + ikona u omotu bez dodira |
| Red tražilice je CIJELI Pressable | Prije je gumb bio samo stupac s imenom, pa je desna polovica (vjetrulja, ikona, temperatura) bila mrtva zona. Ugniježđeni akcijski gumb i dalje pobjeđuje za svoje područje — RN daje dodir najdubljem hvataču |
| `inverted` kartice (UV, tlak): obrat OSTAJE, ali s prigušenom bijelom | Markov izbor 8.8. u DVA kruga: prvo je tamno-na-tamnom odbijeno (obrat mu se sviđa), pa je čista papirnata u tamnoj temi (17.6:1 prema podlozi — bliješti) zamijenjena prigušenom `#D9D9D3` (~12:1). Crtice tlaka su KORALJNE — topla skala na disku draža od plave. Svijetla tema netaknuta |
| Popisi se osvježavaju JEDNIM batch upitom pri pokretanju | Ladica i tražilica čitaju temperaturu iz keša koji je punio samo puni dohvat otvorenog mjesta — ostali gradovi su držali stare brojke. `useRefreshSavedCities` (korijen aplikacije): spremljeni + odabrani + povijest u JEDNOM multi-koordinatnom upitu (Open-Meteo prima liste odvojene zarezom), samo mjesta koja VEĆ imaju keš (svaka koordinata troši kvotu, a `refreshCurrent` ostale ionako preskače), prag 10 min, i na povratak u aplikaciju. Upisuje SAMO `current` — paket bez prognoze bi offline srušio ekran. Neuspjeh (`null`) nikad ne briše staro |
| Vedar dan i djelomično oblačno su PLAVI i u aplikaciji | Markov odabir 8.8.: widget je 7.8. prešao na plavo, pa su aplikacija i pločica pokazivale isto vrijeme u dvije boje. Aplikacija preuzima ISTE vrijednosti (`#3E76AA/#2F5F8E/#234B72` i `#3A6B98/#2C567E/#204464`), test pada ako se raziđu. Posljedice NAMJERNE: `readableOn` vraća bijeli tekst, heroj je tamniji. Obje teme dijele boje |
| Akcent na vedrom heroju je ZLATNA (`HERO_GOLD`) | Na novom plavom dnu gradijenta hladna plava daje 1.80:1, stara topla 2.18:1 — obje padaju. Zlatna `#F4C542` prolazi s 5.56:1 i nosi toplinu koju je podloga izgubila |
| Traka sati ima VLASTITI akcent (`stripAccent`), ne `heroAccent` | Traka NE stoji na nebu — dno gradijenta se stapa u podlogu stranice, pa su postotci na SVIJETLOM. Zlatna tamo daje 1.56:1 i nestane; fiksna hladna plava drži 4.81/3.46:1 na obje teme. Pokušaj da traka uzme `readableOn` je sve pobijelio — podloga joj NIJE tamna |
| Odabrano stanje je PLAVO (`ACCENT_UI` #2C6FC4) | Nakon plavog neba narančasta je izgledala kao ostatak starog dizajna. Ista boja kao `HERO_COOL`/`stripAccent` — jedna plava za „odabrano": postavke, čipovi karte, razdoblja dana, ladica (aktivan grad FIKSNO — `heroAccent` je tamo vraćao zlatnu, 1.63:1 na bijeloj kartici), tražilica. Koraljna (3.03:1 na bijelom — pada) ostaje gdje boja znači „pozor": UV skala, oborine u 14-dnevnoj, radar, crtice tlaka |
| Na TAMNIM podlogama ide `ACCENT_STEEL`, ne `ACCENT_UI` | Na traci karte (~#171717–#323231) `ACCENT_UI` pada na 2.55:1 — lošije od koraljne koju mijenja; `ACCENT_STEEL` drži 3.85–5.38:1. Ispunjeni elementi (čipovi) ostaju `ACCENT_UI` jer se tamo mjeri BIJELI TEKST NA njima (5.03:1) |
| Zapuh u wordmarku je PLAV, po podlozi | Koraljna je ostala samo zadani prop. Početna zove `ACCENT_UI` (svijetla stranica), karta i ladica `ACCENT_STEEL` (tamne trake) — jedna plava ne prolazi obje podloge, mjereno za svaku |
| Zaglavlje ladice prati GRADIJENT, stavke ispod prate TEMU | Zaglavlje crta gradijent vremena → tekst kroz `readableOn(stops[1])` kao heroj. Stavke stoje na mist/night podlozi i drže `text-ink dark:text-paper`; granica je rub zaglavlja |
| Naoblaka je STUPNJEVANA: WMO 0 ≠ 1 ≠ 2 | Roč/Pazin su javljali „pretežno vedro", a crtalo se čisto sunce. Sada: 0 = zrake, 1 = zrake + RIJETKI oblaci (+ manje iskrica, 7 umjesto 16), 2 = zrake + oblaci. Grana po WMO kodu u `backdropEffects` — boja je za 0 i 1 ista, pa zaseban ključ palete nema smisla. Grmljavina je dobila oblake IZA kiše i munje |
| Model NIJE mjerenje — pri pitanju „kakvo je vrijeme" gledati DHMZ | ECMWF je za Roč davao „vedro" dok je Pazin (18.6 km) javljao GRMLJAVINU i stvarno je bilo oblačno. Prvo `hrvatska_n.xml`, model samo za ono što postaje ne mjere |
| Traka sati se reže PRI CRTANJU (`futureHours`), ne pri dohvatu | `mapHourly` reže od punog sata pri dohvatu, a upit stoji 30 min — u 15:40 je prva kolona bila „15" s prognozom starom pola sata („piše kiša, a vani vedro"). Rez pri renderu prema `useNow`; kad su svi sati prošli, vraća zadnje poznato |
| Odmak animacije ide u FAZU, ne u odgodu pokretanja | Snijeg: `setTimeout` do 4 s prije `start()` → skupina stoji zamrznuta („kreće od pola ekrana") i visi na fiksnom bočnom pomaku (vodoravni tragovi). Petlje kreću odmah, razlika skupina kroz `setValue` početne vrijednosti. Vrijedi za svaki sloj sa skupinama |
| Radar: pločice **512 px**, kamera staje na **z=9** | Dva odvojena nalaza. (1) 512 px nosi 3.5× više piksela od 256 uz istu paletu — pravi detalj; `tileSize` je polje sloja i MORA pratiti URL. (2) RainViewer besplatni API staje na z=7 — piše u njihovoj dokumentaciji („Maximum zoom level is 7") i dokazano: 4 RAZLIČITE pločice na z=8 vraćaju bajt-identičan placeholder. Njihova aplikacija zumira dalje jer NE koristi javni endpoint. Zato `maxUserZoom` PO SLOJU na kameri: radar/naoblaka 9, temperatura/vjetar 12 |
| Temperaturni sloj karte: pločica se crta DVAPUT (`doubleUp`) | OWM `temp_new` ima alfu 76/255 na SVAKOM pikselu — 70 % viđenog je podloga. `raster-opacity` > 1 ne postoji; tamna podloga ne pomaže (kroma ista); zasićenje iznad ~1.0 lomi boje u susjedne razrede. Dva sloja istog izvora: alfa 30 → 51 %, kroma 53 → 89, bez novog dohvaćanja |
| Smjer strujnica vjetra: TRI izvedbe odbačene — ne pokušavati | (1) `symbol` s „▶": CARTO glifovi su samo osnovni ASCII (dekodiran `.pbf` — raspon prazan); (2) `line-gradient`: spec ga IZRIČITO zabranjuje uz `line-dasharray`; (3) drugi sloj crtica (rep): typecheck čist, a NA UREĐAJU ruši ekran — dva dash sloja nad istim izvorom mijenjana svakih 130 ms native ne podnosi. Preostaje vlastita sličica u stilu karte |
| Više strujnica SIJANJEM, ne gušćom mrežom; skala bijelo→jantarno | Model je na ~0.1° pa gušće točke vraćaju iste brojeve i troše kvotu; ali `sampleWind` interpolira bilo gdje → dodatni počeci između čvorova besplatno (154 točke → 616 strujnica). Pomaci NESIMETRIČNI da se ne vidi rešetka. Zelena maknuta — na plavoj podlozi se čitala kao vlastita informacija; `LayerLegend` mora pratiti (dva mjesta) |
| Skupa montiranja odgoditi za jedan kadar — i SKUPE POSLOVE iza prijelaza | Prošireno 8.8.: uz sadržaj ispod pregiba na početnoj, isti obrazac dobile tražilica (~20 `PlaceRow` redova) i pelud. `pushWidget` ide kroz `InteractionManager.runAfterInteractions` — svjež dohvat slijeće točno u kadar prijelaza, a widget crta oba Android widgeta i serijalizira iOS crtu; njegova točnost se mjeri u minutama |
| Ambijent widgeta: `frame` na VELIČINU PLOČICE + `clipped`, po `widgetFamily` | Dva kvara istog uzroka: SwiftUI `ZStack` poprimi veličinu najvećeg djeteta. Zrake od 226 px u pločici od 158 → sadržaj gurnut iz kadra (samo na SUNCU — kiša 32 px, oblaci 64 px stanu). Pa onda konstanta 360 px širine → mala pločica (158) rastegnuta, „samo slika bez brojki". Dimenzija se čita iz `environment.widgetFamily`. Sadržaj iOS widgeta uz to treba padding 18, ne 14: `ignoreSafeArea()` na pozadini ukida i sustavne margine sadržaja (Android s istih 14 izgleda prozračnije jer taj sloj nema) |
| `size` na `@expo/ui` `Image` vrijedi samo za SF Symbole | Ikona iz datoteke se crta u PUNOJ veličini dok se ne doda `resizable()` → `aspectRatio({fit})` → `frame()`, tim redom; sam `frame` preveliku sliku samo OBREŽE (golema odrezana ikona na uređaju) |
| `null` NE SMIJE u propove widgeta | `Exception in HostFunction`: propovi prelaze u Swift `[String: Any]`, gdje JS `null` nema parnjaka — crta se ne upiše i widget crta „undefined" posvuda. Odsutnost = boolean (`hasGusts`), broj = 0. Test čuva pravilo za sve buduće propove |
| Android widget se osvježava `requestWidgetUpdate`, crtež u `android/render.tsx` | `pushWidget` je zvao samo iOS put pa je widget ostajao na starom gradu do 30 min (`updatePeriodMillis` minimum). Sada dva pozivatelja (headless handler + aplikacija) dijele isti crtež da se ne raziđu |
| Meki rubovi na Androidu: `radialGradient`, ne `feGaussianBlur` | `RemoteViews` ne izvršava SVG filtere pouzdano — blur otpadne i ostane goli krug (tvrdi rubovi oblaka). Gradijent je ISPUNA pa prolazi svuda; izmjereno renderom (skok 2 razine na 5 px) |
| Ambijentalni slojevi se prorjeđuju na slabijim uređajima | Kiša štucala na S10e: 63 `<Line>` sa dash + round caps rasterizirano na CPU-u. Ispod Android API 33: 32 crte, ravni krajevi. Prorjeđivanje nosi IZVORNI indeks (uzorak i faza ovise o njemu) — inače se vraća vodoravni prazni „val" |
| `autoIncrement` ide na SVE profile, ne samo `production` | Uz `appVersionSource: "remote"` broj podiže samo profil koji ga ima — dev je stajao na 1 zauvijek, a iOS odbija instalirati dvije gradnje s istim brojem. `version` u `app.config.ts` ostaje ručan |
| Ladica se otvara `navigation.openDrawer()`, ne `DrawerActions` | Od SDK 56 `expo-router` odbija uvoz iz `@react-navigation/*` — `expo export` pukne. `@react-navigation/drawer` izbačen (hash bundlea identičan) |
| Pri dizanju SDK-a očekivati ČETIRI vrste sitnih zapreka | (1) paketi koji se prestanu autolinkati moraju ručno u `plugins`; (2) `tsconfig` `types` je izričit popis; (3) paketi pod `expo/node_modules` traže jest `moduleNameMapper`; (4) zabranjeni uvozi pucaju tek na `expo export` |
| `'widget'` direktiva izdvaja TIJELO funkcije u zaseban paket | Sve u dosegu MODULA je widgetu NEDOSTUPNO (`ReferenceError: Backdrop`) — pomoćne komponente i konstante unutra, i zovu se kao FUNKCIJE, ne JSX. Typecheck/testovi/export sve prođu — greška se vidi tek na uređaju |
| `expo-widgets` je ISKLJUČEN iz Android autolinkinga | `checkDuplicateClasses`: oba widget paketa traže `androidx.work` u različitim verzijama. `expo.autolinking.android.exclude` u `package.json`; na Androidu je `expo-widgets` ionako KOSTUR (crta `Text(widgetName)`) |
| Widget ikone su ODVOJENA briga od upisa crte; greške se logiraju | Pad ikona u istom `try` je preskakao `updateTimeline` → bijela pločica bez greške. Dva bloka + `console.warn` (`[burin] widget nije osvježen:` / `ikone nisu spremne:`). `expo-file-system` i `expo-asset` su izravne ovisnosti |
| Android widget: `SvgWidget` prima SVG string; handler čita AsyncStorage izravno | Gradijent s tri stopa i ambijent kao prava grafika; nema App Groupa. `index.js` postoji samo da registrira headless zadatak PRIJE expo-routera (require, ne import — hoisting) |
| Widget ima JEDNU verziju, uvijek tamnu | Tema telefona se ne prati; palete su potamnjene inačice (bijeli tekst ≥ 4.5:1, najniže 4.78). Vedar dan u widgetu je PLAVO NEBO — žuta ne trpi bijeli tekst (1.63:1) |
| Ambijent iOS widgeta od `Rectangle`/`Circle`; MALA pločica vidi ±79 px | Nema `Path`/`Canvas`. Kose crte = rotirani pravokutnici pod 29°. Sve što mora raditi na obje veličine mora biti u pojasu ±79 px od sredine |
| Ikone widgeta su PNG (`sharp`), lock screen dobiva PUNE, preklopi se režu MASKOM | SF Symbols se ne koriste (Appleov jezik). `vibrant` način stanji obrise → `*-fill` set. Maska ne dodaje boju na gradijent podloge. Tintanu verziju iOS radi sam — kod samo izostavi gradijent i ambijent u `accented` načinu |
| Gradijent u widgetu: `Rectangle` + `foregroundStyle` + `ignoreSafeArea()` | `containerBackground`/`background` primaju samo `Color`; jedini modifikator s `linearGradient` je `foregroundStyle`. Pouka: **tipove čitati iz `node_modules`, ne iz dokumentacije** |
| Widget dobiva IZRAČUNATE boje i tekstove kroz `updateTimeline` (12 h) | Widget ne izvršava naš JS i ne vidi AsyncStorage (App Group). iOS budžetira buđenja (~40–70/dan) pa snapshot zastarijeva. Tekući sat se preskače (duplikat datuma = neispravna crta). Tip propova u zasebnom `props.ts` (nativni uvozi ruše testove) |
| Značka bure: po UDARIMA, pragovi 10/17 m/s, vjetrulja s prozirnim rasjecima | Bura se pamti po udarima (Polača: 4.2 stalno, 9.1 udari). 17.2 = 8 Bf. Tri tona po podlozi (`card`/`hero`/`dark`). SVG provjeriti RENDEROM u PNG prije uređaja; koordinate se IZRAČUNAJU (`rotate(kut,cx,cy)` — `transform-origin` ne postoji u react-native-svg) |
| m/s zadan; Fahrenheit dobiva slovo (ispod kružića), 14 dana bez slova | DHMZ i pomorska prognoza govore m/s. `persist` čuva stari izbor postojećih instalacija |
| Jedinice u `MapTimeline` propom, ne iz storea | `useSettings` bi uvukao AsyncStorage i srušio testove čiste logike — isto pravilo kao `props.ts` u widgetu |
| Tražilica: tipkovnica se ne otvara sama; GPS TEK NA DODIR; hamburger desno | Najčešći potez je dodir na poznat grad. Iznimka za GPS: kad je heroj već „Moja lokacija". Ladica izlazi zdesna pa gumb desno |
| Hrvatska = ručna tablica 14 EMMA regija, Europa = geokodiranje + OBAVEZAN filtar države | Meteoalarm ne objavljuje granice; Njemačka ima 409 regija. Bez filtra „Velebit channel" geokodira u Srbiju |
| Sve što ide na disk mora biti malo | `hourlyAll` (69 kB/grad) se NE piše na disk — `persist` serijalizira na JS threadu. (Posljedica: 14-dnevni detalji offline nemaju izvor — otvoreno u Statusu) |
| Animirani elementi u SKUPINAMA koje dijele petlju; `useNativeDriver: true` uvijek | Po element = 31 sloj na suncu. Platno s IZRAČUNATOM rezervom (pokriti i fiksne pomake); `width="100%"` bez `viewBox` daje kvadrat; zrake sunca se NE pomiču, samo dišu |
| `pressed` stil na Pressableu NE radi uz NativeWind | `className` → `style` prepisuje funkciju. Odziv kroz `onPressIn/Out` + vlastito stanje |
| Dizajn se zaključava u HTML mockupu; vizualno se provjerava NA UREĐAJU | Nijedan vizualni bug nije uhvaćen provjerama — svi su prošli typecheck, testove i export. Render SVG-a u PNG (`sharp`) hvata dio prije telefona |
| react-query `queryFn` nikad `undefined`; `keepPreviousData` na upitima uz poziciju karte | „Query data cannot be undefined"; bez `keepPreviousData` svaki pomak karte gasi kontrole |
| Veličine ciljaju starije korisnike | Ništa sitno ispod 11 px, ništa bitno ispod 65 % kontrasta |
| Animacija karte izmjenom `raster-opacity`, ne `tiles`; crtice vjetra `line-dasharray`; smjer preko u/v | `tiles` na živom izvoru native ignorira. Geometrija 8×/s je preskupa; svi dash kadrovi moraju imati isti zbroj. Prosjek stupnjeva 350°/10° daje 180° |
| OWM slojevi: `saturation`/`contrast` (alfa 76/255 u izvoru), `opacity: 1`, `&date=<unix>` radi | `raster-opacity` iznad 1 ne ide; množenje ispod 1 gasi naoblaku (12/255). `&date` je nedokumentiran ali daje različite slike −48 h do +120 h |
| Open-Meteo ima SATNU kvotu (~600/h) — resetira se na puni sat | Probijena testiranjem mreže vjetra (154 koordinate = 154 poziva!). Duži `staleTime`, batch upiti, vidljiva poruka. **Ne trošiti kvotu na testiranje** — provjeravati kodom i lokalno |
| Sva mjerenja izmjeriti; protiv termometra, ne protiv V&R | Više je „logičnih" ideja izmjereno kao pogoršanje. Bug je 3 commita bio nevidljiv jer je slučajno približavao V&R-u |
| `PRIMARY_MODEL` (ECMWF IFS) dijele prikaz i bias; korekcija: prosjek 3 DHMZ postaje, domet 60 km, kazna za udaljenost JEDNOM, prigušenje po dosljednosti | Sve leave-one-out izmjereno (1.99 vs 2.37 °C itd.). NE učiti iz DHMZ postaja, NE vagati po visini, NE smanjivati domet, NE tražiti prognozu s kopnene točke za obalna mjesta |
| iOS ide na EAS dev build, ne Expo Go | Osobna licenca + jedini developer → internal distribution. EAS pakira LOKALNO stablo, push i build su neovisni |
| yr.no ne pokriva HR; Open-Meteo nema tile endpoint; OWM besplatni nema strelice vjetra | Zato: Open-Meteo JSON po točki + OWM pločice + vlastiti sloj vjetra |

## Development

```bash
npx expo start --dev-client   # dev server; JS izmjene idu reloadom, BEZ rebuilda
npm run typecheck             # tsc --noEmit
npm test                      # jest, 280 testova u 26 skupina
node scripts/generate-widget-icons.mjs  # 20 ikona widgeta (traži sharp)
npx expo export --platform android   # puni Metro/Babel/NativeWind pipeline
npx expo run:android          # nativni dev build
node scripts/generate-icons.mjs      # ikone aplikacije (varijanta 7; traži sharp)
```

**Rebuild treba pri dodavanju nativnog modula, pri promjeni ikona I pri
SVAKOJ izmjeni iOS widgeta** — `assets/*.png` se ugrađuju u build, a widget
bundle se čita iz `Bundle.main`. Font, SVG gradijenti i ambijentalne
animacije su JS — vidljive običnim reloadom. **Android widget je iznimka**:
handler je običan JS (ali `clickAction`/config su nativni).

EAS (dev + TestFlight):

```bash
npx eas-cli build --profile development --platform ios      # dev build, ~8 min
npx eas-cli build --profile development --platform android  # ~25 min
npx eas-cli build --profile production --platform ios --auto-submit  # TestFlight, 2-u-1
npx eas-cli build:list --limit 2                            # linkovi za instalaciju
```

**EAS ne povlači s GitHuba** — pakira LOKALNO radno stablo. Metro na
Windowsima povremeno padne s `EMFILE: too many open files` — nije aplikacija,
restart `npx expo start --dev-client -c` čisti (trajno rješenje: Watchman).

Provjera prije commita: `typecheck` + `test` + `expo export` moraju biti
čisti. **Za sve vizualno to nije dovoljno** — svaki vizualni bug je prošao
sve tri provjere i bio vidljiv tek na uređaju.

## Architecture

Tok podataka: `useWeatherBundle` sastavlja `WeatherBundle` iz odvojenih
react-query upita (trenutno 10 min, prognoza 30 min, AQI/more 30–60 min,
DHMZ 10 min, pristranost 12 h) i primjenjuje korekcije u **ovom redoslijedu**:

1. `debiasHourly` / `debiasDaily` — ukloni naučenu pristranost modela
2. `observationDelta` + `correctHourly` — pripiši ostatak razlike mjerenju

Redoslijed je bitan: obrnuto bi se ista greška ispravila dvaput. Hero i prvi
sat u traci koriste **isti** `delta`. `fetchForecast` spaja ECMWF (temperature)
i `best_match` (UV/vidljivost/zadnja 2 dana). Svi vanjski izvori sigurni na
neuspjeh.

**Osvježavanje popisa** (8.8.2026.): `useRefreshSavedCities` u korijenu
aplikacije — jedan multi-koordinatni `fetchCurrentBatch` (spremljeni +
odabrani + povijest, samo već keširana mjesta) pri pokretanju i povratku,
prag 10 min. Upisuje samo `current` kroz `refreshCurrent` u `lastWeather`.

**Karta**: vlastiti tok (`MAP_LAYERS`, `mapLayerTileUrl`, `useTimelineHours`).
MapLibre GL, jedna živa karta, pločice `beforeId` ispod imena. Animacija
izmjenom `raster-opacity` na montiranim susjedima. `maxUserZoom` po sloju
na kameri (radar 9). Radar 512 px; `temp_new` se crta dvaput (`doubleUp`).
Vjetar: strujnice iz Open-Meteo mreže + sijanje dodatnih početaka; skala
bijelo→jantarno.

**Izgled**: `weatherLook.ts` je izvor istine — `weatherGradient` (plavo nebo,
isto kao widget), `backdropEffects` (WMO 1 = zrake + rijetki oblaci; grmljavina
= oblaci + kiša + bljeskovi), `heroAccent` (zlatna/hladna), `stripAccent`,
`ACCENT_UI`/`ACCENT_STEEL`/`ACCENT_CORAL`, `readableOn`. `HeroBackdrop` +
`components/backdrop/` (petlje u skupinama, faza umjesto odgode, prorjeđivanje
na slabijim uređajima kroz `IS_LOW_END`/`thin` u `shared.ts`).

**Upozorenja** (`useWarnings`): HR ručna tablica 14 EMMA regija, Europa
geokodiranje + filtar države.

**Widgeti** dijele `widgetData.ts` (bundle → plosnati propovi; `hasGusts`,
nikad `null`). iOS: `expo-widgets`, propovi unaprijed kroz `updateTimeline`
(App Group), raspored CIJEL u `'widget'` funkciji, ambijent vezan `frame` +
`clipped` na `widgetFamily`. Android: `react-native-android-widget`, crtež u
`android/render.tsx` s DVA pozivatelja — headless handler (sustav) i
`pushWidget` → `requestWidgetUpdate` (promjena grada/podataka). `pushWidget`
se odgađa `InteractionManager`-om iza prijelaza.

## Files

```
app/_layout.tsx       Drawer (ladica zdesna); useRefreshSavedCities u korijenu
app/(screens)/        Stack: index (korijen), search, warnings, pollen,
                      preview, settings, sources — swipe-back radi jer je
                      početna korijen stacka; search/pollen montiraju liste
                      kadar nakon ekrana
app/map.tsx           fullscreen karta, izvan stacka
src/api/              openMeteo (+fetchCurrentBatch), dhmz, meteoalarm(+Europe),
                      rainviewer, owm, mapLayers, windGrid, windStyle, bias,
                      weather, client, types
src/store/            settings, cities, lastWeather (+refreshCurrent),
                      searchHistory, mapTimeline
src/components/       Hero, HeroBackdrop, HourlyStrip, BentoGrid (Card/Value/
                      Compass/PressureGauge), WarningBar, Wordmark, WindFlag,
                      MapPin, Skeleton, SunCycle, DailyList, DayDetails,
                      DhmzCard, MapTimeline, LayerChips, LayerLegend...
src/components/backdrop/  RaysLayer, RainLayer, SnowLayer, CloudsLayer,
                      FogLayer, LightningLayer + shared.ts (IS_LOW_END, thin)
src/hooks/            useWeatherBundle, useRefreshSavedCities, useWarnings,
                      useNow, useRadarFrames, useTimelineHours, useWindGrid,
                      useWindStyle, useLocation
src/utils/            weatherCodes, weatherLook, emmaRegions, format
                      (+futureHours), geo, dayParts
src/i18n/hr.ts        SVI UI stringovi (kanonski rječnik = izvor tipa)
index.js              registrira Android widget zadatak pa diže expo-router
src/widgets/          iOS: BurinWidget, widgetData (most, dijeli i Android),
                      props/iconNames, widgetIcons
src/widgets/android/  BurinAndroidWidget, widgetTaskHandler, render (zajednički
                      crtež za handler i requestWidgetUpdate)
assets/widget/        20 PNG ikona widgeta
scripts/generate-icons.mjs         ikone aplikacije (varijanta 7)
scripts/generate-widget-icons.mjs  ikone widgeta
docs/                 LOKALNO, u .gitignoreu — zapisi odluka su radni
                      materijal; opće odluke žive OVDJE i u README-u
```

**Razvojni ekran:** Postavke → *Pregled pozadina po vremenu* (`/preview`)
prikazuje svih 15 kombinacija vremena s pravim `HeroBackdrop`-om.
