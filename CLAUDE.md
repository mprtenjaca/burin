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
| **Karta → MapLibre** | **Implementirano — čeka provjeru na uređaju** | Kod migriran 5.8.2026. (typecheck + 131 test + export čisti). Kartografske bugove je MOGUĆE vidjeti tek na uređaju — iOS EAS dev build je sljedeći korak. Vidi [Record](docs/records/2026-08-05-karta-maplibre-odluka.md) |
| Crtice vjetra (vlastiti sloj) | **Implementirano — čeka provjeru na uređaju** | Kratke crtice iz Open-Meteo mreže koje klize u smjeru strujanja, na vlastitoj plavoj podlozi. Zamijenile OWM `wind_new` (polje boja bez smjera) |
| Polača tip (zaleđe uz morsku postaju) | Open | Postaje su Šibenik/Veli Rat/Knin — sve pretople, pa korekcija **grije** mjesto na 122 m. Zemunika (21 °C, 12 km) nema u feedu; gušćeg DHMZ feeda nema |
| 14-dnevni min/max korekcija | Open | `debiasDaily` radi, ali korekcija mjerenjem se ne primjenjuje na dnevne vrijednosti — mogući blagi nesklad s razdobljima dana |
| Vremenska upozorenja (Meteoalarm) | Open | "Upozorenja" postoji u rječniku, ekran nije napravljen |
| Android widget | Open | v1.1; `burin:last-weather` (zustand persist) je pripremljen kao pohrana |

## Next Step

**Provjeriti MapLibre kartu na uređaju** (iOS EAS dev build — `eas.json` je
pripremljen). Migracija je kodirana i prolazi sve tri provjere, ali svaki
dosadašnji kartografski bug bio je vidljiv tek na uređaju. Provjeriti:

1. Podloga (voyager svijetla / dark-matter za naoblaku+vjetar) i prebacivanje
   stila pri promjeni čipa — kamera i vremenska crta moraju preživjeti
2. Radar: glatka animacija bez treperenja (raster-opacity izmjena), rastezanje
   iznad z=8 bez nestajanja
3. OWM slojevi: klizanje po satima mijenja pločicu (`&date=`), imena gradova
   čitljiva IZNAD boja (`beforeId`)
4. Pregled radara na početnoj (androidView="texture" je samo za Android;
   na iOS-u provjeriti da kartica uopće crta)

Nakon toga: strelice vjetra (symbol sloj iz Open-Meteo mreže), pa v1.1
(Meteoalarm, widget).

Ako se temperatura još dira: jedino što ostaje je **gušći izvor mjerenja**.
Izmjereno je da se štimanjem težina više ne dobiva (visina i manji domet su
*gori*), a Polača se bez podatka iz Ravnih kotara ne može riješiti.

## Recent Decisions

| Odluka | Zašto |
|---|---|
| Radar `maxNativeZ` je 7, ne 8 | Nađeno NA UREĐAJU: pri približavanju se pokazivala siva pločica "Zoom Level Not Supported". Izmjereno dekodiranjem: RainViewer od z=8 vraća HTTP 200 i bajt-identičnu sliku (1370 B, md5 2cc6649e) na SVIM koordinatama — **ta slika JE taj natpis**. Ranija bilješka "iznad 8 nema novih podataka" je bila točno zapažanje s krivim zaključkom |
| Vjetar je vlastiti sloj, ne OWM pločica | Besplatni `wind_new` je polje boja bez smjera — izgledao je gotovo isto kao naoblaka. Sada: kratke crtice iz Open-Meteo mreže (154 točke, jedan upit, 364 ms) koje klize u smjeru strujanja |
| Crtice se animiraju `line-dasharray`, ne pomicanjem geometrije | Geometrija bi se morala slati nativnom sloju 8×/s (stotine linija); dasharray je promjena stila koju GL primi odmah. Svi kadrovi moraju imati isti zbroj ciklusa i nenegativne članove — inače crtice pulsiraju umjesto da teku |
| Putanje crtica su kratke (6 koraka), mreža gusta (14×11) | Duga putanja razvuče crtice preko pola karte; kratka + gusta daje rojenje kao na referenci |
| Smjer vjetra se interpolira preko u/v, ne stupnjeva | Prosjek 350° i 10° u stupnjevima daje 180° — točno suprotno od stvarnog (0°) |
| OWM slojevi dobivaju `raster-saturation`/`contrast` | Izmjereno: `temp_new` ima alfu **76/255 na svakom pikselu** (30 % vidljivosti) — izvor je poluproziran pa boje izlaze isprane. `raster-opacity` to ne može (1.0 je maksimum), zasićenje i kontrast mogu |
| Vjetar dobiva vlastitu plavu podlogu | Bijele crtice se ne vide na svijetlom stilu, a na dark-matteru izgledaju mrtvo. Positron se preboji u letu (`windStyle.ts`) — CARTO plavi stil ne postoji |
| Animacija karte izmjenom `raster-opacity`, ne `tiles` | Izmjereno u knjižnici (MLRNSource.kt): `tiles` na živom izvoru se NE primjenjuje — native ga čita samo u `makeSource()`. Paint se primjenjuje odmah (`setReactStyle` → `addStyles()`). Zato: aktivni okvir + susjedi s opacity 0 (GL inačica starog 0.01-trika), key po URL-u |
| Vremenske pločice `beforeId: boundary_country_outline` | Izmjereno 5.8.2026.: taj sloj postoji u OBA CARTO stila kao početak bloka granice+imena → boje iznad terena, imena gradova iznad boja (s react-native-maps nemoguće) |
| Zoom granice globalne (4–12), ne po sloju | MapLibre iznad `maxzoom` izvora rasteže pločicu i nikad ne traži nepostojeću — "zoom level not supported" strukturno ne postoji. `maxZoom` po sloju obrisan iz `MapLayer` |
| Pregled radara `androidView="texture"` | GLSurfaceView u scroll listi na Androidu ima z-order artefakte; TextureView nema. Puni ekran ostaje na bržem surface |
| CARTO GL stilovi umjesto raster pločica | Vektorska podloga bez ključa (izmjereno: 200, 93 sloja, glyphs+sprite), oštar tekst na svakom zoomu, Google Maps ključ i PROVIDER_GOOGLE otpadaju |
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
npm start                 # dev server (traži instaliran dev build, ne Expo Go)
npm run typecheck         # tsc --noEmit
npm test                  # jest, 131 test
npx expo export --platform android   # puni Metro/Babel/NativeWind pipeline
npx expo run:android      # nativni dev build
node scripts/generate-icons.mjs      # ikone iz SVG glifa (traži sharp)
```

iOS dev build (bez Maca, bez TestFlighta — internal distribution; `eas.json`
postoji, profil `development`):

```bash
npx eas-cli login                                      # jednokratno (Expo račun)
npx eas-cli device:create                              # jednokratno po uređaju (UDID)
npx eas-cli build --profile development --platform ios # ~15 min u oblaku, pa link
```

Provjera prije commita: `typecheck` + `test` + `expo export` moraju biti čisti.
**Za kartu to nije dovoljno** — svaki dosadašnji kartografski bug prošao je sve
tri provjere i bio vidljiv tek na uređaju.

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

## Files

```
app/                  ekrani (index, map, search, settings, sources)
src/api/              openMeteo, dhmz, rainviewer, owm, mapLayers, windGrid, windStyle, bias, weather, client, types
src/store/            settings, cities, lastWeather, mapTimeline (zustand + AsyncStorage)
src/components/       Hero, HourlyStrip, DailyList, DayDetails, DhmzCard, MapTimeline, LayerChips, LayerLegend, WindBarbs...
src/hooks/            useWeatherBundle, useRadarFrames, useTimelineHours, useWindGrid, useWindStyle, useLocation
src/utils/            weatherCodes, format, geo, dayParts
src/i18n/hr.ts        SVI UI stringovi (kanonski rječnik = izvor tipa)
docs/records/         zapisi odluka
docs/superpowers/specs/  dizajni prije implementacije
```

Karta: `src/api/mapLayers.ts` je jedini izvor istine o slojevima (`MAP_LAYERS`
— id, oznaka, URL, prozirnost, zoom granice, vrsta vremenske crte). Dodavanje
sloja = jedan unos. `MapTimeline` + `useMapTimeline` (zustand) drže crtu
zajedničkom za sve slojeve, pa prebacivanje čipa ne resetira sat ni play.
