# Burin

Minimalistička vremenska aplikacija za Hrvatsku — React Native + Expo SDK 54.
Velika brojka, puno bjeline, jedna mint boja. Bez šarenila — jedina "šarena"
površina je radar na karti.

## Izvori podataka

| Izvor | Za što | Ključ |
|---|---|---|
| [DHMZ](https://meteo.hr) | trenutna mjerenja najbliže postaje (`hrvatska_n.xml`) | ne treba |
| [Open-Meteo](https://open-meteo.com) | prognoza (16 dana, po satima), geokodiranje, kvaliteta zraka | ne treba |
| [RainViewer](https://www.rainviewer.com) | radar oborina + animacija (prošla 2 h + nowcast) | ne treba |
| [OpenWeatherMap](https://openweathermap.org) | obojeni slojevi karte (temperatura, naoblaka, vjetar) | `EXPO_PUBLIC_OWM_API_KEY` |
| [CARTO](https://carto.com/attributions) / OpenStreetMap | vektorska GL podloga karte (svijetla; tamna za naoblaku i vjetar) | ne treba |

## Postavljanje

```bash
npm install
copy .env.example .env   # pa upiši ključeve
```

`.env`:

- `EXPO_PUBLIC_OWM_API_KEY` — opcionalno; bez njega su OWM slojevi
  (Temperatura / Naoblaka / Vjetar) sivi s napomenom "Potreban OWM ključ", a
  Radar oborina radi normalno.

Google Maps ključ **više ne treba**: karta je na MapLibre GL s CARTO
vektorskom podlogom (bez ključa), pa Google/Apple karte uopće ne sudjeluju.

## Pokretanje

Karta je na **MapLibre GL** (nativni modul), pa aplikacija **ne radi u Expo
Go** — treba vlastiti dev build. Nakon što je build jednom instaliran, JS
izmjene idu preko Metroa u sekundi (`npx expo start`).

### iOS — EAS dev build (bez Maca, internal distribution)

```bash
npx eas-cli login                                      # jednokratno (Expo račun)
npx eas-cli device:create                              # jednokratno po uređaju (UDID)
npx eas-cli build --profile development --platform ios # ~15 min u oblaku, pa link
npx expo start                                         # dev server; otvori app na mobitelu
```

`device:create` na iPhoneu otvara profil za registraciju UDID-a; build nakon
toga stigne kao link/QR za instalaciju. Mobitel i PC moraju biti na istoj
Wi-Fi mreži. Novi nativni build treba samo pri dodavanju nativnih modula.

### Android — vlastiti dev build (puni nativni moduli)

```bash
npx expo prebuild --platform android   # generira android/ (briše i regenerira!)
npx expo run:android                   # build + instalacija na uređaj/emulator
npx expo start --dev-client            # kasnije, samo JS izmjene
```

Provjere bez uređaja:

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest (parseri, mapiranja, formatiranje)
npx expo export --platform android   # puni Metro/Babel/NativeWind pipeline
```

## Struktura

- `app/` — ekrani (Expo Router, Drawer): početna, karta, traženje, postavke, izvori
- `src/api/` — tipizirani klijenti: `openMeteo`, `dhmz`, `rainviewer`, `owm` + `weather` (spajanje u `WeatherBundle`)
- `src/store/` — zustand + AsyncStorage: postavke, gradovi, zadnji podaci
- `src/i18n/hr.ts` — SVI UI stringovi (kanonski rječnik = izvor tipa za buduće jezike)
- `src/utils/` — WMO kodovi → hrvatski nazivi + ikone, formatiranje, haversine

## Odluke

1. DHMZ služi samo za **trenutna mjerenja** (`hrvatska_n.xml`); DHMZ-ov feed
   prognoze je pri provjeri (4.8.2026.) posluživao stare podatke, pa sva
   prognoza dolazi s Open-Metea.
2. "U Hrvatskoj" = najbliža DHMZ postaja unutar **50 km** (bez geo-poligona).
3. Nativni folderi `android/`/`ios/` se **ne commitaju** (Expo CNG; `prebuild`
   ih regenerira).
4. Google Maps ključ se čita iz `.env` kroz dinamički `app.config.ts`.
5. `Izvori podataka` je vlastita ruta (`app/sources.tsx`) — 1:1 sa stavkom u
   ladici; povezana i iz Postavki.
6. Pregled radara na početnoj je MapLibre karta bez gesti, s
   `androidView="texture"` (GLSurfaceView u scroll listi na Androidu ima
   z-order artefakte; TextureView nema).
7. Jedinice se pretvaraju lokalno iz metričkih (jedna keširana reprezentacija).
8. Testovi samo za čistu logiku (parseri, mapiranja, formatiranje) — bez UI
   snapshot testova.
9. `burin:last-weather` (zustand persist) čuva zadnji `WeatherBundle` po
   mjestu — offline prikaz ("Podaci od HH:mm") i buduća pohrana za widget.
10. Hrvatsko obrazloženje lokacije na Androidu prikazuje se **u aplikaciji**
    (Android nema string dozvole na razini manifesta); iOS ga dobiva kroz
    expo-location plugin.
11. Animacija radara: montiran aktivni okvir + susjedi s `raster-opacity: 0`
    (predučitavanje), korak samo mijenja prozirnost — vidljivi izvor se nikad
    ne remonta, pa nema treperenja.
12. **SDK 54, ne 57** — izvorno spušteno da projekt radi u Expo Go aplikaciji.
    Od 5.8.2026. Expo Go više nije ograničenje (iOS ide na EAS dev build), ali
    SDK ostaje 54 — dizanje SDK-a je zaseban zahvat, ne dio migracije karte.
13. **Karta na MapLibre GL** (5.8.2026.) — `react-native-maps` zamijenjen s
    `@maplibre/maplibre-react-native`: CARTO vektorska podloga bez ključa,
    glatko rastezanje pločica iznad razine podataka (radar više ne nestaje),
    imena gradova iznad vremenskih boja (`beforeId`), i temelj za vlastite
    strelice vjetra. Google Maps ključ i `PROVIDER_GOOGLE` više ne postoje.
    Animacija radara ide izmjenom `raster-opacity` na montiranim susjednim
    okvirima — `tiles` se na živom izvoru ne mijenja (native ga čita samo
    pri stvaranju), a paint svojstva se primjenjuju odmah.

## Što radi

- Početna: velika temperatura, osjet, noćni minimum, metrike, 24 h po satima
  s mint stupcima oborina, linija izlazak→zalazak sunca, 14 dana s rasponom
  temperatura, detalji (vidljivost, naoblaka, oborine), kvaliteta zraka
- DHMZ "Mjerenja u blizini" kad je najbliža postaja ≤ 50 km
- Karta: animirani radar (player + klizač, "prognoza" oznaka za nowcast),
  OWM slojevi uz ključ, centriranje na moju lokaciju
- Traženje gradova (hrvatski nazivi), spremljeni gradovi, ladica
- Moja lokacija (foreground, balanced) ili rad potpuno bez dozvole
- Svijetla/tamna/sustavna tema, °C/°F, km/h / m/s
- Offline: zadnji podaci s oznakom "Podaci od HH:mm"

## Što treba API ključ

- Slojevi Temperatura/Naoblaka/Vjetar → `EXPO_PUBLIC_OWM_API_KEY`
- Podloga karte i Radar rade bez ijednog ključa

## Sljedeći koraci (v1.1)

- Android widget (react-native-android-widget) — čita postojeću pohranu
  `burin:last-weather`
- Preuređivanje spremljenih gradova povlačenjem
- DHMZ upozorenja (Meteoalarm feed)
- Dodatni jezici — `src/i18n` je već strukturiran (novi jezik = novi objekt
  tipa `Dict`)
