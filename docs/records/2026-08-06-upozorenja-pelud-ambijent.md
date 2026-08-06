# Upozorenja, pelud, ambijentalne pozadine i preslagivanje navigacije

**Datum:** 6.8.2026. (druga sesija istog dana)
**Status:** Implementirano — dio provjeren na uređaju, dio čeka
**Spec:** [2026-08-06-upozorenja-pelud-ladica-karta-design.md](../superpowers/specs/2026-08-06-upozorenja-pelud-ladica-karta-design.md)

## Što je napravljeno

1. **Meteoalarm upozorenja** — traka u heroju + ekran `/warnings`,
   prošireno s Hrvatske na **38 europskih zemalja**
2. **Pelud** — bento kartica + podstranica `/pollen` sa svim vrstama
3. **Ambijentalne pozadine po vremenu** — 6 animiranih slojeva
4. **Navigacija** — pravi Stack, swipe-back, MRU gradovi, povijest pretrage
5. **Ladica** — gradijentno zaglavlje s ambijentom, grupa KARTE, wordmark
6. **Karta u novi jezik** — okomite ikone slojeva, tamne kontrole, fullscreen
7. **Logo "Zapuh"** — novi glif, ikone regenerirane

## Ključne odluke i mjerenja

| Odluka | Zašto |
|---|---|
| Meteoalarm JSON API, ne Atom | JSON nosi hrvatski DHMZ tekst inline; Atom bi tražio zaseban CAP dohvat po upozorenju |
| Hrvatska = ručna tablica, Europa = geokodiranje | Meteoalarm NE objavljuje granice ni koordinate regija (`area` ima samo `areaDesc` + EMMA ID). Regija po zemlji: Italija 19, Austrija 116, **Njemačka 409** — ručna tablica neizvediva |
| Filtar države pri geokodiranju je obavezan | Izmjereno: "Velebit channel" bez njega geokodira u **Velebit u Srbiji** |
| `cleanRegionName` prije geokodiranja | Izmjereno: "Kreis Goslar" ne pogađa, "Goslar" pogađa; "Gospic region" → "Gospic" |
| Granica dometa regije 130 km | Bug s uređaja: grad u **Čileu** je prikazivao crveni meteoalarm za HR, jer je "najbliže sidro" uvijek nešto vraćalo |
| `hourlyAll` se NE piše na disk | Izmjereno ~69 kB po gradu; sa 6 gradova **413 kB → 35 kB** serijalizacije na JS threadu pri svakoj promjeni mjesta. Bio glavni uzrok "visećeg" dodira |
| Skeleton i za keširane gradove | Grad s kešem ima `isLoading: false`, pa je React sinkrono crtao cijeli ekran — odatle "dulje i bez skeletona" |
| Sadržaj ispod pregiba tek u sljedećem kadru | Bento + 14 dana + MapLibre pregled su najskuplji; hero ih je čekao iako se vidi prvi |
| Animirani elementi u SKUPINAMA | Sunce je montiralo 31 sloj s 31 petljom, snijeg 26 sa 52 — sve pri prebacivanju grada. Sada 7 i 5 |
| `pressed` stil preko vlastitog stanja | NativeWind pretvara `className` u `style` i **prepisuje** `style={({pressed}) => …}` — zato dodir nije davao odziv |
| Zrake se NE pomiču na suncu | Kad se kose crte kližu, oko ih čita kao oborinu. Sunce zato dobiva mirnu geometriju + promjenu svjetline |

## Bugovi nađeni na uređaju (i uzroci)

- **Velika brojka odrezana slijeva** — `letterSpacing: -6` steže glifove uz
  rub okvira teksta. Stezanje `lineHeight` na visinu znamenki (97) je
  odsjeklo donju polovicu; okvir mora ostati prostran (134)
- **Magla: kvadrat na sredini** — `width="100%"` u SVG-u bez `viewBox` se
  na uređaju razriješi u kvadrat. Izričite dimenzije rješavaju
- **Rezovi na rubovima** (magla, oblaci, kiša) — svi isti uzrok: platno
  bez bočne rezerve. Izmjereni dosezi: magla −295…759 px na platnu 390
- **Kiša presušivala u ladici** — rezerva je bila vezana uz visinu
  (1.3 × H), a ambijentalni pomak je fiksnih 464 px. Hero (1097 rezerve)
  prolazi, zaglavlje ladice (260) ne
- **Zvjezdice "skakale"** — `scale` na sloju preko cijelog ekrana skalira
  oko SREDIŠTA EKRANA, pa točke daleko od centra putuju prema njemu
- **Swipe iz Postavki vodio u Upozorenja** — stack je gomilao povijest
  podekrana; ladica sada radi `dismissAll` prije navigacije
- **Sat zamrznut** — `new Date()` se čita samo pri renderu; `useNow`
  otkucava poravnato na punu minutu

## Izmjereno o izvorima

- Meteoalarm pokriva **38 od 40** provjerenih europskih zemalja (nemaju
  Albanija i Sj. Makedonija). Ostatak svijeta uopće ne pokriva
- Pelud dolazi iz istog Open-Meteo air-quality upita kao AQI — **nula**
  novih poziva. CAMS je model, ne mjerenje (napomena u Izvorima)
- RainViewer trenutno vraća **0 nowcast okvira** (provjereno 3×), pa
  radar nema budućnost — play zato vrti prošlost

## Ostalo za uređaj

Razmaci oko velike brojke u heroju (`marginBottom` na imenu mjesta,
`marginTop` na opisu) — Marko ih fino štima; izmjereno da okvir nosi
38.8 px praznine gore i 36.3 dolje.
