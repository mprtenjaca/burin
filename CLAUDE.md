@AGENTS.md

# Burin — status projekta

Minimalistička vremenska aplikacija za Hrvatsku. Expo SDK 57, TypeScript
strict, Expo Router + Drawer, NativeWind, zustand + AsyncStorage, react-query.

SDK 54 je izvorno odabran da radi u Expo Go (iOS bez Maca). Od 5.8.2026. iOS
ide na EAS dev build (osobna Apple licenca, internal distribution), pa Expo Go
više nije ograničenje — nativni moduli su otvoreni (MapLibre, widget).

**6.9.2026. — pelud, karta, Android rub.** Oba dev builda su AKTUALNA
(iOS `b2df8268` build 13, Android `05b82ab9` build 4 — oba nose sve
nativne izmjene, fingerprint potvrđen). Pelud prešao na DNEVNI PROSJEK i
razred bez brojke, baždaren na Zadru i Zagrebu; **Štamparov peludomjer je
razvojni izvor iza `__DEV__`** (pravna odluka — vidi Recent Decisions).
Karta dobila dugmad dana i klizač po danu. Repo je od danas na GitHubu
(`origin/master`) — pushati nakon zelenih provjera.

## Current Status

| Što | Status | Bilješka |
|---|---|---|
| **Provjera na uređaju — današnje JS izmjene** | **Čeka Marka, reload** | Pelud (Zadar/Zagreb VISOKA ko Štampar; koprive/trputac u listi; napomena „Izmjereno peludomjerom"; `danas · sutra · datum`), Android donji rub (početna, pelud, ladica, svi podekrani), karta (dugmad dana, klizač po danu, play po danu, atribucija goli tekst iznad legende), ime mjesta („Zadar", ne županija). Sve prošlo typecheck/350 testova/export — vizualno tek na uređaju |
| **TestFlight (prvi upload)** | **Sljedeći korak, 1 build** | Production build je ZASEBAN od dev builda (dev ne može na TestFlight; production ima ZAPEČEN JS). `--auto-submit` je upload, ne treći build. Upute u Next Step |
| **Zahtjev Štamparu za ponovnu uporabu** | Otvoreno, Markova odluka | Jedini pravno čist put do mjerene peludi u produkciji. Štamparovi uvjeti se pozivaju na Pravilnik o ponovnoj uporabi informacija javnog sektora i traže zahtjev; kontakt `info@stampar.hr`. Do tada Štampar ostaje SAMO u razvoju |
| Pelud: CAMS pragovi ostalih vrsta | Otvoreno, čeka sezonu | Ambrozija baždarena na 2 grada × 3 dana (5/6). Breza/joha/maslina/trave NISU mjerene — nije sezona; na proljeće očekivati isti pomak kao kod ambrozije. Treći grad bi rekao je li omjer CAMS/mjerenje regionalan |
| **Sporo na starijim Androidima + veličina aplikacije** | **Otvoreno, za istražiti** (Markov nalaz 6.9.2026.) | Aplikacija je jako spora na starijim uređajima. Prvo IZMJERITI gdje odlazi vrijeme, ne nagađati. Sumnjivci redom: (1) ambijentalne animacije — `IS_LOW_END`/`thin` već prorjeđuju ispod API 33, ali prag i granica nisu mjereni na pravom starom uređaju; (2) `HeroBackdrop` SVG slojevi (RaysLayer ima najviše elemenata); (3) MapLibre GL; (4) veličina bundlea — `index.hbc` je **6.9 MB**, APK 276 MB u debug/dev inačici (dev build nosi Metro + dev alate; production je bitno manji — izmjeriti pravi `--profile production` APK/AAB prije zaključka). Alati: `npx expo export --platform android` pa `source-map-explorer`, Android Studio Profiler, `IS_LOW_END` prag |
| Karta: korak klizača 3 h na temp/naoblaci | Otvoreno, ideja | OWM pločice se mijenjaju svaka 3 h (izmjereno: 9 slika u 24 h), pa dvije trećine pomaka klizača ne mijenjaju sliku. Vjetar (Open-Meteo) je satni i ostao bi na 1 h |
| Engleski jezik | Čeka provjeru na uređaju | Dani (Thu), smjer vjetra **N/NE/E**, upozorenja en-GB, regije, pelud (sve vrste + note), karta (`-24h / Now / Tomorrow`). Test parnosti ključeva i dijakritika prolaze |
| Smjer strujnica vjetra na karti | Otvoreno | TRI izvedbe odbačene (Recent Decisions — ne pokušavati). Preostaje vlastita sličica strelice (`icon-image` u `buildWindStyle`) |
| 14-dnevna „nema podataka" offline | Otvoreno, Markova odluka | `hourlyAll` (69 kB/grad) se ne sprema na disk. Opcije: samo odabrani grad / prorijeđeno / jasnija poruka |
| Spinner pull-to-refresh na iPhoneu 13 | Open | `progressViewOffset` ne mijenja ništa — vidjeti crta li iOS spinner iza `backgroundColor` ScrollViewa |
| Font u widgetu je sustavski | Open, svjesno | Widget je zaseban proces bez Space Groteska |
| Traka sati u srednjem widgetu | Open, neodlučeno | Podaci već idu u `updateTimeline`; pitanje ikona (SF Symbols su Appleov jezik) |
| Domet regije: kod 90 km, stari zapis 130 | Open, nije greška | `REGION_RANGE_KM = 90` u `useWarnings.ts`; odlučiti broj |
| Polača tip / 14-dnevni min-max korekcija | Open | Bez gušćeg mjerenja se ne rješava; `debiasDaily` radi, mjerenje se ne primjenjuje na dnevne |
| Vremenske vijesti / web kamere | Open / odgođeno | DHMZ ima vijesti; kamere čekaju čist izvor |

## Next Step

### 1. Provjera na uređaju (sve je JS — reload, bez builda)

```bash
npx expo start --dev-client
```

Oba builda su instalabilna i aktualna: iOS
[`b2df8268`](https://expo.dev/accounts/mprtenja/projects/burin/builds/b2df8268-f399-4e2a-82c9-51f71145c5ea),
Android [`05b82ab9`](https://expo.dev/accounts/mprtenja/projects/burin/builds/05b82ab9-28ee-46bc-8495-1dbd14c61791).
Dev build ne zamrzava JS — svaka daljnja JS izmjena stiže reloadom.

Što gledati: popis u Current Status, prvi red. Uz to na iOS-u **prsten na
zaključanom zaslonu** (nativno, u buildu je) i nova ikona.

Radni tijek: Marko gleda, javi što bode, popravlja se odmah.

### 2. TestFlight (prvi upload) — JEDAN dodatni build

Dev build NE MOŽE na TestFlight (distribucija `internal`, JS s Metroa).
Production build ima JS ZAPEČEN — što nađeš na TestFlightu traži novi
production build, zato se testira na dev buildu, a TestFlight je za
pokazivanje kolegi.

Jednokratno, u [App Store Connectu](https://appstoreconnect.apple.com):
My Apps → **+ New App** → bundle ID **`com.markop.burin`** (BEZ
`.ExpoWidgetsTarget` — widget extension nikad ne dobiva vlastiti zapis),
SKU **`burin`**.

```bash
npx eas-cli build --profile production --platform ios --auto-submit
```

`--auto-submit` je upload gotovog `.ipa`, ne zaseban build — ne troši
kvotu. Već gotov build se šalje s `npx eas-cli submit --platform ios --latest`.
Prvi put pita za enkripciju: samo HTTPS → „standard/exempt"; da više ne
pita: `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` u `app.config.ts`.

Tko vidi build: **ti** (Internal grupa, odmah); **kolega kojeg dodaš**
(External grupa, e-mail, prvi build Beta App Review ~1 dan); **nitko drugi**
— public link nikad. Buildovi istječu nakon 90 dana.

Kvota buildova se NE VIDI iz CLI-ja — samo na
[expo.dev billing](https://expo.dev/accounts/mprtenja/settings/billing).

### 3. Ako Marko želi mjerenu pelud u produkciji

Sastaviti zahtjev za ponovnu uporabu informacija prema NZJZ Štampar
(`info@stampar.hr`) — i po potrebi ZZJZ Zadarske županije. Do odgovora
Štampar ostaje iza `__DEV__`.

## Recent Decisions

| Odluka | Zašto |
|---|---|
| **Pelud je DNEVNI PROSJEK, ne tekući sat ni maksimum** (`pollenDaysFromHourly`) | Tekući sat: Zadar 6.9. je kroz dan imao ambroziju 1.4→48.7 (35×), pa je ista aplikacija na istom danu govorila „niska" i „vrlo visoka". Maksimum (prvi popravak istog dana) davao je RAZRED VIŠE od mjerenja — jer Hirstov peludomjer JEST 24-satni prosjek (traka se vrti dan, zrnca se podijele s protokom). Prosjek: 2/3 dana pogođeno u Zadru; max 0/3. Pragovi vrijede UZ PROSJEK — tko mijenja agregaciju, mijenja i njih |
| **Ambrozija pragovi `[2, 5, 90]`, baždareni na DVA grada** | Jedan grad nije dovoljan — Zagreb je otkrio da omjer CAMS/mjerenje NIJE stalan: Zagreb 67–89 uz mjereno 8.0 (7–11×), Zadar 17–26 uz 6.6 (0.7–4×). Kontinent dobiva red veličine veće brojke od obale, a mjerenja su slična — pa NIJEDAN množitelj ne pogađa oba; jedino širok razred „visoke" (6–90). Stari `[2,10,30]`: 2/6; novi: 5/6 (promašen samo dan gdje model predviđa 4.9, a Pliva prognozira visoku — model vs mjerenje). Test drži OBA grada. Ostale vrste NISU baždarene (nije sezona) |
| **Pelud prikazuje SAMO RAZRED, bez brojke** (Markov odabir) | Naša brojka je grains/m³ iz CAMS-a, Štamparova/Plivina je INDEKS 0–12+ (niska <2, umjerena <6, visoka <12, vrlo visoka ≥12) — isti dan kod nas 17.2, kod njih 6.6. Dvije mjere iste stvari jedna uz drugu izgledaju ko da netko griješi, a alergičar čita razred. Napomena na dnu IZRIČITO kaže model vs peludomjer i upućuje na županijski zavod — zdravstvena informacija, ne kozmetika |
| Marker na peludnoj skali iz RAZREDA, ne iz omjera (`gradeFraction`) | Skala su ČETIRI JEDNAKA polja, razredi nisu jednako široki — `vrijednost/high` je slao točkicu u krivo polje („piše visoko, točkica na umjereno": 26 → 43 % = drugo polje). Sad uvijek u polju svog razreda, unutar polja razmjerno. Test parnosti tekst↔točkica preko svih vrsta × 16 vrijednosti |
| **Štamparov peludomjer = RAZVOJNI izvor iza `__DEV__`; Pliva ODBIJENA** (`api/stampar.ts`) | Markova odluka nakon pravne provjere: čitanje javne stranice za vlastiti test ≠ distribucija tuđih podataka korisnicima. **Pliva** izričito zabranjuje distribuciju bez pismenog odobrenja i ionako PRESLIKAVA Štampara (brojke iste do decimale, istih 25 gradova). **Štampar** ne zabranjuje ponovnu uporabu — poziva se na Pravilnik o ponovnoj uporabi informacija javnog sektora i traži zahtjev (`info@stampar.hr`). Do dozvole: `enabled: __DEV__ && !!stamparCity` — u produkcijskoj gradnji upit se NIKAD ne pokrene, CAMS ostaje jedini izvor. Zaštita je u kodu, ne u konfiguraciji, da nema prekidača koji se zaboravi |
| Štampar tehnički: GET `?title=<id>`, parser nad HTML-om, 25 gradova s KOORDINATAMA, domet **40 km**, keš **6 h po gradu** | Drupal exposed filter, `method="get"` — nema API-ja. ID-evi NISU abecedni (Dubrovnik 4, Đakovo 5) — prepisani, ne računani. Najbliži grad po haversinu; 40 km a ne 25 jer je jedan peludomjer PO ŽUPANIJI, a Polača je 24.8 km od Zadra (s 25 bi ispadala po GPS šumu). Prvi dan MJERENJE (brojka), sljedeća dva PROGNOZA (samo razred, marker u sredini polja). Tempo (Markov zahtjev „ne pollati agresivno"): ključ po gradu, `staleTime` 6 h uz stranicu koja se mijenja jednom dnevno, bez refetcha na fokus, 1 retry/30 s, `User-Agent` identificira. Parser testiran na ISJEČKU PRAVE STRANICE (`__fixtures__/stampar-zagreb.html`) — kad Štampar promijeni HTML, taj test pukne prvi. Nepoznate vrste `console.warn` |
| `PollenGraded` — GOTOV razred pobjeđuje nad pragovima; 4 Štamparove vrste u tipu | Peludomjer daje razred, ne koncentraciju; provlačiti ga kroz CAMS pragove bilo bi krivo. `PollenDay { levels, graded?, source }`, `pollenSpecies(levels, graded)`. Koprive/trputac/crkvina/loboda dodane da se Štampar prikaže VJERNO (test protiv izvora ne vrijedi ako app prešuti vrstu); CAMS ih nikad ne puni. Napomena na ekranu prati `source` |
| Ime mjesta: `placeNameFrom` ODBIJA upravne jedinice (`useLocation`) | „Moja lokacija" je pisala *Zadarska županija*: na Androidu `city` zna biti `null` izvan velikih gradova pa je `city ?? subregion ?? region` palo na županiju. Filtar po SUFIKSU (županija/county/Landkreis/Bezirk…), ne po popisu; `district` ispred `subregion` (Android ondje nosi naselje). Radije „Moja lokacija" nego županija. 7 testova, uklj. da „Regionalni park Vransko jezero" PROLAZI |
| **iOS `Gauge` je u widgetu NEUPOTREBLJIV — prsten se crta RUKOM; ne pokušavati** | Dokazano u `node_modules`: `Gauge` oznake omata u `<Slot name="currentValue">`, nativna strana čita `children?.slot(...)` — a `SlotView` NIJE registriran u `expo-widgets/DynamicView.swift` (ima `GaugeView`, nema `SlotView`; `children` slaže kao običan niz). `slot()` uvijek `nil` → luk bez ijedne brojke (prazan krug od 7.8.). Popravak 8.8. je maknuo min/max, a `currentValueLabel` ide istim slotom pa je preživio. Sad `ZStack` + dva `Circle` sa `strokeBorder` + `dash` po opsegu (isti trik ko crtice vjetra) + `Text`; opseg po SREDNJICI (`strokeBorder` crta unutra) |
| Atribucija karte: uspravna uz rub ODBAČENA, sjena teksta ODBAČENA — goli tekst 42 % iznad legende, bez pilule | Uspravna: omot 18 px → red se PRELOMIO na dva prije rotacije, natpisi jedan ispod drugog; da radi, omot mora biti dug ko natpis = okvir preko pola ekrana koji guta dodire. Sjena: na 9 px slovima šira od poteza → „slova su mutna". Pilula maknuta (mrlja na tamnoj karti). Obveza (OSM ODbL, CARTO/RainViewer/Open-Meteo) ispunjena: vidljivo, dodir otvara izvor, `hitSlop` 10 |
| **Karta: DUGMAD dana; klizač pokriva SAMO odabrani dan; play vrti ODABRANI dan** (`MapTimeline`, `dayJumps`, `playRange`) | 96–120 satnih koraka na jednoj šini = dan je petina ekrana, piksel preskače sate. Dugme bira dan (skok na PODNE tog dana — po njemu se dan prepoznaje; danas → „sada"), klizač daje tom danu punu širinu (24 koraka; `minimumValue/maximumValue` iz raspona dana). Play se prije UVIJEK vraćao na „sada" i išao do kraja — odabir dana bio besmislen; sad petlja unutar dana, na današnjem od „sada". Sidro „Sada" samo kad je u vidljivom rasponu. Test: rasponi cjeloviti, bez preklapanja, skok unutar svog raspona |
| Oznake dana: `-24 h · Sada · Sutra · 8.9.` (karta) / `danas · sutra · uto 8.9.` (pelud); „danas" iz SATA UREĐAJA | Ime dana u prošlosti se pomiješa s istim danom idućeg tjedna; sutra je najčešća meta; od prekosutra datum. `isNow` traži TOČNO poklapanje niza s tekućim satom i pada čim se sat pomakne/zona razlikuje → svi dani ispadnu datum (Markov nalaz „sutra piše datum", 3×). Datum uređaja je rezerva; `isNow` ostaje samo za crticu na šini. Pelud računa po DATUMU, ne po indeksu — prvi dan je danas samo slučajno |
| `forecast_days` kod Open-Metea BROJI DANAS kao prvi dan | `3` = danas + 2, ne + 3. Karta ima `FORECAST_DAYS = 4` (jučer, danas, tri naprijed = 5 dugmadi); pelud `forecast_days=3` = danas + 2, kako Pliva objavljuje. OWM daje različite pločice i na +240 h |
| **OWM pločice se mijenjaju SVAKA 3 SATA, ne svaki sat** (`&date=` radi −120 h…+240 h, bez tihog ponavljanja) | Izmjereno md5-om kroz 24 h: 9 različitih slika (+0, +1, +4, +7, …). Klizač ima korak 1 h pa dvije trećine pomaka ne mijenjaju sliku — izgleda „zaglavljeno" iako radi. Vjetar (Open-Meteo mreža, `past_days=1&forecast_days=3` u `windGrid.ts`) je JEDINI satni sloj. Otvoreno: korak 3 h na temp/naoblaci (Status) |
| `useBottomInset`: safe-area dno SAMO na Androidu, kao DODATAK paddingu | App je edge-to-edge (`edgeToEdgeEnabled: true`, zadano SDK 57) → Androidova traka s 3 gumba (neprozirna, ~48 dp) leži PREKO dna svakog ScrollViewa; iOS indikator je proziran pa se čita (Marko potvrdio OK). Visina ovisi o uređaju (gesta ~24, gumbi ~48) — konstanta ne može. Svi ekrani + ladica; donji padding preseljen iz Tailwind klasa u `contentContainerStyle` da ga drži jedna vrijednost |
| Vjetar NEMA korekciju mjerenjem — i NE TREBA je (izmjereno 8.8.2026.) | Leave-one-out na 34 postaje: bez korekcije 2.056 m/s, aditivna 2.156, multiplikativna 2.064 — obje lošije. Vjetar je lokalan (Prevlaka 12.9 uz model 1.7, Rab 2.1 uz 7.3 — susjedne postaje suprotne), temperatura se u prostoru mijenja glatko. `windSpeed/windGusts` idu iz modela kakvi su |
| TestFlight = ZASEBAN production build; dev build NE MOŽE na TestFlight; `--auto-submit` nije build | Dev: `internal`, JS s Metroa — zato je alat za testiranje (svaka JS izmjena reloadom, bez novog builda). Production: `store`, JS ZAPEČEN — što nađeš traži cijeli novi build, zato se NE testira na TestFlightu. Ukupno 2 builda po ciklusu. Kvota se ne vidi iz CLI-ja, samo na expo.dev billing. EAS pakira LOKALNO stablo (fingerprint dokazuje što je unutra; `Commit` u ispisu je samo oznaka HEAD-a, ne popis) |
| **Akcenti**: odabrano = `ACCENT_UI` (#2C6FC4) na svijetlom, `ACCENT_STEEL` na tamnim trakama; `ACCENT_CORAL` samo gdje boja znači „pozor" | Jedna plava za „odabrano" (postavke, čipovi, ladica, tražilica, dugmad dana). Na tamnoj traci karte `ACCENT_UI` pada na 2.55:1 → `ACCENT_STEEL` (3.85–5.38:1); ispunjeni čipovi ostaju `ACCENT_UI` jer se mjeri bijeli tekst NA njima. Koraljna (3.03:1 na bijelom — pada) ostaje za UV, oborine, radar, crtice tlaka. Heroj: zlatna `HERO_GOLD` na vedrom nebu; traka sati vlastiti `stripAccent`. Sve mjereno kontrastom, po podlozi |
| **AI sažetak je OBRISAN, ostaju ručne rečenice** (`src/utils/quips.ts`) | Traženi glas je DALMATINSKI i grub ("jebački vruće", ikavica, `ča`, `kuva`) — model to na dva jezika ne pogađa pouzdano, a promašen domaći ton je gori od nikakvog. Uz to: rečenica je sad UVIJEK tu (bez mreže, kvote i čekanja od 2 s), nema ključa ni troška. Zakomentiran 10.8.2026., **obrisan 1.9.2026.** (Markov odabir — mrtav kod koji se dvaput čitao ko „možda se vrati"): otišli `src/api/summary.ts`, `src/hooks/useSummary.ts`, cijeli `worker/` (Cloudflare + Gemini), `EXPO_PUBLIC_SUMMARY_URL` iz `.env.example`, unosi u `.gitignore` i `exclude` u `tsconfig.json`. Ništa od toga nije bilo commitano, pa u povijesti nema što tražit — povratak bi značio pisat iznova |
| **Rečenica je iza PREKIDAČA u Postavkama, ZADANO UGAŠENA** (`quips`) | Markov odabir 1.9.2026. Tekst psuje, a vrijeme je usluga koju netko otvori pred djetetom ili pokaže kolegi — psovka koju nije tražio je promašaj kakav ostatak aplikacije nigdje ne radi. Ugašeno znači da se `QuipLine` NE RENDERIRA (odabrano između tri varijante; pristojna inačica svake rečenice je odbijena — dvostruko pisanje za glas koji nije bio poanta). Odluka je NA POČETNOJ: `quipBundle={quips ? bundle : undefined}`, jer heroj ne čita postavke ni za što drugo. Naslov u postavkama IZRIČITO spominje psovke — opcija ugašena zbog jezika mora reći što pali, inače je iznenađenje koje prekidač i treba spriječit |
| Pragovi vjetra se UVOZE iz `weatherLook`, ne prepisuju | `WIND_STORM_KMH` (61.2 km/h = 8 Bf) je isti broj na kojem značka bure postaje olujna. Da su prepisani, jedan bi se dan pomaknuo bez drugog i rečenica bi govorila "bura" dok značka šuti. Polje `current.windGusts` je u KM/H, ne m/s |
| Ikonski gumbi: pravi padding + `pointerEvents="none"` na ikonu | Nađeno na uređaju 8.8.: dodir NA glif nije radio, tek desno od njega. Lucide ikone su SVG (`react-native-svg`), koji na Androidu zna PROGUTATI dodir umjesto da ga pusti Pressableu; a sama ikona 22 px + nevidljivi `hitSlop` je premala meta. Pravilo za svaki ikonski gumb: `p-2` (uz `-m-2` da glif ostane na mjestu) + ikona u omotu bez dodira |
| Model NIJE mjerenje — pri pitanju „kakvo je vrijeme" gledati DHMZ | ECMWF je za Roč davao „vedro" dok je Pazin (18.6 km) javljao GRMLJAVINU i stvarno je bilo oblačno. Prvo `hrvatska_n.xml`, model samo za ono što postaje ne mjere |
| Traka sati se reže PRI CRTANJU (`futureHours`), ne pri dohvatu | `mapHourly` reže od punog sata pri dohvatu, a upit stoji 30 min — u 15:40 je prva kolona bila „15" s prognozom starom pola sata („piše kiša, a vani vedro"). Rez pri renderu prema `useNow`; kad su svi sati prošli, vraća zadnje poznato |
| Odmak animacije ide u FAZU, ne u odgodu pokretanja | Snijeg: `setTimeout` do 4 s prije `start()` → skupina stoji zamrznuta („kreće od pola ekrana") i visi na fiksnom bočnom pomaku (vodoravni tragovi). Petlje kreću odmah, razlika skupina kroz `setValue` početne vrijednosti. Vrijedi za svaki sloj sa skupinama |
| Smjer strujnica vjetra: TRI izvedbe odbačene — ne pokušavati | (1) `symbol` s „▶": CARTO glifovi su samo osnovni ASCII (dekodiran `.pbf` — raspon prazan); (2) `line-gradient`: spec ga IZRIČITO zabranjuje uz `line-dasharray`; (3) drugi sloj crtica (rep): typecheck čist, a NA UREĐAJU ruši ekran — dva dash sloja nad istim izvorom mijenjana svakih 130 ms native ne podnosi. Preostaje vlastita sličica u stilu karte |
| Ekran peludi prima podatke KROZ PARAMETRE navigacije, ne kroz hookove | Popravak 13.8.2026. („po sekunde da se otvori"): ekran je na montiranju vrtio `useWeatherBundle` (cijelo sastavljanje) i `useLocation` — a taj na „Mojoj lokaciji" pri SVAKOM otvaranju iznova traži GPS + reverse geocode PREKO MREŽE. Kartica sad šalje `levels` (JSON, desetak brojki) + `place` u parametrima, ekran je čisti prikaz. Odgoda liste za jedan kadar (8.8.) OSTAJE — crtanje skala unutar prijelaza i dalje košta. Isto pravilo kao `widgetData.ts`: što prima drugi ekran, mora biti gotovo |
| Skupa montiranja odgoditi za jedan kadar — i SKUPE POSLOVE iza prijelaza | Prošireno 8.8.: uz sadržaj ispod pregiba na početnoj, isti obrazac dobile tražilica (~20 `PlaceRow` redova) i pelud. `pushWidget` ide kroz `InteractionManager.runAfterInteractions` — svjež dohvat slijeće točno u kadar prijelaza, a widget crta oba Android widgeta i serijalizira iOS crtu; njegova točnost se mjeri u minutama |
| Ambijent widgeta: `frame` na VELIČINU PLOČICE + `clipped`, po `widgetFamily` | Dva kvara istog uzroka: SwiftUI `ZStack` poprimi veličinu najvećeg djeteta. Zrake od 226 px u pločici od 158 → sadržaj gurnut iz kadra (samo na SUNCU — kiša 32 px, oblaci 64 px stanu). Pa onda konstanta 360 px širine → mala pločica (158) rastegnuta, „samo slika bez brojki". Dimenzija se čita iz `environment.widgetFamily`. Sadržaj iOS widgeta uz to treba padding 18, ne 14: `ignoreSafeArea()` na pozadini ukida i sustavne margine sadržaja (Android s istih 14 izgleda prozračnije jer taj sloj nema) |
| `size` na `@expo/ui` `Image` vrijedi samo za SF Symbole | Ikona iz datoteke se crta u PUNOJ veličini dok se ne doda `resizable()` → `aspectRatio({fit})` → `frame()`, tim redom; sam `frame` preveliku sliku samo OBREŽE (golema odrezana ikona na uređaju) |
| `null` NE SMIJE u propove widgeta | `Exception in HostFunction`: propovi prelaze u Swift `[String: Any]`, gdje JS `null` nema parnjaka — crta se ne upiše i widget crta „undefined" posvuda. Odsutnost = boolean (`hasGusts`), broj = 0. Test čuva pravilo za sve buduće propove |
| Android widget se osvježava `requestWidgetUpdate`, crtež u `android/render.tsx` | `pushWidget` je zvao samo iOS put pa je widget ostajao na starom gradu do 30 min (`updatePeriodMillis` minimum). Sada dva pozivatelja (headless handler + aplikacija) dijele isti crtež da se ne raziđu |
| Meki rubovi na Androidu: `radialGradient`, ne `feGaussianBlur` | `RemoteViews` ne izvršava SVG filtere pouzdano — blur otpadne i ostane goli krug (tvrdi rubovi oblaka). Gradijent je ISPUNA pa prolazi svuda; izmjereno renderom (skok 2 razine na 5 px) |
| Ambijentalni slojevi se prorjeđuju na slabijim uređajima | Kiša štucala na S10e: 63 `<Line>` sa dash + round caps rasterizirano na CPU-u. Ispod Android API 33: 32 crte, ravni krajevi. Prorjeđivanje nosi IZVORNI indeks (uzorak i faza ovise o njemu) — inače se vraća vodoravni prazni „val" |
| `EXPO_PUBLIC_*` se ZAPEČE u bundle pri POČETKU builda; visibility `PLAIN`, profili navode `environment` | Build 9 (18:01) je krenuo prije nego je ključ stvoren (18:10) pa je izašao BEZ njega — OWM čipovi sivi. Metro te varijable zamjenjuje doslovnim tekstom pri pakiranju, nisu runtime. Zato: varijabla mora postojati PRIJE `build`, a ne za vrijeme. `SENSITIVE` je za njih lažna sigurnost — skriva vrijednost samo u EAS logovima, dok je u `.ipa` svejedno čitljiv tekst; javni ključ se drži `PLAIN` da se barem može provjeriti. Svaki profil u `eas.json` dobio je izričit `environment` da se ne pogađa koje okruženje EAS veže |
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
| Open-Meteo ima SATNU kvotu (~600/h) — resetira se na puni sat | Probijena testiranjem mreže vjetra (154 koordinate = 154 poziva!). Duži `staleTime`, batch upiti, vidljiva poruka. **Ne trošiti kvotu na testiranje** — provjeravati kodom i lokalno |
| Sva mjerenja izmjeriti; protiv termometra, ne protiv V&R | Više je „logičnih" ideja izmjereno kao pogoršanje. Bug je 3 commita bio nevidljiv jer je slučajno približavao V&R-u |
| `PRIMARY_MODEL` (ECMWF IFS) dijele prikaz i bias; korekcija: prosjek 3 DHMZ postaje, domet 60 km, kazna za udaljenost JEDNOM, prigušenje po dosljednosti | Sve leave-one-out izmjereno (1.99 vs 2.37 °C itd.). NE učiti iz DHMZ postaja, NE vagati po visini, NE smanjivati domet, NE tražiti prognozu s kopnene točke za obalna mjesta |
| iOS ide na EAS dev build, ne Expo Go | Osobna licenca + jedini developer → internal distribution. EAS pakira LOKALNO stablo, push i build su neovisni |
| yr.no ne pokriva HR; Open-Meteo nema tile endpoint; OWM besplatni nema strelice vjetra | Zato: Open-Meteo JSON po točki + OWM pločice + vlastiti sloj vjetra |

## Development

```bash
npx expo start --dev-client   # dev server; JS izmjene idu reloadom, BEZ rebuilda
npm run typecheck             # tsc --noEmit
npm test                      # jest, 350 testova u 29 skupina
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
čisti — pa `git push origin master` (repo je od 6.9.2026. na GitHubu,
commiti bez Claude co-author trailera). **Za sve vizualno to nije dovoljno** — svaki vizualni bug je prošao
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
bijelo→jantarno. **Vremenska crta** (`MapTimeline`): `useTimelineHours`
nosi `past_days=1, forecast_days=4` (5 dana); `dayJumps` daje dugmad
(`-24 h · Sada · Sutra · datum`), klizač pokriva SAMO odabrani dan,
`playRange` u `map.tsx` vrti odabrani dan. OWM pločice se mijenjaju svaka
3 h, vjetar svaki sat.

**Izgled**: `weatherLook.ts` je izvor istine — `weatherGradient` (plavo nebo,
isto kao widget), `backdropEffects` (WMO 1 = zrake + rijetki oblaci; grmljavina
= oblaci + kiša + bljeskovi), `heroAccent` (zlatna/hladna), `stripAccent`,
`ACCENT_UI`/`ACCENT_STEEL`/`ACCENT_CORAL`, `readableOn`. `HeroBackdrop` +
`components/backdrop/` (petlje u skupinama, faza umjesto odgode, prorjeđivanje
na slabijim uređajima kroz `IS_LOW_END`/`thin` u `shared.ts`).

**Pelud** (6.9.2026.): `fetchAirQuality` traži SATNI niz za 3 dana i
`pollenDaysFromHourly` ga svodi na DNEVNI PROSJEK po vrsti (peludomjer je
24-satni prosjek — ne max, ne tekući sat). `PollenDay { date, levels,
graded?, source }`; `pollenSpecies(levels, graded)` — gotov razred pobjeđuje
nad pragovima. **Štampar** (`api/stampar.ts`) je razvojni izvor: u
`useWeatherBundle` drugi upit `enabled: __DEV__ && !!nearestStamparCity`
(≤ 40 km), ključ po gradu, keš 6 h; kad vrati dane, zamjenjuje CAMS-ove.
Ekran peludi i kartica čitaju `day.graded` i `day.source` (napomena).

**Lokacija**: `placeNameFrom` u `useLocation` bira ime mjesta iz reverse
geocodea i ODBIJA upravne jedinice (sufiksi županija/county/Landkreis…).

**Donji rub**: `useBottomInset` (Android-only safe-area dno, edge-to-edge)
dodan na padding svakog ScrollViewa i ladice.

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
src/api/              openMeteo (+fetchCurrentBatch, pollenDaysFromHourly), dhmz,
                      meteoalarm(+Europe), rainviewer, owm, mapLayers, windGrid,
                      windStyle, bias, weather, client (+fetchText headers), types,
                      stampar (RAZVOJNI izvor peludi; __fixtures__/stampar-zagreb.html
                      je isječak prave stranice za test parsera)
src/store/            settings, cities, lastWeather (+refreshCurrent),
                      searchHistory, mapTimeline
src/components/       Hero, HeroBackdrop, QuipLine (domaća rečenica NA
                      heroju), HourlyStrip, BentoGrid (Card/Value/
                      Compass/PressureGauge), WarningBar, Wordmark, WindFlag,
                      MapPin, Skeleton, SunCycle, DailyList, DayDetails,
                      DhmzCard, MapTimeline (+dayJumps, klizač po danu),
                      LayerChips, LayerLegend...
src/components/backdrop/  RaysLayer, RainLayer, SnowLayer, CloudsLayer,
                      FogLayer, LightningLayer + shared.ts (IS_LOW_END, thin)
src/hooks/            useWeatherBundle (+Štampar upit iza __DEV__),
                      useRefreshSavedCities, useWarnings, useNow, useRadarFrames,
                      useTimelineHours, useWindGrid, useWindStyle,
                      useLocation (+placeNameFrom), useBottomInset
src/utils/            weatherCodes, weatherLook (+PollenGraded, 10 vrsta peludi),
                      emmaRegions, quips (domaće rečenice o danu — dalmatinski,
                      zamjena za OBRISANI AI sažetak), format
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
