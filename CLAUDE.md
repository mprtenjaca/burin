@AGENTS.md

# Burin — status projekta

Minimalistička vremenska aplikacija za Hrvatsku. Expo SDK 54 (namjerno, radi
Expo Go i iOS-a bez Maca), TypeScript strict, Expo Router + Drawer, NativeWind,
zustand + AsyncStorage, react-query.

## Current Status

| Što | Status | Bilješka |
|---|---|---|
| Referentni model za bias | Done | Učio `best_match`, prikazivao ECMWF. Odmak od V&R 2.66 → 2.40 °C na 13 mjesta, od termometra 2.97 → 2.36 °C |
| Noćna pretoplost modela | Done | Ukinuto dvostruko kažnjavanje udaljenosti u `observationDelta` + domet 40 → 60 km. Leave-one-out na 29 postaja: 2.37 → **1.99 °C**; prema V&R 2.56 → 2.40 °C |
| Polača tip (zaleđe uz morsku postaju) | Open | Jedina žrtva popravka (4.7 → 5.5 °C). Postaje su Šibenik/Veli Rat/Knin — sve pretople, pa korekcija **grije** mjesto na 122 m. Zemunika (21 °C, 12 km) nema u feedu; gušćeg DHMZ feeda nema |
| 14-dnevni min/max korekcija | Open | `debiasDaily` radi, ali korekcija mjerenjem se ne primjenjuje na dnevne vrijednosti — mogući blagi nesklad s razdobljima dana |
| Vremenska upozorenja (Meteoalarm) | Open | "Upozorenja" postoji u rječniku, ekran nije napravljen |
| Android widget | Open | v1.1; `burin:last-weather` (zustand persist) je pripremljen kao pohrana |

## Next Step

Temperatura je sređena koliko se s postojećim podacima može: odmak od
termometra 2.58 (bez korekcije) → 1.99 °C, od V&R 2.56 → 2.40 °C. Sljedeće je
**dizajn** (v1.1: Meteoalarm, widget).

Ako se temperatura još dira: jedino što ostaje je **gušći izvor mjerenja**.
Izmjereno je da se štimanjem težina više ne dobiva (visina i manji domet su
*gori*), a Polača se bez podatka iz Ravnih kotara ne može riješiti.

Metodološka pouka: mjeriti protiv **termometra**, ne protiv V&R-a. Zatvoreni
bug je postojao 3 commita i bio nevidljiv jer je slučajno približavao V&R-u na
Starigradu, dok je štetio na 12 drugih mjesta.

## Recent Decisions

| Odluka | Zašto |
|---|---|
| `PRIMARY_MODEL` se izvozi iz `openMeteo` i dijeli s `bias` | Bias se MORA učiti iz modela koji se prikazuje. Dok su bili razdvojeni, učio se `best_match` a prikazivao ECMWF: odmak 2.66 vs 2.40 °C, pogrešan predznak u Lici i Istri |
| Mjeriti protiv termometra, ne protiv Vrijeme&Radara | Bug je 3 commita bio nevidljiv jer je slučajno približavao V&R-u na Starigradu, dok je štetio na 12 drugih mjesta |
| Udaljenost kažnjavati JEDNOM u `observationDelta` | Množenje prosjeka s `bestCloseness` je puštalo ~30 % stvarne razlike. Leave-one-out: 1.99 vs 2.37 °C. Arhiva noćnu grešku ne vidi (Polača: nauči +0.14 uz stvarnih +4 °C) |
| Domet korekcije 60 km, ne 40 | DHMZ u međuterminima objavi ~29 postaja; na 40 km je pola zemlje bez korekcije. Izmjereno 1.99 vs 2.09 °C |
| Ne vagati postaje po nadmorskoj visini | Izmjereno leave-one-out na 29 postaja: svaka skala (100–500 m) je gora (2.46–2.49 vs 2.44 °C) |
| Ne smanjivati domet korekcije (15–25 km) | Izmjereno gore (2.50–2.63 vs 2.44 °C) — s ~29 postaja ostane se bez ijedne reference |
| Ne tražiti prognozu s kopnene točke za obalna mjesta | Izmjereno: 5 km u kopno od Starigrada = 623 m n.v. i 20.9 °C — vrijeme Velebita, ne mjesta. Blage kopnene točke tamo nema |
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
