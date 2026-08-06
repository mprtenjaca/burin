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
| **Upozorenja + pelud + ambijent + navigacija** | Kod gotov, dio provjeren na uređaju | 6.8.2026., [Record](docs/records/2026-08-06-upozorenja-pelud-ambijent.md) + [spec](docs/superpowers/specs/2026-08-06-upozorenja-pelud-ladica-karta-design.md). Meteoalarm za **38 europskih zemalja**, pelud (`/pollen`), 6 ambijentalnih pozadina po vremenu, pravi Stack + swipe-back, MRU gradovi, povijest pretrage |
| **Redizajn početnog ekrana** | Kod gotov, dorada u tijeku | 6.8.2026., po v7 mockupu ([Record](docs/records/2026-08-06-redizajn-pocetnog-ekrana.md)). Marko fino štima razmake oko velike brojke u heroju |
| **Karta → MapLibre** | Provjereno na uređaju, radi | Migracija 5.8.2026. + popravci s uređaja. Vidi [Record](docs/records/2026-08-05-karta-maplibre-odluka.md) |
| Wordmark u aplikaciji | **Čeka Markov odabir** | Ikona "Zapuh" je odabrana i ugrađena; wordmark (logo + tekst) je u drugom krugu prijedloga — Marko bira |
| Polača tip (zaleđe uz morsku postaju) | Open | Postaje su Šibenik/Veli Rat/Knin — sve pretople, pa korekcija **grije** mjesto na 122 m. Zemunika (21 °C, 12 km) nema u feedu; gušćeg DHMZ feeda nema |
| 14-dnevni min/max korekcija | Open | `debiasDaily` radi, ali korekcija mjerenjem se ne primjenjuje na dnevne vrijednosti — mogući blagi nesklad s razdobljima dana |
| Vremenske vijesti / blog | Open, neistraženo | Marko pitao ima li izvora za HR i svijet. Nije istraženo — DHMZ ima vijesti, za svijet treba provjeriti |
| Web kamere | Odgođeno | V&R koristi whatsupcams (komercijalni, bez API-ja); scraping ne dolazi u obzir. Čeka čist izvor (HAK/TZ popis?) |
| Android widget | Open | v1.1; `burin:last-weather` (zustand persist) je pripremljen kao pohrana |

## Next Step

**Nastaviti doradu na uređaju.** Otvoreno konkretno:

1. **Wordmark** — Marko bira među 6 prijedloga (drugi krug); ikona je
   zaključana ("Zapuh"). Kad odabere, ide u `Wordmark.tsx`
2. **Razmaci u heroju** — Marko fino štima `marginBottom` na imenu mjesta
   (linija ~130 u `Hero.tsx`) i `marginTop` na opisu vremena (~189).
   Izmjereno: okvir brojke nosi 38.8 px praznine gore, 36.3 dolje
3. **Nova ikona traži EAS rebuild** — `assets/icon.png` je nativni asset,
   reload ga ne mijenja

Radni tijek: Marko gleda na iPhoneu (JS-only, reload preko
`npx expo start --dev-client` — **rebuild treba samo za ikone/nativno**),
javi što bode, popravlja se odmah.

Ako se temperatura još dira: jedino što ostaje je **gušći izvor mjerenja**.
Izmjereno je da se štimanjem težina više ne dobiva (visina i manji domet su
*gori*), a Polača se bez podatka iz Ravnih kotara ne može riješiti.

## Recent Decisions

| Odluka | Zašto |
|---|---|
| Hrvatska = ručna tablica regija, ostatak Europe = geokodiranje | Meteoalarm NE objavljuje granice ni koordinate regija — samo ime i EMMA ID. Regija po zemlji: Italija 19, Austrija 116, **Njemačka 409**, pa ručna tablica nije izvediva. HR ostaje ručna jer je provjerena i točna. Detalji u [Recordu](docs/records/2026-08-06-upozorenja-pelud-ambijent.md) |
| Filtar države pri geokodiranju regije je OBAVEZAN | Izmjereno: "Velebit channel" bez njega geokodira u Velebit u **Srbiji** — mjesto bi dobilo upozorenje iz krive zemlje |
| Sve što ide na disk mora biti malo | `hourlyAll` (16 dana × 24 h) je ~69 kB po gradu; `persist` ga je serijalizirao na JS threadu pri svakoj promjeni mjesta. Ne piše se na disk — 413 kB → 35 kB za 6 gradova |
| Skupa montiranja odgoditi za jedan kadar | Sadržaj ispod pregiba (bento, 14 dana, MapLibre) i skeleton pri promjeni grada: hero se vidi prvi, pa ne smije čekati najskuplji dio ekrana |
| Animirani elementi idu u SKUPINE koje dijele petlju | Po element = po `Animated.View` + petlja se ne skalira: sunce je montiralo 31 sloj, snijeg 26. Nepravilnost se čuva razlikama unutar skupine (položaj, veličina, faza) |
| `pressed` stil na Pressableu NE radi uz NativeWind | NativeWind pretvara `className` u `style` i prepisuje `style={({pressed}) => …}`. Odziv na dodir ide preko `onPressIn`/`onPressOut` i vlastitog stanja |
| Animirani slojevi trebaju rezervu platna, izračunatu | Svi rezovi na rubovima (magla, oblaci, kiša) imali su isti uzrok. Rezerva mora pokriti i FIKSNE pomake, ne samo udio visine — kiša je u ladici presušila jer je 1.3 × 200 px < 464 px ambijentalnog pomaka |
| `width="100%"` u SVG-u bez `viewBox` daje kvadrat | Nađeno na uređaju (veo magle). Uvijek izričite dimenzije |
| Zrake sunca se NE pomiču, samo dišu | Kad se kose crte kližu, oko ih čita kao oborinu. Sunčano vrijeme dobiva mirnu geometriju + promjenu svjetline |
| Dizajn se zaključava u HTML mockupu prije koda | 7 iteracija u browseru prije ijedne linije redizajna; isto za logo i wordmark (artifact s prijedlozima). Jeftinije od ciklusa build→pogledaj→popravi |
| Vizualno se provjerava NA UREĐAJU, ne u kodu | Svaki bug ovog kruga (odrezana brojka, kvadrat magle, skakanje zvjezdica, swipe u krivi ekran) prošao je typecheck, testove i export |
| Vizualno se provjerava NA UREĐAJU, ne u kodu | Uz kartu (već zapisano) sada i UI: flex hero se stisnuo na pola ekrana, traka sati curila izvan ruba, Zagreb rušio ekran — sve prošlo typecheck, testove i export |
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
| Bugove karte provjeriti **na uređaju** | Svi kartografski bugovi (4 kruga) prošli su typecheck, 132 testa i `expo export`, a bili vidljivi tek na uređaju |
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
npm test                      # jest, 213 testova
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

**Izgled** ([redizajn](docs/records/2026-08-06-redizajn-pocetnog-ekrana.md) +
[ambijent](docs/records/2026-08-06-upozorenja-pelud-ambijent.md), 6.8.2026.):
`weatherLook.ts` je izvor istine — `weatherGradient` (WMO + doba dana + tema
→ 3 stopa), `backdropEffects` (WMO → **niz** slojeva, pa susnježica = kiša +
snijeg, grmljavina = kiša + bljeskovi), `precipIntensity`, `heroAccent`,
`dewPoint`, `pollenInfo`, `warningColor`, `readableOn`. Sve čiste i testirane.

`HeroBackdrop` crta gradijent i bira ambijentalne slojeve iz
`components/backdrop/` (sve u `react-native-svg`, bez nativnog modula).
Pravila za slojeve: `useNativeDriver: true` uvijek (JS driver štuca nakon
reloada), elementi u skupinama koje dijele petlju, platno s izračunatom
rezervom, bešavne petlje (pomak ciklusa = period uzorka). **Isti slojevi
idu i u zaglavlje ladice.**

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
                      Wordmark, MapPin, Skeleton, SunCycle, DailyList,
                      DayDetails, DhmzCard, MapTimeline, LayerChips...
src/components/backdrop/  ambijentalni slojevi po vremenu: RaysLayer,
                      RainLayer, SnowLayer, CloudsLayer, FogLayer,
                      LightningLayer + shared.ts (LayerProps, rnd, SLOPE)
src/hooks/            useWeatherBundle, useWarnings, useNow, useRadarFrames,
                      useTimelineHours, useWindGrid, useWindStyle, useLocation
src/utils/            weatherCodes, weatherLook, emmaRegions, format, geo, dayParts
src/theme/colors.ts   paper/ink/night/mint + mist (podloga) i coal (tamna kartica)
src/i18n/hr.ts        SVI UI stringovi (kanonski rječnik = izvor tipa)
scripts/generate-icons.mjs  ikone iz glifa "Zapuh" (traži sharp)
docs/records/         zapisi odluka
docs/superpowers/specs/  dizajni prije implementacije
```

**Razvojni ekran:** Postavke → *Pregled pozadina po vremenu* (`/preview`)
prikazuje svih 15 kombinacija vremena s pravim `HeroBackdrop`-om. Postoji
jer se snijeg i magla ne mogu vidjeti u kolovozu.

Karta: `src/api/mapLayers.ts` je jedini izvor istine o slojevima (`MAP_LAYERS`
— id, oznaka, URL, prozirnost, zoom granice, vrsta vremenske crte). Dodavanje
sloja = jedan unos. `MapTimeline` + `useMapTimeline` (zustand) drže crtu
zajedničkom za sve slojeve, pa prebacivanje čipa ne resetira sat ni play.
