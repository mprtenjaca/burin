# Karta: bazna podloga, slojevi i dijeljena vremenska crta

**Datum:** 5.8.2026.
**Status:** Odobreno za implementaciju

## Cilj

Ekran karte mora izgledati kao referenca (Vrijeme&Radar / WetterOnline):
obojeni slojevi preko **cijele** karte, ne samo mrlje oborina, s vremenskom
crtom koja je prisutna na **svakom** sloju.

## Izmjereno prije dizajna (5.8.2026.)

| Provjera | Rezultat |
|---|---|
| CartoDB Voyager pločice bez ključa | 200, 6.0 kB PNG |
| OpenTopoMap / OSM / Esri | svi 200 (rezervne opcije) |
| **Open-Meteo tile endpoint** | **404 — ne postoji** |
| MET Norway (yr.no) javne pločice | 403 / 503 — nedostupno |
| OWM ključ iz `.env` | 32 znaka, sva 4 sloja vraćaju PNG |
| OWM pločice na z=11,12,14 | **200** (rade iznad 10) |
| RainViewer na z=11,12 | **200** (radi iznad 10) |
| RainViewer okviri sada | 11 prošlih, **0 nowcast** |

**Ključna posljedica:** Open-Meteo ne servira karte, samo JSON po točki.
Za obojene slojeve preko cijele površine nema alternative OWM-u; Open-Meteo
služi kao izvor podataka za vremensku crtu. yr.no efekti su njihov vlastiti
WebGL rendering iz GRIB-a — ne preuzimaju se kao pločice.

## Odluke

### 1. Bazna podloga: CartoDB Voyager, `mapType="none"`, obje platforme

Identičan izgled na iOS-u i Androidu je tvrdi zahtjev, a to je moguće samo
ako se ne koristi nijedna nativna podloga. `MAP_BASE_TILE_URL` kao konstanta
za zamjenu.

**Nusprodukt:** `GOOGLE_MAPS_API_KEY` prestaje biti potreban za kartu —
rješava problem iz README-a ("bez ključa je ekran karte neupotrebljiv na
Androidu", react-native-maps #5156).

**Cijena:** nema Google/Apple oznaka gradova ispod; imena gradova dolaze iz
baznih pločica (Voyager ih ima).

### 2. `MAP_LAYERS` — jedan tipizirani izvor istine

```ts
type MapLayer = {
  id: MapLayerId;              // "radar" | "temp_new" | "clouds_new" | "wind_new"
  label: string;               // hrvatski, iz i18n
  needsKey: boolean;           // OWM slojevi true
  opacity: number;
  maxNativeZ: number;
  attribution: { label: string; url: string };
  timeline: "frames" | "hours"; // odakle crta uzima korake
};
```

Zamjenjuje `owmTileSource` switch. Dodavanje sloja = jedan unos u nizu.
Radar koristi `color=4` (gladak prijelaz, ne piksele).

### 3. Vremenska crta: `MapTimeline` + zustand, na svim slojevima

Stanje izvan ekrana (`useMapTimeline`) da prebacivanje čipa **ne resetira**
crtu. Dva načina koraka:

- **Radar** (`timeline: "frames"`): RainViewer okviri, play animira.
  Oznaka "prognoza" samo kad nowcast okviri postoje (sada ih je 0).
- **Temperatura / Naoblaka / Vjetar** (`timeline: "hours"`): sati iz
  Open-Meteo prognoze za **centar karte**, −24 h … +48 h. Klizanje mijenja
  sat **i prikazuje vrijednost za centar** (npr. `14:00 — 31°`).

Pločica na OWM slojevima ostaje trenutna (besplatni sloj ne nosi vrijeme) i
to je izričito označeno. Bez brojke bi kontrola bila mrtva na 3 od 4 sloja.

`"Sada"` za tekući korak (referenca kaže "Live"), hrvatski 24-satni format,
play/pauza uvijek desno, crta uvijek na istom mjestu na dnu.

### 4. Kamera, pin, pamćenje sloja

Regionalni zoom (`latitudeDelta ≈ 1.2`, ~zoom 8: Zadar + okolica i obala u
kadru). Pin na odabranom mjestu. "Locate me" vraća na isti zoom. Zadnji
korišteni sloj se pamti kroz sesiju.

Prebacivanje čipa mijenja **samo** pločice sloja — podloga, kamera, pin i
stanje crte ostaju.

### 5. Bez OWM ključa

Tri OWM čipa sivi + napomena "Potreban OWM ključ"; Radar radi normalno.
Aplikacija je u cijelosti upotrebljiva bez ključa.

## Odstupanja od zadanog opisa (s razlogom)

**`.env.example` se ne kreira** — već postoji s oba ključa. Dopisuje se
napomena da Google ključ više nije nužan za kartu.

**`maxZoomLevel` se diže s 10.** Izmjereno je da OWM (z=14) i RainViewer
(z=12) vraćaju pločice iznad 10, pa je granica nepotrebno stroga i drži
kartu mutnijom. CLAUDE.md navodi `maximumZ = maximumNativeZ (10)` kao odluku
zbog "zoom level not supported" — provjeriti na uređaju; ako pukne, vratiti.
`maximumNativeZ` ostaje 10 (iznad se rasteruše), što je i bila svrha te
odluke.

## Rizik iz povijesti projekta

CLAUDE.md: *"prebacivanje UrlTile unutar iste karte ruši Android"* — zato
`key` po sloju na `MapView`. Ta se zaštita **zadržava**: bazna pločica i
sloj su odvojeni `UrlTile`-ovi, pa se pri prebacivanju rekreira karta.
Provjeriti da rekreacija ne resetira kameru (ako resetira, kamera se čuva u
stanju i vraća na `onMapReady`).

## Datoteke

```
src/api/mapLayers.ts        NOVO   MAP_LAYERS + builderi URL-ova
src/store/mapTimeline.ts    NOVO   dijeljeno stanje crte + zadnji sloj
src/components/MapTimeline.tsx NOVO  zamjenjuje TimelinePlayer na karti
src/hooks/useTimelineHours.ts NOVO  sati iz Open-Metea za centar
app/map.tsx                 IZMJENA podloga, MAP_LAYERS, pin, kamera
src/components/LayerChips.tsx IZMJENA sivi čipovi + napomena
src/api/owm.ts              IZMJENA logika seli u mapLayers
src/i18n/hr.ts              IZMJENA novi stringovi
.env.example                IZMJENA napomena o Google ključu
```

## Provjera

`npm run typecheck` + `npm test` + `npx expo export --platform android`
moraju biti čisti. Slojevi se vizualno provjeravaju (ključ radi).
