# Redizajn početnog ekrana: gradijent hero + bento kartice

**Datum:** 6.8.2026.
**Status:** Implementirano — čeka završnu provjeru na uređaju
**Spec:** [2026-08-06-pocetni-ekran-redizajn.md](../superpowers/specs/2026-08-06-pocetni-ekran-redizajn.md)
**Mockupi:** `.superpowers/brainstorm/319-1785967733/content/` (v1 → v7)

## Zašto

Dosadašnji ekran ("velika brojka, puno bjeline, jedna mint boja") bio je
čist, ali u usporedbi s referencama (Vrijeme&Radar, WetterOnline) izgledao
je siromašno: monokromatski, bez karaktera, sitni tekstovi. Marko je donio
referentne slike i tražio "što sličnije, ali sa svime što već imamo".

## Postupak

Dizajn je zaključan kroz **7 iteracija HTML mockupa u browseru** prije
ijedne linije koda. To se isplatilo: font (Space Grotesk umjesto Intera),
uklanjanje rubova s kartica, visina ° na velikoj brojci i raspored heroja
mijenjani su u mockupu, ne u aplikaciji.

## Odluke

| Odluka | Zašto |
|---|---|
| Gradijent heroja prati vrijeme (8 paleta × 2 teme) | Napušta "samo mint" pravilo na heroju; mint ostaje akcent. Bez toga ekran nema karakter reference |
| SVG gradijent (`react-native-svg`), ne `expo-linear-gradient` | Modul je već u buildu od MapLibrea → nema nativnog rebuilda za redizajn |
| Space Grotesk (`@expo-google-fonts`) | Marko izabrao pored Intera i Archiva; jedini font koji na Androidu i iOS-u izgleda isto. Svaka debljina je zaseban file — RN nema sintetički bold |
| Hero = puni viewport, raspored APSOLUTAN | Flex stupac se na uređaju stisnuo na pola ekrana. Visina se mjeri iz `onLayout` ScrollViewa, ne `useWindowDimensions` |
| Kartice bez rubova, bijele na `mist #F1F1EE` | Rubovi su na mockupu ocijenjeni kao "ružni"; ispuna daje dubinu bez linija |
| Akcent "po vremenu" | Koraljna `#EE6E3C` je zadana (instrumenti, oborine, aktivne stavke); na toplim narančastim gradijentima heroja prelazi u čeličnu plavu `#4C8FDF` jer bi se inače utopila |
| Zadana tema svijetla (bila `system`) | Gradijenti su dizajnirani prvo za svijetlu; tamna ostaje izbor u postavkama uz potpuni paritet sadržaja |
| Ladica zdesna | Hamburger je gore desno na heroju — ladica izlazi ispod prsta koji ju je otvorio |
| Podekrani imaju ← natrag, ne hamburger | Ladica je zdesna, pa hamburger slijeva zbunjuje; povratak mora biti očit |
| Hrvatska mjesta prva u tražilici | Geocoding nema filter države; korisniku u Hrvatskoj je istoimeno mjesto na drugom kontinentu šum (`croatiaFirst`, stabilan sort) |
| Kratice + raspon sati u stupcima razdoblja | "Poslijepodne" (12 znakova) fizički ne stane u četvrtinu širine ekrana. Kratica je čak veća, a raspon ("12–17 h") je nov koristan podatak |
| More u kartici Osjeta, ne zasebna | Obalna mjesta ga trebaju vidljivo, kopnena ga uopće nemaju — tada kartica ostaje samo osjet, bez praznine |
| Sve veličine dignute za starije korisnike | Pravilo: ništa sitno ispod 11px, ništa bitno ispod 65 % kontrasta |

## Izmjereno / nađeno na uređaju

- **Traka sati je curila izvan ekrana zdesna**: `left: 20, right: 0` je dao
  padding samo s jedne strane. Uvlaka mora ići u `contentContainerStyle`
  ScrollViewa, ne u pozicioniranje.
- **Zagreb je rušio ekran**: `fetchSeaTemperature` je vraćao `undefined`,
  a react-query to zabranjuje ("Query data cannot be undefined"). Sada
  vraća `null`; `useWeatherBundle` ga pretvara u `undefined` za
  `WeatherBundle`. Test izričito provjerava da nikad ne vrati `undefined`.
- **Chrome auto-prijevod je izmasakrirao mockupe** ("Tlak" → "godina") —
  mockup stranice trebaju `translate="no"`.

## Uklonjeno

`MetricsRow` i `AqiRow` (sadržaj im je preuzeo `BentoGrid`), stara kartica
mora s dna ekrana, mint s cijelog početnog ekrana.

## Ostalo za provjeru na uređaju

Sve je JS — **ne treba rebuild**, samo `npx expo start --dev-client`.
