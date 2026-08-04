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
| [OpenWeatherMap](https://openweathermap.org) | dodatni slojevi karte (temperatura, naoblaka, vjetar, oborine) | `EXPO_PUBLIC_OWM_API_KEY` |
| Google Maps | podloga karte na Androidu | `GOOGLE_MAPS_API_KEY` |

## Postavljanje

```bash
npm install
copy .env.example .env   # pa upiši ključeve
```

`.env`:

- `GOOGLE_MAPS_API_KEY` — Google Maps Android SDK ključ, potreban samo za
  **vlastiti Android dev build**. Bez njega je tamo ekran karte neupotrebljiv:
  podloga je prazna, a zbog poznatog ponašanja react-native-maps (#5156) ne
  prikazuju se ni radarske pločice. U Expo Go i na iOS-u (Apple Maps) ne treba;
  ostatak aplikacije radi normalno.
- `EXPO_PUBLIC_OWM_API_KEY` — opcionalno; bez njega su OWM slojevi na karti
  jednostavno skriveni (ostaje samo Radar).

## Pokretanje

Projekt je na **Expo SDK 54** — namjerno, da radi u **Expo Go** aplikaciji
(iOS bez Maca i bez Apple Developer računa).

### iOS / brzo testiranje — Expo Go

```bash
npx expo start
```

Skeniraj QR kamerom (iOS) ili iz Expo Go aplikacije (Android). Mobitel i PC
moraju biti na istoj Wi-Fi mreži. U Expo Go karta na iOS-u koristi Apple Maps
podlogu, pa `GOOGLE_MAPS_API_KEY` tamo nije potreban.

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
6. Pregled radara na početnoj je običan `MapView` bez gesti (NE `liteMode` —
   Google lite mode ne podržava tile overlaye).
7. Jedinice se pretvaraju lokalno iz metričkih (jedna keširana reprezentacija).
8. Testovi samo za čistu logiku (parseri, mapiranja, formatiranje) — bez UI
   snapshot testova.
9. `burin:last-weather` (zustand persist) čuva zadnji `WeatherBundle` po
   mjestu — offline prikaz ("Podaci od HH:mm") i buduća pohrana za widget.
10. Hrvatsko obrazloženje lokacije na Androidu prikazuje se **u aplikaciji**
    (Android nema string dozvole na razini manifesta); iOS ga dobiva kroz
    expo-location plugin.
11. Animacija radara: montirane dvije `UrlTile` (aktivna 0.7 + sljedeća 0.01
    za predučitavanje), nikad zamjena `urlTemplate` na živom sloju (treperenje
    na Androidu).
12. **SDK 54, ne 57** — svjesno spušteno da projekt radi u Expo Go aplikaciji,
    jer se iOS build na Windowsima ne može napraviti lokalno (treba macOS/Xcode),
    a Expo Go podržava SDK 54. Sve funkcionalnosti su ostale iste.

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

- Radar karta u vlastitom **Android** dev buildu → `GOOGLE_MAPS_API_KEY`
  (u Expo Go i na iOS-u nije potreban)
- Slojevi Temperatura/Naoblaka/Vjetar/Oborine → `EXPO_PUBLIC_OWM_API_KEY`

## Sljedeći koraci (v1.1)

- Android widget (react-native-android-widget) — čita postojeću pohranu
  `burin:last-weather`
- Preuređivanje spremljenih gradova povlačenjem
- DHMZ upozorenja (Meteoalarm feed)
- Dodatni jezici — `src/i18n` je već strukturiran (novi jezik = novi objekt
  tipa `Dict`)
