@AGENTS.md

# Burin — status projekta

Minimalistička vremenska aplikacija za Hrvatsku. Expo SDK 54, TypeScript
strict, Expo Router + Drawer, NativeWind, zustand + AsyncStorage, react-query.

SDK 54 je izvorno odabran da radi u Expo Go (iOS bez Maca). Od 5.8.2026. iOS
ide na EAS dev build (osobna Apple licenca, internal distribution), pa Expo Go
više nije ograničenje — nativni moduli su otvoreni (MapLibre, widget).

## Current Status

| Što | Status | Bilješka |
|---|---|---|
| **Engleski jezik** | Kod gotov, **čeka rebuild pa provjeru** | 7.8.2026. Puni prijevod + postavka Sustav/Hrvatski/English. `expo-localization` je NATIVAN → **traži rebuild**; do tada pada na hrvatski i ručni odabir radi. Provjeriti: dani u 14-dnevnoj (Thu, ne čet), smjer vjetra (N/NE/E, ne S/SI/I), tekst upozorenja (en-GB iz feeda), imena regija ("Knin region") |
| **Ikone (svijetla glavna)** | Kod gotov, **traži EAS rebuild** | 7.8.2026. Papirnata podloga, potezi u tinti + koraljni srednji. iOS 18 set `light`/`dark`/`tinted`, Android tri sloja + `backgroundColor: #FAFAF8`. Provjereno renderom i mjerenjem (1024², alfa samo gdje Android traži) |
| **Vedra noć: zvijezde + mjesec** | Kod gotov, **čeka provjeru na uređaju** | 7.8.2026. `StarsLayer`: 54 sitne koje dišu + 11 krupnih koje SIJEVAJU (bljesak 260 ms, pa mirovanje) uz sjaj oko njih. Mjesec ima pravu mijenu (`moonPhase`), rezan maskom. Prva izvedba je imala prevelik pomak sjene pa je izgledala kao pomrčina |
| Heroj: tekst prati podlogu | Kod gotov, **čeka provjeru na uređaju** | 7.8.2026. `readableOn(stops[1])` umjesto `text-ink dark:text-paper` na 11 mjesta. Bilo je nužno jer je noć sada tamna i u SVIJETLOJ temi, pa je crni tekst padao na tamnoplavo |
| Razmaci u heroju | Dorada u tijeku | Marko fino štima `marginBottom` na imenu mjesta (~143) i `marginTop` na opisu (~230) u `Hero.tsx`. Izmjereno: okvir brojke nosi 38.8 px praznine gore, 36.3 dolje |
| Spinner pull-to-refresh na iPhoneu 13 | Open, ne pomiče se | `progressViewOffset={insets.top + 48}` u `app/(screens)/index.tsx`. Marko javio da povećavanje broja **više ne mijenja ništa** — na +28 se vidjela polovica, na +48 isto. Znači offset nije (jedini) uzrok; vidjeti crta li iOS spinner iza `style={{ backgroundColor: stops[0] }}` na ScrollViewu |
| Domet regije: kod kaže 90 km, zapis je govorio 130 | Open, nije greška u radu | `REGION_RANGE_KM = 90` u `useWarnings.ts`; stariji zapis navodi 130 km (dodano zbog grada u Čileu s hrvatskim alarmom). Zaštita radi u oba slučaja — Čile nema feed, a filtar države blokira prelazak granice. Treba samo odlučiti koji je broj točan |
| Polača tip (zaleđe uz morsku postaju) | Open | Postaje su Šibenik/Veli Rat/Knin — sve pretople, pa korekcija **grije** mjesto na 122 m. Zemunika (21 °C, 12 km) nema u feedu; gušćeg DHMZ feeda nema |
| 14-dnevni min/max korekcija | Open | `debiasDaily` radi, ali korekcija mjerenjem se ne primjenjuje na dnevne vrijednosti — mogući blagi nesklad s razdobljima dana |
| Vremenske vijesti / blog | Open, neistraženo | Marko pitao ima li izvora za HR i svijet. Nije istraženo — DHMZ ima vijesti, za svijet treba provjeriti |
| Web kamere | Odgođeno | V&R koristi whatsupcams (komercijalni, bez API-ja); scraping ne dolazi u obzir. Čeka čist izvor (HAK/TZ popis?) |
| **iOS widget** | Istraženo 7.8.2026., **čeka odluku o SDK upgradeu** | `expo-widgets` (Expo, prvoklasni) piše widget u TypeScriptu preko `@expo/ui/swift-ui` — **bez Swifta**. Ali najstarije izdanje je `sdk-55`, a ovisi o `@expo/ui` koji ide u paru sa SDK-om → **traži upgrade 54 → 57**. Dizajn: SAMO gradijent (vidi Recent Decisions), veličine `systemSmall` + `systemMedium` + `accessoryRectangular` |
| SDK upgrade 54 → 57 | Predložen, **provjereno da je nizak rizik** | Izmjereno 7.8.2026., ne procijenjeno: MapLibre 11.3.6 **već ima Fabric codegen** (`componentProvider` za MLRNMapView/RasterSource/Layer/Camera), Reanimated 4.5.3 traži RN 0.83–0.86 a SDK 57 nosi **0.86**, NativeWind 4.2.6 je već najnoviji, Node 22.13.1 zadovoljava. Uklanjanja iz SDK 55 ne diraju projekt (nema `newArchEnabled`, `expo-av`, `notification`, `edgeToEdgeEnabled`) |
| Android widget | Open, nakon iOS-a | v1.1; `burin:last-weather` (zustand persist) je pripremljen kao pohrana. `react-native-android-widget` radi na SDK 54 već sad. **Vjetrulja se ne može nacrtati u RemoteViews** (nema SVG-a) — trebat će PNG po tonu ili pojednostavljen glif |

## Next Step

**Pokrenuti EAS rebuild, pa provjeriti engleski i ikone.** Rebuild je sada
OBAVEZAN — `expo-localization` je nativni modul, a ikone su nativni asseti:

```bash
npx eas-cli build --profile development --platform ios
```

Dok build ne stigne, aplikacija radi normalno (jezik pada na hrvatski,
ručni odabir u Postavkama radi) — uvoz je namjerno lijen i u `try`.

Nakon builda provjeriti:

1. **Engleski** — Postavke → Jezik. Dani u 14-dnevnoj ("Thu", ne "čet"),
   smjer vjetra (**N/NE/E**, ne S/SI/I — hrvatski "S" je sjever, engleski
   je JUG), tekst upozorenja (en-GB blok iz feeda), imena regija
   ("Knin region"). Zadano prati sustav: hrvatski telefon → hrvatski
2. **Ikone** — svijetla pločica na početnom zaslonu; na tamnoj temi
   sustava iOS mora uzeti tamnu varijantu
3. **Vedra noć** — zvijezde moraju SIJEVATI (prva izvedba je bila
   ispod praga zamjećivanja), mjesec gore desno u pravoj mijeni, bez
   tamnog kruga oko sebe
4. **Prijelaz heroja u kartice** — mora biti bez ijednog ruba; prije se
   vidjela dijagonalna svijetla mrlja jer su se dva prijelaza zbrajala
5. **Bijeli tekst na noćnom heroju u SVIJETLOJ temi** — datum, grad,
   velika brojka, opis i minimum
6. **Razmaci u heroju** — Marko fino štima margine oko velike brojke

Radni tijek: Marko gleda na iPhoneu, javi što bode, popravlja se odmah.
Nakon builda su sve daljnje izmjene ovog kruga opet JS-only (reload).

### Zatim: odluka o SDK upgradeu 54 → 57 (zbog widgeta)

iOS widget traži `expo-widgets`, koji **nema izdanje za SDK 54**. Upgrade je
7.8.2026. provjeren kao nizak rizik (brojke u tablici gore) — ono što je
prije držalo projekt na 54 (Expo Go) otpalo je 5.8. s MapLibreom, jer
aplikacija u Expo Gou ionako više ne radi. Testiranje se upgradeom **ne
mijenja**: i dalje EAS dev build, isti `--profile development`.

Redoslijed kad se odluči:

```bash
npx expo install expo@^57.0.0 --fix     # SDK + uparivanje ovisnosti
npm run typecheck && npm test           # prije ijednog builda
npx expo export --platform android      # puni Metro/Babel/NativeWind pipeline
npx eas-cli build --profile development --platform ios
```

Widget se radi **tek nakon** što upgrade prođe provjeru na uređaju — inače
se dvije nepoznanice (novi SDK i novi nativni target) traže u istom buildu.

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
| Widget nosi SAMO gradijent, bez ambijentalnih slojeva | Izmjereno u dokumentaciji 7.8.2026.: `@expo/ui/swift-ui` **nema ni jedan crtaći primitiv** — nema `Path`, `Circle`, `Rectangle`, `Canvas`. Zvijezde, oblaci, kiša, mjesečev srp i vjetrulja se dakle ne mogu nacrtati ni kao mirna slika. Ali `foregroundStyle({type:"linearGradient", colors, startPoint, endPoint})` prima **točno onaj oblik koji `weatherGradient()` već vraća**, pa cijeli sustav paleta prelazi bez ijedne nove linije logike. Identitet ionako NOSI paleta — narančasto sunce, tamnoplava noć, siva naoblaka — pa widget izgleda kao heroj s ugašenim ambijentom |
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
npm test                      # jest, 243 testa u 23 skupine
npx expo export --platform android   # puni Metro/Babel/NativeWind pipeline
npx expo run:android          # nativni dev build
node scripts/generate-icons.mjs      # ikone iz SVG glifa (traži sharp)
```

**Rebuild treba pri dodavanju nativnog modula I pri promjeni ikona** —
`assets/*.png` se ugrađuju u build, reload ih ne mijenja (novi glif "Zapuh"
čeka rebuild). Font, SVG gradijenti i ambijentalne animacije su JS —
vidljive običnim reloadom.

iOS dev build (bez Maca, bez TestFlighta — internal distribution; `eas.json`
postoji, profil `development`):

```bash
npx eas-cli login                                      # jednokratno (Expo račun)
npx eas-cli device:create                              # jednokratno po uređaju (UDID)
npx eas-cli build --profile development --platform ios # ~15 min u oblaku, pa link
```

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
scripts/generate-icons.mjs  ikone iz glifa "Zapuh" (traži sharp)
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
