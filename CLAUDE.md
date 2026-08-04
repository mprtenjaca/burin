@AGENTS.md

# Burin — status projekta

Minimalistička vremenska aplikacija za Hrvatsku. Expo SDK 54 (namjerno, radi
Expo Go i iOS-a bez Maca), TypeScript strict, Expo Router + Drawer, NativeWind,
zustand + AsyncStorage, react-query.

## Current Status

| Što | Status | Bilješka |
|---|---|---|
| Jutarnje temperature u zaleđu | In Progress | ECMWF + bias smanjio odmak od V&R s 5.3 na 3.0 °C; u 06–08 h Starigrad je još 3–5 °C previsok (pogrešna ćelija mreže na 6 m) |
| 14-dnevni min/max korekcija | Open | `debiasDaily` radi, ali korekcija mjerenjem se ne primjenjuje na dnevne vrijednosti — mogući blagi nesklad s razdobljima dana |
| Vremenska upozorenja (Meteoalarm) | Open | "Upozorenja" postoji u rječniku, ekran nije napravljen |
| Android widget | Open | v1.1; `burin:last-weather` (zustand persist) je pripremljen kao pohrana |

## Next Step

Odlučiti želi li se za obalna mjesta pod planinom (Starigrad tip) tražiti
prognoza s točke u kopnu ili s najbliže DHMZ postaje. To bi zatvorilo
preostali odmak od 3–5 °C u 06–08 h, ali znači prikazivati vrijeme *drugog
mjesta* — kompromis koji V&R prihvaća (za Starigrad prikazuje Zemunik).
Vidi "Što ostaje otvoreno" u Recordu.

Necommitano na kraju sesije: prelazak na ECMWF + prigušenje po dosljednosti
(`src/api/{openMeteo,bias,weather}.ts`, `src/hooks/useWeatherBundle.ts`,
`src/api/__tests__/mergeForecasts.test.ts`). Sve provjere prolaze.

## Recent Decisions

| Odluka | Zašto |
|---|---|
| ECMWF IFS kao glavni model, ne `best_match` | Izmjereno 0.97 vs 1.83 °C promašaja jutarnjih minimuma na 12 mjesta; najbolji na 8/12 |
| Prigušenje pristranosti po dosljednosti, ne fiksni faktor | Fiksni 0.75 gušio stvarnu dosljednu grešku; puna korekcija pojačava šum (1.86 vs 1.67 °C) |
| Korekcija iz prosjeka 3 DHMZ postaje, ne najbliže | Leave-one-out: 1.73 vs 1.91 °C; jedna nereprezentativna postaja (aerodrom u udolini) ne odlučuje sama |
| Ne učiti pristranost iz DHMZ postaja | Izmjereno da pogoršava — okolne postaje su u drugom reljefu, greška se ne prenosi preko krajolika |
| SDK 54, ne 57 | iOS build se na Windowsu ne može napraviti lokalno; Expo Go podržava 54 |
| Radar: `maximumZ` = `maximumNativeZ` (10), `key` po sloju na MapView | Pločice postoje samo do zoom 10 ("zoom level not supported"); prebacivanje UrlTile unutar iste karte ruši Android |
| Sva mjerenja izmjeriti, ne procijeniti | Više puta je "logična" ideja izmjerena kao pogoršanje (postajno učenje, GFS, puna korekcija) |

## Development

```bash
npm start                 # Expo Go / dev server
npm run typecheck         # tsc --noEmit
npm test                  # jest, 89 testova
npx expo export --platform android   # puni Metro/Babel/NativeWind pipeline
npx expo run:android      # nativni dev build
node scripts/generate-icons.mjs      # ikone iz SVG glifa (traži sharp)
```

Provjera prije commita: `typecheck` + `test` + `expo export` moraju biti čisti.

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
slojevi karte skriveni.

## Files

```
app/                  ekrani (index, map, search, settings, sources)
src/api/              openMeteo, dhmz, rainviewer, owm, bias, weather (spajanje), client, types
src/store/            settings, cities, lastWeather (zustand + AsyncStorage)
src/components/       Hero, HourlyStrip, DailyList, DayDetails, DhmzCard, TimelinePlayer, LayerLegend...
src/utils/            weatherCodes, format, geo, dayParts
src/i18n/hr.ts        SVI UI stringovi (kanonski rječnik = izvor tipa)
docs/records/         zapisi odluka
```
