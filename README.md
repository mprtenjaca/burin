# Burin

Minimalistička vremenska aplikacija za Hrvatsku — React Native + Expo SDK 57,
TypeScript strict. Veliki hero s gradijentom koji prati vrijeme, animirane
ambijentalne pozadine, bento kartice s instrumentima i karta s vremenskim
slojevima. Sve veličine i kontrasti ciljaju i starije korisnike: ništa sitno
ispod 11 px, ništa bitno ispod 65 % kontrasta.

## Izvori podataka

| Izvor | Za što | Ključ |
|---|---|---|
| [DHMZ](https://meteo.hr) | trenutna mjerenja najbliže postaje (`hrvatska_n.xml`) | ne treba |
| [Open-Meteo](https://open-meteo.com) | prognoza (ECMWF IFS, 16 dana po satima), geokodiranje, kvaliteta zraka + pelud, arhiva za pristranost, mreža vjetra | ne treba |
| [Meteoalarm](https://meteoalarm.org) | upozorenja za 38 europskih zemalja | ne treba |
| [RainViewer](https://www.rainviewer.com) | radar oborina + animacija | ne treba |
| [OpenWeatherMap](https://openweathermap.org) | obojeni slojevi karte (temperatura, naoblaka) | `EXPO_PUBLIC_OWM_API_KEY` |
| [CARTO](https://carto.com/attributions) / OpenStreetMap | vektorska GL podloga karte (svijetla i tamna) | ne treba |

**Google Maps ključ ne postoji u projektu.** Karta je od 5.8.2026. na MapLibre
GL s CARTO vektorskom podlogom, pa Google/Apple karte uopće ne sudjeluju —
`GOOGLE_MAPS_API_KEY` i `PROVIDER_GOOGLE` su uklonjeni.

## Postavljanje

```bash
npm install
copy .env.example .env   # pa upiši ključ (opcionalno)
```

`.env` ima jedan jedini unos:

- `EXPO_PUBLIC_OWM_API_KEY` — **opcionalno**; bez njega su OWM čipovi na karti
  sivi s napomenom "Potreban OWM ključ", a Radar oborina, sloj vjetra i cijela
  ostala aplikacija rade normalno.

## Pokretanje

Karta je na **MapLibre GL** (nativni modul), pa aplikacija **ne radi u Expo
Go** — treba vlastiti dev build. Nakon što je build jednom instaliran, JS
izmjene idu preko Metroa u sekundi.

**Rebuild treba samo za nativne module I za ikone** (`assets/*.png` se ugrađuju
u build). Font, SVG gradijenti i ambijentalne animacije su JS — vidljive
običnim reloadom.

### iOS — EAS dev build (bez Maca, internal distribution)

```bash
npx eas-cli login                                      # jednokratno (Expo račun)
npx eas-cli device:create                              # jednokratno po uređaju (UDID)
npx eas-cli build --profile development --platform ios # ~15 min u oblaku, pa link
npx expo start --dev-client                            # dev server; otvori app na mobitelu
```

`device:create` na iPhoneu otvara profil za registraciju UDID-a; build nakon
toga stigne kao link/QR za instalaciju. Mobitel i PC moraju biti na istoj
Wi-Fi mreži.

### Android — vlastiti dev build

```bash
npx expo prebuild --platform android   # generira android/ (briše i regenerira!)
npx expo run:android                   # build + instalacija na uređaj/emulator
npx expo start --dev-client            # kasnije, samo JS izmjene
```

### Provjere bez uređaja

```bash
npm run typecheck                    # tsc --noEmit
npm test                             # jest — 243 testa u 23 skupine
npx expo export --platform android   # puni Metro/Babel/NativeWind pipeline
node scripts/generate-icons.mjs      # ikone iz SVG glifa "Zapuh" (traži sharp)
```

Sve tri provjere moraju biti čiste prije commita. **Za vizualne izmjene to
nije dovoljno** — svaki kartografski bug i svaki bug redizajna (hero stisnut na
pola visine, traka sati izvan ruba, pad ekrana na Zagrebu, odrezana velika
brojka) prošao je typecheck, testove i export, a bio vidljiv tek na uređaju.

## Struktura

- `app/_layout.tsx` — Drawer (ladica **zdesna**), sadrži `(screens)` i `map`
- `app/(screens)/` — Stack: `index` (početna, korijen), `search`, `warnings`,
  `pollen`, `preview`, `settings`, `sources`. Swipe-back radi jer je početna
  korijen stacka, a ladica prije navigacije radi `dismissAll`
- `app/map.tsx` — fullscreen karta izvan stacka, s vlastitim kontrolama
- `src/api/` — tipizirani klijenti: `openMeteo`, `dhmz`, `meteoalarm`,
  `meteoalarmEurope`, `rainviewer`, `owm`, `mapLayers`, `windGrid`, `bias` +
  `weather` (spajanje u `WeatherBundle`)
- `src/components/backdrop/` — ambijentalni slojevi po vremenu (sve u
  `react-native-svg`, bez nativnog modula)
- `src/store/` — zustand + AsyncStorage: postavke, gradovi, zadnje vrijeme,
  povijest pretrage, vremenska crta karte
- `src/utils/weatherLook.ts` — izvor istine za izgled: gradijent po vremenu,
  ambijentalni slojevi, akcent, rosište, pelud, boje upozorenja
- `src/i18n/hr.ts` — SVI UI stringovi (kanonski rječnik = izvor tipa za buduće
  jezike)

Tok podataka i redoslijed korekcija temperature su opisani u `CLAUDE.md`
(Architecture) — bitno je da `debias*` ide **prije** korekcije mjerenjem, inače
se ista greška ispravlja dvaput.

## Odluke

1. DHMZ služi samo za **trenutna mjerenja** (`hrvatska_n.xml`); DHMZ-ov feed
   prognoze je pri provjeri (4.8.2026.) posluživao stare podatke, pa sva
   prognoza dolazi s Open-Metea.
2. Glavni model je **ECMWF IFS**, ne `best_match` — izmjereno 0.97 vs 1.83 °C
   promašaja jutarnjih minimuma na 12 mjesta. Pristranost se uči iz istog
   modela koji se prikazuje (`PRIMARY_MODEL`).
3. Korekcija mjerenjem: prosjek **3 DHMZ postaje** u dometu **60 km**,
   udaljenost se kažnjava jednom, prigušenje po dosljednosti. Svaka od tih
   brojki je izmjerena leave-one-out metodom, ne procijenjena.
4. "U Hrvatskoj" = najbliža DHMZ postaja unutar **50 km** (bez geo-poligona).
5. Upozorenja: Hrvatska preko ručne tablice 14 EMMA regija, ostatak Europe
   preko geokodiranja imena regije uz **obavezan filtar države** — Meteoalarm
   ne objavljuje granice ni koordinate regija.
6. Nativni folderi `android/`/`ios/` se **ne commitaju** (Expo CNG; `prebuild`
   ih regenerira). Isto i `docs/` — zapisi odluka su radni materijal, opće
   odluke žive u `CLAUDE.md`.
7. **SDK 57** (od 7.8.2026.) — projekt je izvorno bio na 54 zbog Expo Goa. To
   je otpalo 5.8. s MapLibreom (aplikacija u Expo Gou ionako više ne radi), a
   upgrade je izveden da se otvori `expo-widgets` za iOS widget. Zapreke su
   bile male i sve su opisane u `CLAUDE.md` (Recent Decisions): jedan uvoz iz
   `@react-navigation`, dva plugina u config, `types` u tsconfigu i jedno
   jest mapiranje.
8. **Karta na MapLibre GL** — jedna živa karta za sve slojeve, vremenske
   pločice kao raster slojevi umetnuti `beforeId` da imena gradova ostanu iznad
   boja. Animacija ide izmjenom `raster-opacity` na montiranim susjednim
   okvirima; `tiles` se na živom izvoru ne mijenja (native ga čita samo pri
   stvaranju).
9. **Vjetar je vlastiti sloj**, ne OWM pločica: crtice iz Open-Meteo mreže koje
   klize animacijom `line-dasharray`. Besplatni `wind_new` je polje boja bez
   smjera, a strelice u besplatnom OWM-u ne postoje.
10. Open-Meteo ima **satnu kvotu** (~600/h) — probijena testiranjem mreže
    vjetra. Zato duži `staleTime`, grublje zaokruživanje kadra i vidljiva
    poruka umjesto mrtvih kontrola.
11. Ambijentalne animacije: `useNativeDriver: true` uvijek, elementi u
    **skupinama** koje dijele jednu petlju (po element = 31 sloj na suncu),
    platno s izračunatom bočnom rezervom.
12. Jedinice se pretvaraju lokalno iz metričkih (jedna keširana reprezentacija).
13. Testovi samo za čistu logiku (parseri, mapiranja, formatiranje, izgled) —
    bez UI snapshot testova.
14. `burin:last-weather` (zustand persist) čuva zadnji `WeatherBundle` po
    mjestu — offline prikaz i buduća pohrana za widget. `hourlyAll` se **ne**
    piše na disk (~69 kB po gradu je zabijao JS thread).
15. Hrvatsko obrazloženje lokacije na Androidu prikazuje se **u aplikaciji**
    (Android nema string dozvole na razini manifesta); iOS ga dobiva kroz
    expo-location plugin.

## Što radi

- **Početna:** hero s gradijentom po vremenu i dobu dana + animirana ambijentalna
  pozadina (sunce, kiša, snijeg, oblaci, magla, grmljavina), velika temperatura,
  osjet, dnevni maksimum, traka upozorenja, 24 h po satima s oborinama, bento
  kartice (osjet + more, vjetar, vlaga/rosište, tlak, UV, vidljivost, AQI,
  pelud), izlazak→zalazak sunca, 14 dana s razdobljima dana i detaljima
- **Upozorenja:** Meteoalarm za 38 europskih zemalja, traka u heroju + ekran
  s punim opisom
- **Pelud:** bento kartica + podstranica sa svim vrstama (CAMS model)
- **Karta:** animirani radar (player + klizač), vlastiti sloj vjetra, OWM
  temperatura i naoblaka uz ključ, vremenska crta zajednička svim slojevima
- **DHMZ** "Mjerenja u blizini" kad je najbliža postaja ≤ 50 km
- Traženje gradova (hrvatska mjesta prva), MRU spremljeni gradovi, povijest
  pretrage, ladica zdesna
- Moja lokacija (foreground, balanced) ili rad potpuno bez dozvole
- Svijetla/tamna/sustavna tema (zadana svijetla), °C/°F, km/h / m/s
- Offline: zadnji podaci s oznakom "Podaci od HH:mm"
- **Razvojni ekran** Postavke → *Pregled pozadina po vremenu* — svih 15
  kombinacija vremena s pravim `HeroBackdrop`-om (snijeg i magla se u kolovozu
  ne mogu vidjeti drugačije)

## Sljedeći koraci (v1.1)

- **iOS widget** (`expo-widgets`) — layout u TypeScriptu preko
  `@expo/ui/swift-ui`, bez Swifta. Samo gradijent po vremenu (ta knjižnica
  nema crtaće primitive), veličine `systemSmall`/`systemMedium` + lock
  screen. Podaci iz `burin:last-weather` preko `updateTimeline()`
- Android widget (react-native-android-widget) — nakon iOS-a; čita istu
  pohranu, ali RemoteViews ne može nacrtati vjetrulju (nema SVG-a)
- Preuređivanje spremljenih gradova povlačenjem
- Dodatni jezici — engleski je gotov, `src/i18n` prima nove kao objekt
  tipa `Dict`
- Gušći izvor mjerenja za zaleđe (Polača: postaje su sve pretople, korekcija
  grije mjesto na 122 m)
- Korekcija dnevnih min/max (`debiasDaily` radi, ali se mjerenje ne primjenjuje
  na dnevne vrijednosti)
- Vremenske vijesti — DHMZ ima feed, za svijet treba izvor
- Web kamere — čeka izvor s API-jem (whatsupcams je komercijalni, scraping ne
  dolazi u obzir)
