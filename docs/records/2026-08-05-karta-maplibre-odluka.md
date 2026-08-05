# Karta: prelazak s react-native-maps na MapLibre

**Datum:** 5.8.2026.
**Status:** Implementirano (isti dan) — čeka provjeru na uređaju

## Problem

Karta na `react-native-maps` radi, ali ostaju tri stvari koje se unutar te
biblioteke ne mogu riješiti:

1. **Zoom.** Granica se mora tvrdo ograničiti po sloju (radar 9, OWM 12) jer
   `UrlTile` iznad razine podataka traži nepostojeću pločicu i izvor javi
   "zoom level not supported".
2. **Pločice nestaju pri približavanju.** `UrlTile` pri overzoomu skriva
   pločicu pa je ponovno učitava; `maximumZ` gasi cijeli sloj.
3. **Strelice vjetra su nemoguće.** Besplatni OWM `wind_new` je polje boja.
   Vlastite strelice bi značile stotine nativnih `Marker`-a — neupotrebljivo.

Uz to je cijeli ekran opterećen zaobilaznicama: `key` remount po sloju (inače
Android crash), kamera u ref-u da preživi remount, `PROVIDER_GOOGLE` obavezan,
`GOOGLE_MAPS_API_KEY` potreban.

## Odluka

Prijeći na `@maplibre/maplibre-react-native` (11.3.6 — provjereno da izričito
podržava Expo ≥54, RN ≥0.80).

MapLibre GL renderira piramidu pločica na GPU-u: pri overzoomu **glatko
rasteže roditeljsku pločicu i drži je na ekranu** dok se nova učitava. Podaci
radara i dalje staju na z=8 (činjenica izvora), ali slika se samo skalira —
nema poruke o zoomu, nema nestajanja, nema granice po sloju.

Slojevi postaju dio stila, pa otpada `key` remount i sve što ga prati.

Strelice vjetra postaju izvedive kao **symbol sloj iz Open-Meteo mreže
točaka** (besplatno) — stotine rotiranih ikona su na GPU-u trivijalne.

Provjereni besplatni vektorski stilovi (bez ključa, 93 sloja, glyphs
uključeni): `basemaps.cartocdn.com/gl/voyager-gl-style/style.json` i
`dark-matter-gl-style` za naoblaku/vjetar.

## Cijena

MapLibre je nativni modul i **nije u Expo Go**. Dosad je Expo Go bio jedini
način testiranja na iPhoneu bez Maca (razlog zbog kojeg je projekt na SDK 54).

Riješeno: Marko ima **osobnu** Apple Developer licencu i jedini je developer,
pa iOS ide na **EAS dev build s internal distribution** — `eas device:create`
(registracija UDID-a) + `eas build --profile development --platform ios`,
instalacija preko linka. Bez TestFlighta, bez recenzije, bez uploada; nitko
drugi ne vidi ništa.

Ritam rada se ne mijenja bitno: nativni rebuild (~15 min u oblaku) treba samo
pri promjeni nativnog sloja. JS izmjene i dalje idu preko Metroa u sekundi.

## Odbačeno

**Flutter.** Razmotreno jer bi `flutter_map` (čisti Dart renderer) uklonio
4 od 6 naših kartografskih bugova iz istih razloga kao MapLibre. Odbačeno:
prepisivanje cijele aplikacije (132 testa, izmjerena logika korekcija, i18n,
svi ekrani) da bi se izbjegli bugovi koji su **već riješeni i dokumentirani**,
a Flutter uz to nema ekvivalent Expo Go-a. Ostali problemi (RainViewer zoom,
OWM alfa, strelice, yr.no pokrivenost) su u **izvorima pločica** i identični
su u svakom frameworku.

**Zadržati react-native-maps za iOS kao fallback.** Značilo bi dva ekrana
karte i svaki bug lovljen dvaput.

## Opseg

`react-native-maps` koriste samo dvije datoteke:

```
app/map.tsx
src/components/RadarPreviewCard.tsx
```

`MAP_LAYERS` (`src/api/mapLayers.ts`) i `MapTimeline` su namjerno građeni da
prežive zamjenu — mijenja se način renderiranja, ne struktura slojeva ni
vremenske crte.

## Redoslijed

1. ~~Migracija karte na MapLibre~~ — **napravljeno 5.8.2026.**
2. Provjera na uređaju (svi dosadašnji bugovi karte bili su vidljivi **tek**
   na uređaju, ne kroz typecheck/test/export)
3. Strelice vjetra kao vlastiti sloj iz Open-Metea

## Implementacijske bilješke (izmjereno 5.8.2026.)

- **`tiles` na živom `RasterSource` ne radi ništa** — u nativnom kodu
  (`MLRNSource.kt`) se `tiles` čita samo u `makeSource()` pri dodavanju
  izvora. `paint` se primjenjuje odmah (`setReactStyle` → `addStyles()`).
  Zato animacija/klizanje ide izmjenom `raster-opacity`: montiran je aktivni
  korak + susjedi s prozirnošću 0 (predučitavanje, GL inačica starog
  0.01-trika), `key`/`id` po URL-u pa se vidljivi izvor nikad ne remonta.
- **`beforeId: "boundary_country_outline"`** — izmjereno da postoji u OBA
  CARTO GL stila (voyager idx 65/93, dark-matter 64/93) kao početak bloka
  granice+imena. Vremenske boje su iznad terena i cesta, a imena gradova
  iznad boja.
- **CARTO GL stilovi bez ključa potvrđeni**: voyager 107 kB / dark-matter
  70 kB, oba 200, 93 sloja, glyphs i sprite uključeni.
- **peerDependencies 11.3.6**: `expo >=54.0.0`, `react-native >=0.80.0`,
  `react >=19.1.0` — sve zadovoljeno bez dizanja SDK-a. v11 traži New
  Architecture (SDK 54 default, projekt je ne gasi).
- `MapLayer.maxZoom` obrisan; kamera ima globalne granice
  (`MAP_MIN_ZOOM = 4`, `MAP_MAX_ZOOM = 12` u `mapLayers.ts`).
- `react-native-maps`, `PROVIDER_GOOGLE` i `GOOGLE_MAPS_API_KEY` uklonjeni
  iz projekta (package.json, app.config.ts, .env.example, README).
- Pregled radara na početnoj: `androidView="texture"` — GLSurfaceView u
  scroll listi na Androidu ima z-order artefakte, TextureView nema.
