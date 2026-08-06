# Početni ekran: redizajn po referenci (gradijent hero + bento)

**Datum:** 6.8.2026.
**Status:** Odobreno kroz vizualne mockupe (v7), implementacija u tijeku
**Mockupi:** `.superpowers/brainstorm/319-1785967733/content/pocetni-cijeli-v7.html`

## Cilj

Početni ekran u jeziku reference (minimalistički tipografski hero s
gradijentom po vremenu + bento kartice), sa **svim postojećim podacima** —
ništa se ne gubi, samo preslaguje. Karta se ne dira (netom migrirana na
MapLibre), osim pina.

## Odluke (zaključane kroz mockupe)

1. **Boja heroja prati vrijeme** (odustajanje od "samo mint" na heroju; mint
   ostaje akcent): sunčano dan = narančasto-zlatna, kiša = čelično
   plavo-siva, oblačno = siva, vedra noć = indigo. U tamnoj temi isti tonovi,
   tamniji, stapaju se u #0E0E0E umjesto u svijetlu podlogu.
2. **Font: Space Grotesk** (@expo-google-fonts, JS-only, bez rebuilda) —
   korisnik ga izabrao pored Inter/Archivo kao najbliži referenci.
3. **Hero = cijeli prvi ekran** (visina viewporta): datum (2 reda: "Čet 6.
   kol" + vrijeme podataka) gore lijevo, hamburger gore desno, sredina
   `tMax / ↑ / ime mjesta / VELIKA brojka / opis / ↓ / noćni min`, traka po
   satima na dnu prvog ekrana. Dijagonalne svijetle pruge preko gornjeg
   dijela gradijenta (react-native-svg, bez novih nativnih modula).
4. **Znak ° na velikoj brojci:** zaseban Text, ~35 % veličine brojke,
   priljubljen uz nju, vrh mu viri IZNAD gornjeg ruba znamenki (v7 recept:
   na 96px brojci ° je 34px s pomakom koji ga diže iznad vrha).
5. **Traka po satima:** bez kartice i bez razdjelnih linija — kolone
   `temp / lucide ikona / HH:00`, horizontalni scroll (24 h), oborine kao
   dosad (mint), izričite boje teksta (ne smije se utopiti u podlogu).
6. **Bento mreža 2 stupca**, kartice **bez rubova**, jednake visine (136),
   bijele (#FFFFFF) na sivkastoj podlozi (#F1F1EE); tamna tema: #1A1A1A na
   #0E0E0E. Sitni uppercase naslov, velika brojka, caption na dnu:
   - Osjet · UV indeks (invertirana crna kartica)
   - Izlazak i zalazak (krivulja) · Vlaga (+ rosište, Magnus formula)
   - Vjetar preko cijele širine: brzina + udari lijevo, kompas SVG desno
     (igla pokazuje KAMO vjetar puše)
   - Tlak (crni disk s vrijednošću) · Vidljivost (+ naoblaka u captionu)
   - Oborine 24 h · (rezerva)
   - Kvaliteta zraka: široka kartica, ocjena u boji + AQI broj + skala u 5
     boja s markerom (postojeća AqiRow logika)
7. **Ispod benta:** naslovi sekcija sitni uppercase. Redoslijed: 14 dana
   (grupirana bijela lista, raspon min–max s toplom trakom, postojeći
   expand) → Karta (RadarPreviewCard, ne dira se ponašanje) → DHMZ kartica →
   **More**.
8. **More (temperatura mora):** za obalna mjesta OBAVEZNO vidljivo; za
   početak kao široka kartica NA DNU ekrana (ispod DHMZ-a) — lako se
   premješta kasnije. Nema kartice kad `seaTemp` ne postoji.
9. **Pin na karti:** umjesto mint točke bijela značka s temperaturom
   odabranog mjesta (2px crni rub, repić). Temperatura iz `burin:last-weather`
   (bez novog upita). JEDAN pin — mjesto s heroja; isto i kad je odabrana
   "Moja lokacija" (GPS). Ekran karte se inače NE dira.
10. **Zadana tema: svijetla** (bila "system"); tamna ostaje izbor u
    postavkama i mora imati potpuni paritet sadržaja.
11. **Ne commitati** dok korisnik ne kaže.

## Tehnika

- Gradijent + pruge: `react-native-svg` (postoji) — bez expo-linear-gradient
  (nativni modul → tražio bi rebuild).
- `weatherGradient.ts`: WMO kod + isDay + tema → stopovi gradijenta.
  Čista funkcija, testira se.
- Rosište: Magnus formula iz temp + vlage. Čista funkcija, testira se.
- Drawer header se skriva na početnoj (vlastiti red datum/hamburger preko
  gradijenta); ostali ekrani zadržavaju header.
- Stale oznaka ("Podaci od HH:mm") seli pod datum u heroju.

## Provjera

`typecheck` + `test` + `expo export` čisti; vizualno na uređaju (iOS dev
build preko Metroa — sve je JS). Bez commita.
