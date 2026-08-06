# Upozorenja + pelud + ladica + karta u novi jezik

**Datum:** 6.8.2026.
**Status:** Implementirano — čeka provjeru na uređaju
**Referenca:** Vrijeme&Radar (snimke zaslona 6.8.2026.)

## Opseg

Četiri zahvata odjednom, kao četiri odvojena commita (nakon dva već
gotova — MapLibre i redizajn početnog):

1. **Meteoalarm upozorenja** — traka u heroju + ekran `/warnings`
2. **Pelud** — široka bento kartica iz postojećeg Open-Meteo upita
3. **Ladica** — gradijentno zaglavlje + grupa KARTE + stavka Upozorenja
4. **Karta u novi jezik** — čipovi, vremenska crta, legenda: koraljni
   akcent, Space Grotesk, bez minta

**Kamere: ODGOĐENO.** Vrijeme&Radar vuče whatsupcams (komercijalni servis
bez javnog API-ja); scrapeanje tuđeg videa ne dolazi u obzir. Vraća se
kad se nađe čist izvor.

## 1. Meteoalarm

**Izvor (izmjereno 6.8.2026.):**
`feeds.meteoalarm.org/api/v1/warnings/feeds-croatia` — **JSON API**, ne
Atom feed. Presudno: JSON vraća sva upozorenja s **hrvatskim DHMZ tekstom
inline** (`info` blok s `language: hr-HR` — event, description,
instruction), dok Atom nosi samo engleski naslov i tražio bi zaseban CAP
XML dohvat po upozorenju. Jedan upit, 200 bez ključa.

Odgovor uključuje i povijest, pa se filtrira: status `Actual`, `expires`
u budućnosti, a Update istog upozorenja pobjeđuje raniji Alert po `sent`
(inače se isto upozorenje pojavi dvaput).

- `src/api/meteoalarm.ts`: `parseMeteoalarm(raw, now)` (čista, testirana)
  + `fetchMeteoalarmWarnings()` koji na svaku grešku vraća **prazan niz**
  (nikad `undefined` — react-query pravilo). `warningsForPlace` filtrira
  po regijama i sortira najteže prvo.
- `src/utils/emmaRegions.ts`: ručna tablica **14 regija** — 8 kopnenih
  (HR001–HR008) + 6 pomorskih pojaseva (HR801–HR806), svi potvrđeni živim
  feedom. `regionsForPlace(lat, lon)` vraća jednu kopnenu (kutija pa
  najbliže sidro; izvan svih kutija čisto najbliže sidro, pa mjesto nikad
  ne ostane bez regije) + sve pomorske pojaseve u kojima mjesto leži —
  obalna mjesta tako dobiju i upozorenje za vjetar na moru, kopnena ne.
  Čista funkcija, testirana na 14 mjesta (Polača → HR001 + HR804,
  Zagreb → samo HR002).
- Razine: 2 žuto `#F5C518`, 3 narančasto `#F58A2E`, 4 crveno `#E63946`
  (`warningColor` u `weatherLook.ts`). Zeleno (1) se ne prikazuje.
- **Heroj:** `WarningBar` između imena mjesta i velike brojke — zaobljena
  traka u boji razine, ikona (AlertTriangle) + naslov + `+N` kad ih ima
  više; prikazuje se NAJTEŽE. Bez upozorenja trake nema. Dodir → `/warnings`.
- **`/warnings`:** podekran u postojećem jeziku (mist podloga, bijele
  kartice, ← natrag): po upozorenju naslov u boji razine, trajanje,
  DHMZ opis i uputa (hrvatski iz CAP-a).
- Upit: react-query, `staleTime` 15 min, siguran na neuspjeh (nema
  feeda → nema trake, sve ostalo radi).

## 2. Pelud

**Izvor:** postojeći Open-Meteo air-quality upit (AQI) dobiva
6 parametara: `alder_pollen, birch_pollen, grass_pollen, mugwort_pollen,
olive_pollen, ragweed_pollen` (grains/m³). **Nula novih upita.**
Izmjereno 6.8.: Zadar vraća ambrozija 5.3, trava 2.5.

- `pollenInfo()` u `weatherLook.ts`: 6 vrijednosti → ukupna ocjena
  (Nema/Niska/Umjerena/Visoka/Vrlo visoka; pragovi PO VRSTI — ambrozija
  i trave su alergenije, prag im je ~5–8 grains/m³ prema ~10–50 za brezu
  i johu) + sortiran popis aktivnih vrsta s udjelom 0–1 za trakicu.
  Čista funkcija, testira se.
- **Kartica:** široka, ispod kvalitete zraka; ocjena u boji + do 3
  najjače vrste s trakicama. Vrste na nuli se izostavljaju; **sve nula →
  kartice nema** (zimi nema prazne kartice).
- Imena vrsta u `hr.ts` (joha, breza, trava, pelin, maslina, ambrozija).
- `/sources`: napomena da je pelud CAMS **model**, ne mjerenje.

## 3. Ladica

Strana ostaje DESNA. Tri izmjene:

- **Zaglavlje s gradijentom:** blok s `weatherGradient` (isti izvor
  istine kao heroj) odabranog mjesta, ime + velika temperatura + opis,
  ispod tanka koraljna crta. Sve iz `burin:last-weather` — nijedan novi
  upit. Bez pohranjenog vremena: samo naslov "Burin" na mist podlozi.
- **Grupa KARTE:** 4 stavke generirane iz `MAP_LAYERS` (Radar,
  Temperatura, Naoblaka, Vjetar), svaka sa svojom lucide ikonom, otvara
  `/map` odmah na tom sloju (`mapTimeline.setLayer` prije navigacije).
  Slojevi bez OWM ključa prigušeni, kao čipovi.
- **Grupa APLIKACIJA:** dodaje se Upozorenja (`/warnings`).

## 4. Karta u novi jezik

Ekran karte i njegove kontrole prelaze na jezik redizajna — ponašanje
se NE dira (odluke o animaciji, pločicama i izvorima ostaju):

- `LayerChips`: bijele/coal kartice bez rubova, Space Grotesk; aktivni
  čip je **invertiran** (ink/paper), ne koraljni — čipovi lebde nad
  kartom čija podloga varira (svijetla/tamna/plava vjetra), a crno-bijela
  poluga se čita na svima.
- `MapTimeline`: ista podloga kao čipovi, play gumb i klizač koraljni
  umjesto mint, Space Grotesk za sate.
- `LayerLegend` + poruke (timelineUnavailable, retry): koraljni akcent,
  grotesk.
- Spinner na radaru: koraljni umjesto mint.
- Pin ostaje kakav jest (već u novom jeziku).

## Provjera

`typecheck` + `test` + `expo export` čisti; čiste funkcije
(`regionForPlace`, `pollenInfo`, parser feeda, `warningColor`) dobivaju
testove. Vizualno NA UREĐAJU (sve je JS, bez rebuilda). **Bez commita
dok Marko ne kaže.**
