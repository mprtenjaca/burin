@AGENTS.md

# Burin — status projekta

Minimalistička vremenska aplikacija za Hrvatsku. Expo SDK 57, TypeScript
strict, Expo Router + Drawer, NativeWind, zustand + AsyncStorage, react-query.

SDK 54 je izvorno odabran da radi u Expo Go (iOS bez Maca). Od 5.8.2026. iOS
ide na EAS dev build (osobna Apple licenca, internal distribution), pa Expo Go
više nije ograničenje — nativni moduli su otvoreni (MapLibre, widget).

**6.9.2026. — pelud, karta, Android rub.** Oba dev builda su AKTUALNA
(iOS `b2df8268` build 13, Android `05b82ab9` build 4 — oba nose sve
nativne izmjene, fingerprint potvrđen). Pelud prešao na DNEVNI PROSJEK i
razred bez brojke, baždaren na Zadru i Zagrebu; **Štamparov peludomjer je
razvojni izvor iza `__DEV__`** (pravna odluka — vidi Recent Decisions).
Karta dobila dugmad dana i klizač po danu. Repo je od danas na GitHubu
(`origin/master`) — pushati nakon zelenih provjera.

**12.9.2026. — ZONE, POSTOTAK, OTA I MJERENJE PROTIV DRUGIH.** Četiri
popravka, tri nađena Markovim nalazima na ekranu. Zapis:
`docs/records/2026-09-12-zone-postotak-ota-mjerenja.md`.

**Budva i Danilovgrad: MI smo bili u pravu, vrijemeradar nije** — i to s
neovisnom potvrdom s tla (Tivat `TSRA` 16 km od Budve; Podgorica bez
pojave 18 km od Danilovgrada). Prvi put da se to dalo dokazati.

**Vremenske zone su bile pravi kvar:** za Sidney u Ohiju je traka
počinjala od 15:00 umjesto od 09:00 — ŠEST sati izgubljeno. Podaci su VEĆ
dolazili u zoni mjesta, ali ih je `parseLocal` gradio u zoni UREĐAJA. Sat
i datum na heroju sad su mjestovi, uz oznaku `UTC−4`. **Prvi popravak nije
radio** (`buildBundle` nije prepisivao polje) i Marko je to odmah vidio —
zato test sad drži cijeli lanac.

**Vjerojatnost oborine prešla na `best_match`:** izmjereno na 288 sati ×
12 mjesta da je ECMWF viši u 173 sata, niži u 36 (+18.2 pb prosjek), a
točnost je IZJEDNAČENA. Mijenja se kalibracija, ne pogađanje.

**OTA ažuriranja** (`expo-updates`, fingerprint) — JS izmjene idu
`eas update`-om bez builda i bez računala na Metru. Traži jedan build po
platformi da se ugradi.

**Koliko smo točni, izmjereno obostrano:** u Hrvatskoj 34/34 uz NULA
lažnih kiša (ostali po 2) i najbolja naoblaka; u Europi 13/19, zadnji od
četiri, jer propuštamo rosulju ispod praga. **Nismo najtočniji nego
najoprezniji** — u Hrvatskoj prednost, u Norveškoj mana.

**11.9.2026. — OBORINA PREPISANA NA MARKOVIM NALAZIMA.**
Dan je počeo s „u Zadru piše oblačno, a vani kiša lije" i završio s osam
odvojenih kvarova — svaki nađen njegovim nalazom, svaki IZMJEREN prije
popravka. Zapis: `docs/records/2026-09-11-oborina-v2-i-mjerni-alati.md`.

Najveći uzrok: **pragovi su 10.9. baždareni samo u JEDNOM smjeru** — sve
je odgovaralo na „kad app lažno viče kišu" (Polača), nikad na „kad pada a
nitko ne kaže". Sudac je zato mogao app učiniti samo suhljom, nikad
mokrijom. Drugi uzrok: **naoblaka nije bila u jednadžbi** — kiša uz 14 %
neba je besmislica koju svaki čovjek vidi, a kod je gledao samo dBZ i mm.

Popravljeno: radar sudi kroz CIJELI raspon (Marshall-Palmer), jaka jezgra
mora biti ŠIROKA (kamere: Omiš 49 dBZ na 6 % kruga = suho), odjek mora
trajati ≥ 25 % okvira, jačina iz MEDIANA (isti okvir nad Splitom davao je
9 ili 32 mm/h ovisno SAMO o polumjeru), postaja ≤ 2 km obara i jak odjek,
model ne smije tvrditi kišu kad radar odustane, traka se čisti od oborine
uz vedro nebo i od postotka uz 0 mm.

Uz to: **mjerni alati** (`scripts/`) — replay protiv 240 austrijskih
postaja s mm/10 min, pretraga pragova, usporedba s vrijemeradar.hr na 113
mjesta, skupljanje dataseta za budući model. **V2 engine u shadow modu.**

**10.9.2026. (2) — RADAR KAO SUDAC ZA OBORINU (napisano, NEPROVJERENO).**
Markov nalaz kroz prozor: app piše „grmljavinsko nevrijeme" sat i pol
nakon što je prošlo; Verona „rosulja" uz jaku kišu; Polača „nevrijeme" uz
same oblake. Tri kvara, jedan uzrok — **nijedan izvor koji app ima ne zna
pada li SADA**: DHMZ tekst je snimka satnog TERMINA (objavljen 30–70 min
kasnije, a `Termin` je LOKALNI sat — ne UTC, kako sam prvo pročitao), a
model za oborinu jednostavno griješi (Crikvenica kod 61 uz 0 mm i prazan
radar; Verona kod 61 uz 47 dBZ).

Rješenje: **radar čita aplikacija sama** — PNG pločica se dohvati i
dekodira ČISTIM JS-om (`fflate`, bez nativnog modula, bez rebuilda), pa
se uzme najveći dBZ u krugu 5 km. Sudi **RainViewer**, ne LibreWXR (vidi
odluke — izmjereno na 290 postaja s mjerenjem na TLU: Austrija mm/10 min,
Slovenija pojava, Hrvatska tekst).

Tri pravila, svako sa svojim temeljem: **< 20 dBZ obara** tvrdnju o
oborini (95 % suhih od 269 postaja), **≥ 42 dBZ podiže** na jaku kišu
(0 lažnih na 290 postaja), **između 20–42 ne dira** — tu radar ne
razlikuje kišu na tlu od one koja isparava. Odjek se osvježava svakih
10 min, lista okvira svakih 5 → heroj, ikona, ambijent i prvi stupac
trake prate nevrijeme u koracima od ~10 min, umjesto da stoje do
sljedećeg termina.

Stanje: **503/503 testa, typecheck i export čisti; NIJE provjereno na
uređaju i NIJE commitano.**

**10.9.2026. — BRZINA I MEMORIJA.** Marko na dev buildu: „puno brže
učitavanje gradova". Nalaz je bio: novi grad iz tražilice zamrzne
tražilicu 2–3 s, poznati na tren pokaže krivu prognozu — na SVA TRI
uređaja (dakle JS put, ne hardver).

Uzrok nađen ČITANJEM expo-routera iz `node_modules`:
`router.navigate("/")` na rutu koja je ISPOD u stacku NIJE pop nego
**premještanje** — tražilica je ostajala montirana ispod, a RNS je
animirao „push" već montiranog ekrana (grana koju sam expo-router
komentira kao „DANGEROUS … can cause React Native Screens to freeze").
Uz to je skeleton pri promjeni grada ODMONTIRAVAO cijelo stablo
(uključivo MapLibre kartu), a paket se sastavljao iznova za svaki od
osam upita kako stižu.

Popravci: `back()`/`dismissAll()`; skeleton kao PREKRIVAČ izveden
sinkrono; jezgra paketa čeka DHMZ + pristranost kad keš postoji;
`memo(Hero)` + `backdropEffects` stabilne reference; karta na početnoj
montirana JEDNOM (kamera se pomiče); ladica s uskim selektorima i
ambijentom samo dok je otvorena; **per-query keš na disku**
(`@tanstack/query-persist-client-core`), `gcTime` 60 min, `lastWeather`
obrezan; bias 4→2 zahtjeva; trajni keš geokodiranja regija. Novi grad je
s ~15–25 na ~11–13 zahtjeva.

Perf OZNAKE u `utils/perf.ts` (dev-only) + baseline predložak
`docs/2026-09-10-perf-baseline.md`. Testovi 450/36. **Commitano u dva
dijela (pelud `5e425bc`, brzina), ali NIJE pushano** — čeka brojke s
uređaja, koje odlučuju i o MapLibreu na `/map` (vidi odluke).

**9.9.2026. — NOVI RADAR, WEB KAMERE, MJERENO NEBO.** Velik dan, 16
commita, dva zapisa (`2026-09-09-radar-plus-librewxr.md` i
`2026-09-09-kamere-nebo-radar-zamjena.md`).

RainViewer je 1.1.2026. ukinuo nowcast i to se NE MOŽE kupiti (ne prodaju
API). Zamijenjen **LibreWXR**-om (CC-BY-4.0, bez ključa, **bez kvote**):
+60 min budućnosti, podaci do z=11, i **točniji — 9/12 vs 3/12** protiv
DHMZ mjerenja. Stari sloj je ZAKOMENTIRAN, ne obrisan.

Dodane **web kamere (Windy)** ispod karte — slike, ne video (dokazano).
Dodano **mjereno stanje neba**: DHMZ opis pobjeđuje model do 25 km, uz
vlastiti razred **3.5 „pretežno oblačno"** (WMO ima 4 stupnja, DHMZ 5).
Ambijent dobio četiri gustoće oblaka i količinu oborine po jačini; noćne
palete za kišu/snijeg/grmljavinu. Tražilica: županija u podnaslovu i
kratica „Sv" → „Sveti"/„Sveta".

**Pouka dana:** pet krugova popravaka, i svaki koji NIJE bio izmjeren pao
je na uređaju — ime sheme boja nije njezina paleta, `sizes` nisu adrese,
a popravak u funkciji koju nitko ne zove prolazi testove i ne radi.

**8.9.2026. — splash, ikone u zaglavlju, GPS na prvi dodir, rečenica
ugašena.** Android splash je dobio tamnu pločicu (nativno — traži
rebuild); ikone tražilice/ladice se boje po NEBU, ne po temi;
`useLocation` je vraćao `cancel` kao cleanup pa je prvi dodir na GPS
otkazivao sam sebe; domaća rečenica (`quips`) ZAKOMENTIRANA s prekidačem.

**7.9.2026. — detalji dana kao SHEET, dorade liste, lock-screen prsten.**
Detalji dana iz 14-dnevne liste preseljeni iz harmonike u `formSheet`
(`day.tsx` + memorijski store); layout sheeta popravljen u DVA kruga —
pravi uzrok je NATIVNI ugovor RNS-a (vidi Recent Decisions). Lista: siva
„0 %", highlight na dodir, haptika (`expo-haptics` = NOVI NATIVNI MODUL,
traži nove dev buildove). Paralelna sesija preradila prsten na zaključanom
zaslonu u 270° luk s točkom.

## Current Status

| Što | Status | Bilješka |
|---|---|---|
| **PROVJERA na uređaju — 12.9. (zone, postotak, hero sat)** | **Čeka Marka, reload s `-c`** | Sve je JS. **Strani grad** (Sidney Ohio, New York): traka počinje od PRAVOG sljedećeg sata po mjestu, hero sat i datum su MJESTOVI, uz oznaku `UTC−4` pokraj sata. Domaći grad NEMA oznaku. **Postotak u traci** je iz `best_match` — niži i bliži ostalim aplikacijama; Budvina večer pada s 82 % na 18 %, gledati čini li se to preniskim. Konzola `[radar]` po mjestu |
| **Nova dev buildova zbog `expo-updates`** | **Sljedeći korak, 2 builda** | OTA je konfiguriran ali je `expo-updates` NATIVNI modul — dok se ne ugradi, `eas update` nema u što sjesti. Ista dva builda pokrivaju i haptiku i widget prsten. Nakon toga JS izmjene idu `npx eas-cli update --channel development` bez builda i bez računala na Metru |
| **Buduci sati u traci nad planinom** | **Otvoreno, nemam izmjeren popravak** | Danilovgrad 14–17 h: mi 2/3/7/9 %, AccuWeather 43/47/51/52. Uzrok je ECMWF-ova naoblaka (6 % neba dok pada), koju `dropImpossiblePrecip` uzme kao dokaz suhoće. **Provjereno i ODBAČENO:** neslaganje modela ne predviđa grešku (ECMWF griješi 20–21 % u obje skupine, lažno „vedro" 0/40); best_match naoblaka je lošija (26.0 % vs 20.1 %); WeatherAPI ne pomaže (bliži istini 3× prema našima 10×). Radar štiti SAMO tekući sat, a traka počinje od sljedećeg. Pravi lijek je satelit |
| **OBORINA V2 — provjera od 11.9.** | **Commitano, čeka uređaj** | Reload s `-c`. Gledati: (1) **Omiš/Senj/Trilj/Malinska NE pišu kišu** kad kamere pokazuju suho; (2) **Zagreb piše kišu** kad postaje javljaju kišu; (3) traka **nema rosulju uz vedro nebo** ni 80 % uz 0 mm; (4) traka se na promjenu grada **vraća na početak**; (5) **kiša ne kreće od pola** ciklusa; (6) tražilica ima **jedan Hvar**; (7) „Moja lokacija" u ZG/ST/RI/OS piše **četvrt** — Marko potvrdio 12.9. da radi iz tražilice, GPS put NEPROVJEREN |
| **Slaba kiša i rosulja se propuštaju** | **Otvoreno, izmjereno** | Europa 12.9. (19 METAR postaja): uhvatili 1 od 7 kiša, svih 6 promašaja `-RA`/`DZ` na 10–12 dBZ = 0.15–0.21 mm/h, ispod praga `DBZ_DRY` 20. U Hrvatskoj isti oprez daje 0 lažnih kiša (ostali po 2). Mogući put: spustiti prag SAMO gdje je odjek širok — rosulja je široka, dalmatinski clutter uzak. Treba mjerenje iz KIŠNOG razdoblja nad Hrvatskom (`node scripts/compare-hr.mjs`) |
| **V2 engine: preuzima li odluku** | **Shadow mode, čeka brojke** | `currentWeatherV2.ts` se računa PARALELNO, app koristi V1. Replay (240 AT postaja, mm/10 min): V2 hvata 65 % kiše prema 41 %, ali 19 lažnih prema 12 — RAZMJENA, ne poboljšanje, i mjereno u Austriji gdje nema orografskog cluttera. Treba par dana `[v2]` logova iz Hrvatske pa odluka |
| **yr.no za traku** | **Riješeno 12.9. — NE za postotak** | yr **nema `probability_of_precipitation` za naše područje** (provjereno: Oslo/Bergen/Stockholm ga imaju, Danilovgrad/Zadar/Zagreb/Split nemaju — MET ga računa iz nordijskog ansambla). Umjesto njega je uzet `best_match`, isti Open-Meteo poziv koji app već radi. Za OBARANJE oborine yr i dalje stoji kao ideja, ali nije ugrađen; za temperaturu NE (3.29 vs 3.46 °C na 40 postaja). U Europi je 12.9. bio NAJTOČNIJI od četiri (17/19) — vrijedi zapamtiti ako se ikad vrati pitanje |
| **Dataset za vlastiti model** | **Alat spreman, treba ga vrtjeti** | `node scripts/collect-dataset.mjs` → 230 redaka po pokretanju (192 AT postaje s mm + 38 DHMZ + 40 featurea + istina) u `data/*.jsonl`. Treba TJEDNIMA i raznih vremena. Jedino što rješava ono što pragovi ne mogu: vezu radar→tlo PO LOKACIJI (Mosor sistematski laže) |
| **Naoblaka: satelit je IZMJEREN, nije ugrađen** | **Otvoreno, čeka noć i Istru** | Markov nalaz: Hvar vedro, app oblačno. **EUMETSAT `view.eumetsat.int/geoserver/wms` je izmjeren 12.9.** — bez ključa, latencija ~12 min (prema 25–90 min kod postaje i ~2 h kod modela), sloj `msg_rss:rgb_natural_nrt`. Na 43 DHMZ postaje: **satelit 15.7 % greške, ECMWF 20.8 %**, bliži mjerenju 27× prema 16×; razredi monotoni, vedro i oblačno se NE preklapaju. Zadar mjereno 45 % → satelit 35 %, model 14 %. **Prije ugradnje riješiti dvoje:** (1) NOĆ — `rgb_natural` je vidljivi spektar, noću bi svaku noć proglasio vedrom, treba IR sloj i vlastito baždarenje; (2) Istra/Kvarner (Rovinj 60 %, Pula 46 % greške, uži okvir NE pomaže). Detalji u zapisu `2026-09-11-satelit-i-dhmz-radar-izmjereno.md` |
| **Dekoder boja: crveni pojas ±5 dBZ** | Otvoreno, sitno | `dbzFromUniversalBlue` je kontinuiran (sidra izmjerena na LibreWXR-u); iznad 47 dBZ odstupa do ±5 od sidra. Nebitno za pragove 20/42, ali ako se pragovi pomaknu u crveno, treba mu gušća tablica. `dbzFromGrey` (LibreWXR shema 0) ostaje izvezen i testiran, sudac ga ne koristi |
| **Brzina (10.9.): BROJKE** | **Marko potvrdio brzinu** („puno brže"); ostaje IZMJERITI | Kod je commitan I PUSHAN. Ostaje dvoje: (1) oznake u konzoli Metroa — po dodiru na grad `[perf] search:tap → …` i `[perf] stack nakon prijelaza: [index:…]` (ako piše i `search`, stari kvar je živ), pa broj `home:content(N°)` oznaka = koliko se puta vidjela DRUGA brojka (cilj 1); (2) release build na starijem Androidu + `dumpsys meminfo` nakon 1/10/20 prebacivanja — traži se PLATO. Postupak u `docs/2026-09-10-perf-baseline.md`. Ta memorija je i JEDINI kriterij za MapLibre na `/map` (vidi odluke) |
| **Provjera na uređaju — 10.9.: ostalo iz brzine** | **Čeka Marka, reload** | Pelud: „Nema peludi" na Helsinkiju (zeleno, skala s markerom na dnu), New York bez kartice. Ladica: otvoriti/zatvoriti (ambijent zaglavlja se pali samo otvorena), temperature u redovima. Karta doma: pregled ne treperi pri promjeni grada (kamera skače, radar je globalan okvir do 10 min star). Restart aplikacije: poznati grad iz diska bez mreže (persister). Upozorenja za strani grad: drugi put bez geokodiranja |
| **Provjera na uređaju — 9.9. (VELIKI popis)** | **Čeka Marka, reload** | Sve je JS. **Radar:** LibreWXR je sad JEDINI, zove se „Radar", boje shema 2, pločica 256 px, atribucija „LibreWXR". **Kamere:** sekcija ispod karte, najbliža kamera, Polača→Tkon 13.3 km, Pridraga→Seline 16.3 km. **Nebo:** mjereni DHMZ opis do 25 km, „pretežno oblačno" ima svoj razred. **Ambijent:** 4 gustoće oblaka, količina oborine po jačini, noćne palete kiša/snijeg/grmljavina, djelomično oblačno sivlje. **Ikone:** kod 1 ima oblak, ikona uz opis na heroju. **Tražilica:** županija u podnaslovu, „Sv Filip i Jakov" radi. **Karta:** izlaz na prvi dodir i pri ponovnom ulasku. Detalji u zapisu `2026-09-09-kamere-nebo-radar-zamjena.md` |
| **Kamere: „ista obala prije otoka"** | Otvoreno, Markova odluka | Za Polaču je najbliži **Tkon 4.2 km zrakom, ali preko kanala na Pašmanu**; Pakoštane su na istoj obali (6.2 km). Pravilo „najbliža" to ne razlikuje, a Windy ne daje podatak o kopnu/otoku. Odlučiti je li bitno nakon što se vidi slika |
| **Provjera na uređaju — 8.9.: splash, ikone, GPS** | **Čeka Marka** | Splash traži REBUILD (nativni resurs, reload ga ne pokazuje); ikone u zaglavlju po nebu; GPS na prvi dodir u tražilici |
| **Provjera na uređaju — 7.9.: sheet detalja dana + lista** | **Čeka Marka, reload** | Sheet iz 14-dnevne liste NAKON 2. POPRAVKA layouta (neprovjeren!); siva „0 %" umjesto crtice; highlight retka na dodir (proširen u padding kartice). Haptika je u kodu ali NE RADI do novog builda (čuvani require) |
| **Novi dev buildovi (haptika + widget prsten)** | **Otvoreno, nakon provjere** | `expo-haptics` je nativni modul (buildovi 13/4 su BEZ njega), a novi lock-screen prsten je widget kod koji se čita iz builda — reload ih NE donosi. Jedan iOS + jedan Android build pokriva oboje; potom TestFlight |
| **Provjera na uređaju — JS izmjene od 6.9.** | **Čeka Marka, reload** | Pelud (Zadar/Zagreb VISOKA ko Štampar; koprive/trputac u listi; napomena „Izmjereno peludomjerom"; `danas · sutra · datum`), Android donji rub (početna, pelud, ladica, svi podekrani), karta (dugmad dana, klizač po danu, play po danu, atribucija goli tekst iznad legende), ime mjesta („Zadar", ne županija). Sve prošlo typecheck/testove/export — vizualno tek na uređaju |
| **TestFlight (prvi upload)** | **Sljedeći korak, 1 build** | Production build je ZASEBAN od dev builda (dev ne može na TestFlight; production ima ZAPEČEN JS). `--auto-submit` je upload, ne treći build. Upute u Next Step |
| **Zahtjev Štamparu za ponovnu uporabu** | Otvoreno, Markova odluka | Jedini pravno čist put do mjerene peludi u produkciji. Štamparovi uvjeti se pozivaju na Pravilnik o ponovnoj uporabi informacija javnog sektora i traže zahtjev; kontakt `info@stampar.hr`. Do tada Štampar ostaje SAMO u razvoju |
| Pelud: CAMS pragovi ostalih vrsta | Otvoreno, čeka sezonu | Ambrozija baždarena na 2 grada × 3 dana (5/6). Breza/joha/maslina/trave NISU mjerene — nije sezona; na proljeće očekivati isti pomak kao kod ambrozije. Treći grad bi rekao je li omjer CAMS/mjerenje regionalan |
| **Sporo na starijim Androidima + veličina aplikacije** | **Otvoreno — ALAT SPREMAN** (Markov nalaz 6.9.2026.; 10.9. perf oznake, baseline predložak i release build lokalno) | Aplikacija je jako spora na starijim uređajima. Prvo IZMJERITI gdje odlazi vrijeme, ne nagađati. Sumnjivci redom: (1) ambijentalne animacije — `IS_LOW_END`/`thin` već prorjeđuju ispod API 33, ali prag i granica nisu mjereni na pravom starom uređaju; (2) `HeroBackdrop` SVG slojevi (RaysLayer ima najviše elemenata); (3) MapLibre GL; (4) veličina bundlea — `index.hbc` je **6.9 MB**, APK 276 MB u debug/dev inačici (dev build nosi Metro + dev alate; production je bitno manji — izmjeriti pravi `--profile production` APK/AAB prije zaključka). Alati: `npx expo export --platform android` pa `source-map-explorer`, Android Studio Profiler, `IS_LOW_END` prag |
| Karta: korak klizača 3 h na temp/naoblaci | Otvoreno, ideja | OWM pločice se mijenjaju svaka 3 h (izmjereno: 9 slika u 24 h), pa dvije trećine pomaka klizača ne mijenjaju sliku. Vjetar (Open-Meteo) je satni i ostao bi na 1 h |
| Engleski jezik | Čeka provjeru na uređaju | Dani (Thu), smjer vjetra **N/NE/E**, upozorenja en-GB, regije, pelud (sve vrste + note), karta (`-24h / Now / Tomorrow`). Test parnosti ključeva i dijakritika prolaze |
| Smjer strujnica vjetra na karti | Otvoreno | TRI izvedbe odbačene (Recent Decisions — ne pokušavati). Preostaje vlastita sličica strelice (`icon-image` u `buildWindStyle`) |
| 14-dnevna „nema podataka" offline | Otvoreno, Markova odluka | `hourlyAll` (69 kB/grad) se ne sprema na disk. Opcije: samo odabrani grad / prorijeđeno / jasnija poruka |
| Spinner pull-to-refresh na iPhoneu 13 | Open | `progressViewOffset` ne mijenja ništa — vidjeti crta li iOS spinner iza `backgroundColor` ScrollViewa |
| Font u widgetu je sustavski | Open, svjesno | Widget je zaseban proces bez Space Groteska |
| Traka sati u srednjem widgetu | Open, neodlučeno | Podaci već idu u `updateTimeline`; pitanje ikona (SF Symbols su Appleov jezik) |
| Domet regije: kod 90 km, stari zapis 130 | Open, nije greška | `REGION_RANGE_KM = 90` u `useWarnings.ts`; odlučiti broj |
| Polača tip / 14-dnevni min-max korekcija | Open | Bez gušćeg mjerenja se ne rješava; `debiasDaily` radi, mjerenje se ne primjenjuje na dnevne |
| Vremenske vijesti | Open / odgođeno | DHMZ ima vijesti. (Web kamere su RIJEŠENE 9.9. — Windy, vidi zapis) |
| **Rainbow.ai: radar +4 h u budućnost** | Otvoreno, treba ključ | Jedini izvor koji nudi 4 h (LibreWXR daje 1 h jer je optical-flow ekstrapolacija). Uvjeti su čisti (izričito dopuštaju distribuciju kroz aplikaciju). ALI: pločice traže ključ (401 bez njega, pa se pokrivenost nad HR ne može provjeriti unaprijed), a kvota od **30 000 pločica/mj je ~2 korisnika** — jedna sesija s play-om ≈ 450 pločica. Za testiranje da, za javno izdanje ne |

## Next Step

### 0. PROVJERA NA UREĐAJU — 12.9. (zone, postotak, hero sat)

Sve je JS, ali Metro treba `-c` (cache je 11.9. dvaput zavarao — stari
`radarJudge` je preživio običan reload):

```bash
npx expo start --dev-client -c
```

**Strani grad je glavna stvar** (Sidney Ohio, New York, Tokio):

1. **Traka počinje od PRAVOG sljedećeg sata po mjestu.** Izmjereno 12.9.:
   u Ohiju 08:11, app je crtala od 15:00 i gubila ŠEST sati. Sad mora
   početi od 09:00.
2. **Hero sat i datum su MJESTOVI**, uz oznaku pomaka: `08:18 · UTC−4`.
   Domaći grad NEMA oznaku (`zoneLabel` vraća prazno).
3. Datum mora biti datum MJESTA — Ohio noću ne smije pisati sutrašnji dan.

**Postotak u traci** je od danas iz `best_match`, ne ECMWF-a. Niži je i
bliži ostalim aplikacijama, ali zna i pretjerati prema dolje: Budvina
večer pada s 82 % na 18 %. Gledati čini li se to preniskim kroz par dana;
ako da, mogu vratiti ECMWF ili napraviti sredinu (izmjereno, ne pogođeno).

**Ostalo od 11.9.** (commitano, još neprovjereno na uređaju): Omiš/Senj/
Trilj/Malinska ne pišu kišu; Zagreb piše kad postaje javljaju; traka bez
rosulje uz vedro nebo; traka se na promjenu grada vraća na početak; kiša
ne kreće od pola; jedan Hvar u tražilici. **Četvrt u „Mojoj lokaciji"**
je Marko potvrdio iz tražilice, ali GPS put (`district` s uređaja) je i
dalje NEPROVJEREN.

### 0a. Dva builda — `expo-updates`, haptika, widget prsten

OTA je konfiguriran, ali `expo-updates` je NATIVNI modul: dok se ne
ugradi, `eas update` nema u što sjesti. Isti par buildova pokriva i
`expo-haptics` i novi 270° prsten.

```bash
npx eas-cli build --profile development --platform ios
npx eas-cli build --profile development --platform android
```

Nakon toga JS izmjene idu bez builda i bez računala na Metru:

```bash
npx eas-cli update --channel development -m "opis izmjene"
```

`fingerprint` politika znači: update koji traži nativni modul kojeg build
nema NEĆE sjesti (zaštita, ne smetnja). Dodavanje nativnog modula i dalje
traži novi build.

### 0b. Brzina (10.9.) — BROJKE

Brzina je potvrđena na dev buildu, ali NIJE izmjerena. Postupak i tablica
su u `docs/2026-09-10-perf-baseline.md`; ukratko:

1. **Oznake u konzoli Metroa** (reload, bez builda). Mora vrijediti:
   `[perf] stack nakon prijelaza: [index:…]` **bez** `search`; po dodiru
   na poznati grad JEDNA `home:content(N°)` oznaka nakon skeletona; novi
   grad — skeleton odmah.
2. **Memorija na starijem Androidu**, release build (bez Metra i dev
   Reacta — jedini mjerodavan za korisnike):

   ```bash
   npx expo run:android --variant release --device
   adb shell dumpsys meminfo com.markop.burin
   ```

   nakon 1, 10 i 20 prebacivanja grada — traži se PLATO, ne rast. Isti
   bundle ID zamjenjuje dev build; vratiti ga s `npx eas-cli build:list`.

Kad prođe: brojke u `docs/2026-09-10-perf-baseline.md`.

### 1. Provjera na uređaju (sve je JS — reload, bez builda)

```bash
npx expo start --dev-client
```

Oba builda su instalabilna i aktualna: iOS
[`b2df8268`](https://expo.dev/accounts/mprtenja/projects/burin/builds/b2df8268-f399-4e2a-82c9-51f71145c5ea),
Android [`05b82ab9`](https://expo.dev/accounts/mprtenja/projects/burin/builds/05b82ab9-28ee-46bc-8495-1dbd14c61791).
Dev build ne zamrzava JS — svaka daljnja JS izmjena stiže reloadom.

**VAŽNO: `.env` mora imati `EXPO_PUBLIC_WINDY_API_KEY`, a Metro se pali s
`-c`** — `EXPO_PUBLIC_*` se zapeče pri pakiranju, ne čita se u letu. Bez
ključa sekcija kamera se NE PRIKAZUJE (namjerno).

Što gledati: popis u Current Status, prvi red je popis od 9.9. Redom po
prioritetu:

1. **Radar** — budućnost desno od „sada" (6 okvira, oznaka „prognoza"),
   boje na nevremenu, zoom do z=12, brzina učitavanja
2. **Kamere** — Polača i Pridraga MORAJU imati kameru; Zadar samo svoje
3. **Nebo** — kad DHMZ mjeri „pretežno oblačno", app to i piše
4. **Pregled pozadina** (Postavke → *Pregled pozadina po vremenu*) —
   cijeli niz naoblake 0→1→2→3.5→3, kiša/snijeg noću, gustoća po jačini
5. **Karta** — izlaz na prvi dodir, pa ponovni ulazak i opet izlaz

Haptika i NOVI 270° prsten na zaključanom zaslonu se reloadom NE VIDE —
žive u buildu, čekaju nove dev buildove.

Radni tijek: Marko gleda, javi što bode, popravlja se odmah. **Pouka od
9.9.: svaki vizualni „popravak" mjeriti (piksele, kontrast, HTTP), ne
procijeniti** — pet krugova je palo na procjeni.

### 2. TestFlight (prvi upload) — JEDAN dodatni build

Dev build NE MOŽE na TestFlight (distribucija `internal`, JS s Metroa).
Production build ima JS ZAPEČEN — što nađeš na TestFlightu traži novi
production build, zato se testira na dev buildu, a TestFlight je za
pokazivanje kolegi.

Jednokratno, u [App Store Connectu](https://appstoreconnect.apple.com):
My Apps → **+ New App** → bundle ID **`com.markop.burin`** (BEZ
`.ExpoWidgetsTarget` — widget extension nikad ne dobiva vlastiti zapis),
SKU **`burin`**.

```bash
npx eas-cli build --profile production --platform ios --auto-submit
```

`--auto-submit` je upload gotovog `.ipa`, ne zaseban build — ne troši
kvotu. Već gotov build se šalje s `npx eas-cli submit --platform ios --latest`.
Prvi put pita za enkripciju: samo HTTPS → „standard/exempt"; da više ne
pita: `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` u `app.config.ts`.

Tko vidi build: **ti** (Internal grupa, odmah); **kolega kojeg dodaš**
(External grupa, e-mail, prvi build Beta App Review ~1 dan); **nitko drugi**
— public link nikad. Buildovi istječu nakon 90 dana.

Kvota buildova se NE VIDI iz CLI-ja — samo na
[expo.dev billing](https://expo.dev/accounts/mprtenja/settings/billing).

### 3. Ako Marko želi mjerenu pelud u produkciji

Sastaviti zahtjev za ponovnu uporabu informacija prema NZJZ Štampar
(`info@stampar.hr`) — i po potrebi ZZJZ Zadarske županije. Do odgovora
Štampar ostaje iza `__DEV__`.

## Recent Decisions

| Odluka | Zašto |
|---|---|
| **Satni ključevi su u vremenu MJESTA — svaka usporedba „je li sat prošao" ide kroz `placeNow`** (12.9.2026., `utils/format.ts`) | Markov nalaz na Sidneyju u Ohiju: ondje 08:11, a traka počinjala od 15:00 — ŠEST sati izgubljeno. Podaci su VEĆ dolazili točni (`timezone=auto` na svih pet poziva), ali `parseLocal` gradi `new Date(y, m-1, d, hh, mm)`, a taj konstruktor uvijek radi u zoni UREĐAJA. Pogađa `futureHours`, `currentHourIso`, `mapHourly`, `withCurrentCode`/`withPastCodes`, `wetNowIso`. Na domaćim gradovima se NE VIDI jer je pomak nula — zato je preživjelo do prvog stranog grada. Uz sat ide oznaka POMAKA (`UTC−4`), ne kratice: „CST" je i Amerika i Kina |
| **Vjerojatnost oborine dolazi iz `best_match`, ne ECMWF-a** (12.9.2026., `HOURLY_FROM_FALLBACK`) | Markov nalaz: „jako puno se razlikujemo od ostatka aplikacija i to za 10ke posto". Danilovgrad 14–17 h: ECMWF 96/100/100/98 %, best_match 53/60/70/68, AccuWeather 43/47/51/52, vrijemeradar 80/50/50/40 — **ECMWF je jedini na 100**. Izmjereno na 288 sati × 12 mjesta: viši u 173 sata, niži u 36, prosjek +18.2 pb. Uzrok je poznat: na mreži od 25 km je njegova „vjerojatnost" bliža pitanju „koliki DIO ćelije dobije kap" nego „kolika je šansa nad tvojom točkom". **Točnost je izjednačena** (Brier 0.0791 vs 0.0765, oba 5/5 mokrih) — mijenja se KALIBRACIJA, ne pogađanje. Temperatura ostaje ECMWF-ova (0.97 vs 1.42 °C). Dnevni maksimum NIJE diran (+5.9 pb, preslabo) |
| **Radar štiti tekući sat od `dropImpossiblePrecip`; SAMO presuda radara, ne modela** (12.9.2026.) | Pravilo je 11.9. izvedeno iz JEDNOG zadarskog slučaja gdje je niska naoblaka bila TOČNA. Nad planinom je ista niska naoblaka GREŠKA MODELA: ćelija nastane nad vrhom, mreža od 25 km je razmaže, pa nad točkom ispadne 6 % neba uz 94 % vjerojatnosti. Izmjereno na 14 jadranskih mjesta: očistilo 10, **7 ispravno i 3 pogrešno** (Danilovgrad 92→4 % uz radar 31 dBZ na 100 % kruga). Naoblaka i mm kod obje skupine su praktički isti — jedino ih razlikuje vidi li radar odjek. Štit vrijedi samo za presudu RADARA: model je upravo taj koji izmišlja kišu iz vedra neba, pa bi njime štitio vlastitu grešku. **Granica:** traka počinje od SLJEDEĆEG sata, pa ovo korisnik u traci ne vidi |
| **Nismo najtočniji nego NAJOPREZNIJI — i to je u Hrvatskoj prednost** (12.9.2026., izmjereno obostrano) | Markov prioritet: „bitnije je da naša app u Hrvatskoj bude najtočnija". **Hrvatska (34 DHMZ postaje, sve suhe):** mi 34/34 uz NULA lažnih kiša, ECMWF/yr/WeatherAPI svi 32/34 s po 2 lažne; naoblaka 19.9 % prema yr 20.9 i WeatherAPI 37.0. **Europa (19 METAR postaja, 7 mokrih):** yr 17/19, ECMWF 16, WeatherAPI 15, **mi 13 — zadnji**, jer smo uhvatili 1 od 7 kiša. Svih 6 promašaja je `-RA`/`DZ` na 10–12 dBZ (0.15–0.21 mm/h), ispod praga `DBZ_DRY` 20. Sjeverna Europa je rosulja, Hrvatska je krš — isti oprez ondje je mana, ovdje prednost. **Hrvatska polovica „hvatamo li pravu kišu" NIJE izmjerena** (12.9. je bilo suho): pustiti `compare-hr.mjs` kad dođe kiša |
| **`expo-updates` s politikom `fingerprint`, kanal i na `development`** (12.9.2026.) | Markov zahtjev: „da ne moram svaki put izbuildati da vidim promjene dok nisam doma". Dotad je dev build vani pokazivao stanje od dana kad je napravljen (nosi zapečeni JS kao rezervu). `fingerprint` umjesto `appVersion`: računa runtime iz onoga što stvarno dira nativnu stranu, pa update koji traži modul kojeg build nema NE MOŽE sjesti — `appVersion` bi to dopustio jer `version` ostaje „1.0.0" i kad se doda modul, a projekt ih ima pet. Kanal je dodan i na `development` (dokumentacija ga stavlja samo na preview/production) jer je dev build onaj koji se nosi po gradu |
| **Neslaganje modela NE predviđa grešku naoblake** (negativan nalaz, 12.9.2026.) | Hipoteza je bila da `dropImpossiblePrecip` ne smije brisati kad se ECMWF i best_match razilaze oko neba. Izmjereno na 40 METAR postaja: ECMWF griješi JEDNAKO (20–21 %) bez obzira slažu li se, a lažno „vedro" (< 30 % uz stvarnih ≥ 50 %) je **0** u obje neslagajuće skupine. Uz to je best_match naoblaka LOŠIJA zamjena: 26.0 % prema 20.1 %. Danilovgrad je iznimka, ne pravilo — ne mijenjati pravilo po njemu |
| **WeatherAPI ne bi poboljšao traku** (negativan nalaz, 12.9.2026.) | Ima `chance_of_rain` za naše područje (za razliku od yr-a) i 100k poziva/mj uz komercijalnu uporabu, pa je izgledao kao rješenje. Izmjereno protiv radara na 14 jadranskih mjesta: naša app bliža istini **10×**, WeatherAPI **3×**. Naoblaka mu griješi 49.8 % prema ECMWF-ovih 20.4 % (14 METAR postaja) — Vršac i Sarajevo CAVOK, on tvrdi 100 % neba. Njegovih ~36–48 % zvuči razumno jer je umjereno, ali ne razlikuje mjesta gdje pada od onih gdje ne pada |
| **yr NEMA `probability_of_precipitation` za Hrvatsku** (12.9.2026., ispravak ranije tvrdnje) | Ranije je rečeno da yr taj podatak uopće nema — netočno. Ima ga, ali SAMO za Skandinaviju: Oslo 4.5 %, Bergen 67.3 %, Stockholm 0 %; Danilovgrad, Zadar, Zagreb i Split ga nemaju. MET ga računa iz vlastitog nordijskog ansambla, a za ostatak svijeta pada na globalni ECMWF gdje ga ne objavljuje. Zato je za postotak uzet `best_match`. yr ostaje kandidat za OBARANJE oborine (mm i simbol ima svugdje) |
| **Open-Meteo besplatni tier je SAMO nekomercijalan** (12.9.2026., pravna provjera) | Njihovi uvjeti doslovno: nekomercijalno su „privatne ili neprofitne aplikacije **koje nemaju pretplate ni oglase**"; komercijalno su „aplikacije koje imaju pretplate ili prikazuju oglase". **Burin kakav je danas je u redu** — nema pretplate ni oglasa, objava na App Storeu to sama po sebi ne mijenja. Postaje problem čim se doda pretplata ili oglasi, a Open-Meteo nosi jezgru (temperatura, prognoza, geokodiranje, pelud, AQI). Limiti: 10 000 poziva/dan, 5 000/h, 600/min; atribucija CC-BY 4.0 obavezna. Za usporedbu, **yr i DHMZ su čisti i za komercijalnu uporabu** |
| **Radar SUDI oborinu KROZ CIJELI RASPON, ali jaka jezgra mora biti ŠIROKA** (11.9.2026., `utils/radarJudge.ts`) | Prva izvedba (10.9.) imala je MRTVU ZONU 20–42 dBZ: radar se dohvaćao svakih 10 min, gledao i BACIO. Zadar je 20 minuta imao 33–39 dBZ dok je app pisala „oblačno". Sad kod dolazi po FIZICI (Marshall-Palmer, Z = 200·R^1.6): 20 dBZ = 0.65 mm/h, 28 = 2, 40 = 11.5, 55 = 100. Ali JAKA tvrdnja traži ŠIRINU (≥ 40 % kruga), ne postojanost — Markove kamere su isti dan oborile četiri lažne kiše (Omiš 49 dBZ na 6 % kruga POSTOJANO 50 min, Senj, Trilj, Malinska) i sve su bile krš/planina. Radar tamo vidi brdo i vidi ga postojano, pa postojanost ondje ne razlikuje ništa |
| **Jačina oborine se čita iz MEDIANA, ne iz `maxDbz` ni `p90`** | Markov nalaz s kamere: app i vrijemeradar.hr tvrdili su grmljavinsko nevrijeme nad Splitom, a na Rivi ljudi šeću bez kišobrana. Izmjereno nad istom točkom, ISTI okvir, samo drugi polumjer uzorka: 1 km → p90 38 (8.9 mm/h), 3 km → p90 47 (31.6 mm/h), 5 km → 47. **Median je 38 na SVAKOM polumjeru.** Dakle s p90 je odgovor ovisio o tome koliki krug gledamo, a ne koliko pada. `p90` ostaje za drugo pitanje — „ima li konvektivne jezgre u blizini" (grmljavina) |
| **Postojanost ≥ 25 % okvira; postaja ≤ 8 km i ≤ 25 min za oborinu; ≤ 2 km obara i jak odjek** | Tri odvojena Markova nalaza istog dana. (1) Metković: 23 dBZ u JEDNOM okviru od pet → „slaba kiša"; prag postojanosti je lažne kiše smanjio s 12 na 7 na 240 postaja. (2) Zadar: postaja na Puntamici (2.3 km) javlja „jaka kiša", Zadar-aerodrom (10.8 km) „pretežno oblačno" — U ISTOM TERMINU, i oba su TOČNA jer je kiša zakrpasta. (3) Senj: postaja na 400 m kaže „oblačno", radar 48 dBZ na 16 % kruga — orografska jezgra nad Velebitom; postaja na istom pikselu smije je oboriti, i to do 45 min jer je DHMZ termin u objavi već 25–40 min star |
| **Model NE smije tvrditi kišu kad je radar odustao** (`stationThenSky`) | Krk: radar 31 dBZ uz 20 % postojanosti → sudac ga ispravno obori, pa je grana pala na `stationThenModel` i MODEL (star 2 h) upisao „slaba kiša". Radar je rekao „nisam uvjeren", a mi smo pustili izvor od dva sata da tvrdi ono što onaj od tri minute nije htio. Sad smije samo BLISKA I SVJEŽA POSTAJA — ona mjeri tlo; model ne, jer ga je radar upravo nadglasao |
| **Kiša iz VEDROG NEBA nije kiša: naoblaka < 30 % I ≤ 1 mm → očisti** (`dropImpossiblePrecip`) | Markov nalaz: „za Zadar u 2 piše kiša… 94 % što je NEMOGUĆE". ECMWF je davao kod 53 „rosulja", 0.8 mm, uz **14 % naoblake**; yr.no za isti sat `clearsky_day`. Artefakt mreže od 25 km — model razmaže sitnu oborinu iz susjedne ćelije preko vedre točke. Zahvaća **14 % svih oborinskih sati**. Prag NIJE pogođen nego pročitan iz raspodjele: 18 takvih sati ide 0.1 ×8, 0.2 ×4, 0.3 ×2, 0.5, **0.8 ×2 (Zadar)**, pa rez, pa 4.4 (Split PLJUSAK, ostaje). Između 0.8 i 4.4 nema ničega |
| **Postotak oborine se STIŠĆE prema naoblaci, NIKAD ne nulira** (`clearSkyProbCap` = `cc / 3`) | Prva verzija je postavljala 0 % i napravila nemoguć skok 0 → 80 % prema susjednom satu (Markov nalaz istog sata). Izmjereno na 12 gradova × 72 h, sati BEZ IJEDNE KAPI: naoblaka 0–14 % → prosjek 1 %, 15–29 % → 4 %, 75–100 % → 13 %. Dakle ni posve suh sat nije na nuli. Usput nađeno: od 690 suhih sati njih 21 nosi ≥ 50 % (Zadar 80 % uz 0 mm i 25 % neba) — pa se strop primjenjuje i na sate koji uopće nisu oborinski |
| **Traka pokazuje SAMO od sljedećeg sata** (Markov odabir) | Kratko je 11.9. bila pomaknuta na tekući sat (jer on nosi presuđeni kod) i vraćena istog dana: „sadašnji i prošli nemaju smisla u traci, oni su dolje na 14-dnevnoj gdje se može vidjeti što je bilo ujutro". Sadašnjost je na heroju iznad, pa bi je stupac ponavljao |
| **Otoci i uzletišta NISU mjesta** (`isSettlement`, GeoNames `feature_code`) | Markov nalaz: „imamo 2 Hvara, ista županija, isto sve — jedan oblačan, jedan kiša". Geokoder za „Hvar" vraća TRI unosa istog imena u istoj županiji: GRAD (PPLA2), cijeli OTOK (ISL, točka 25 km istočnije) i uzletište (AIRF). Nisu duplikati nego tri različite točke, pa im je i vrijeme različito. Propuštaju se samo `PPL*`; provjereno da sela OSTAJU (Polača, Pridraga, Tkon, Sali) |
| **Ime lokacije dobiva ČETVRT samo u ZG/ST/RI/OS** (`placeNameWithDistrict`) | Markov zahtjev: „ako nudi kvart želim Trešnjevka sjever Zagreb… može bit pljusak na jednoj strani a na drugoj ništa". Mjerljivo: ista ćelija nad Zagrebom imala je 68 % pokrivenosti u 13:40 i 16 % u 13:50, a Trešnjevka i Maksimir su 6 km = sedam radarskih piksela. Prag je veličina grada: ispod ~100 000 je grad manji od uzorka (krug 3 km = 28 km²), pa četvrt ne bi rekla ništa novo |
| **`Animated.loop` kreće od ZATEČENE vrijednosti — mora se resetirati** (`RainLayer`) | Markov nalaz: „na promjenu grada animacija krene od pola, i kad prođe krug opet od pola; refresh popravi". Uzrok je `key={name}` u `HeroBackdrop`: ključ je za svaki grad isti („rain"), pa React sloj NE PREMONTIRA i `Animated.Value` ostane usred ciklusa; kad se `intensity` promijeni, efekt se ponovo vrti i petlja kreće od te vrijednosti. `ambient.setValue(0)` prije `start()`. Provjereno da su ostali slojevi ping-pong (`0→1→0`, uvijek se vrate), a snijeg je već imao `setValue(phase)` — kiša je bila jedina linearna |
| **`ScrollView` preživi promjenu propova i zadrži pomak** (`HourlyStrip` `resetKey`) | Markov nalaz: „na svakoj promjeni grada želim reset na početak, nekad ostane na sredini". Novi grad je naslijeđivao tuđi `contentOffset`, pa je korisnik gledao u sredinu tuđe prognoze. `resetKey={placeName}` + `scrollTo({x:0, animated:false})` |
| **Složena fuzija NIJE pobijedila jedan prag** (negativan nalaz, `currentWeatherV2`) | Pretraženo 216 kombinacija težina (postojanost × pokrivenost × jačina × clutter) na 240 postaja — nijedna nije prešla F1 0.583 koji daje SAMA `persistence >= 25 %`. Zato je V2 confidence namjerno prost, s postojanošću kao glavnom težinom. Da je V2 napisan „po dizajnu" bez ovog mjerenja, bio bi lošiji od V1 + jedan prag |
| **Nepomičnost NE razlikuje clutter od slabe kiše** (negativan nalaz) | Očekivalo se da `clutterScore` i motion vektor odvajaju dalmatinski zemljani odjek. Izmjereno: austrijske PRAVE kiše imaju motion 0.00–0.18 i brzinu 3–7 km/h — isto kao clutter. Filtar „uska + nepomična" izgubio bi 7 od 14 pravih kiša bez ijedne lažne manje. Jedini diskriminator koji drži je ŠIRINA odjeka. `clutterScore` ostaje dijagnostika |
| **Tuđa aplikacija NIJE ground truth** (`compare-vrijemeradar.mjs`) | Usporedba s vrijemeradar.hr daje 90 % slaganja na 113 mjesta i korisna je za nalaženje razlika — ali NIJE dokaz točnosti: na Splitu smo se SLOŽILI i oboje bili u krivu (kamera: ljudi bez kišobrana). Oba čitamo isti radar i isti model. Pravi ground truth po kvaliteti: GeoSphere Austria mm/10 min > DHMZ tekst (satno) > Markova kamera (najbolja za Dalmaciju, ne skalira) |
| **yr.no: DA za oborinu u traci, NE za temperaturu** (izmjereno, NIJE ugrađeno) | README je do 11.9. tvrdio „yr.no ne pokriva HR" — netočno, radi za sve provjerene gradove. Svježina: yr 36 min, ECMWF 128 min. Za oborinu bi maknuo 10 % oborinskih sati i NAKON našeg čišćenja (Zagreb 0.4 mm uz 100 % neba; Dubrovnik kod 96 „nevrijeme" → `partlycloudy`), i svih 18 razlika išlo je u smjeru „ECMWF tvrdi kišu, yr kaže suho" — pa se smije koristiti SAMO kao obaranje. Za temperaturu NE: 3.29 °C (ECMWF) vs 3.46 (yr) na 40 DHMZ postaja. Traži `User-Agent` s kontaktom; nema `precipitation_probability` |
| **SUDI RainViewer, ne LibreWXR — iako je LibreWXR naš sloj na karti** | Izmjereno na istim točkama u istom trenutku: LibreWXR je 10–25 dBZ JAČI (javna instanca sirovih OPERA podataka bez filtriranja cluttera). Na pragu 27 dBZ ima 25 lažnih „pada" prema 5 kod RainViewera; nad Dalmacijom je davao 100 % pokrivenost s NEPOMIČNIM uzorkom kroz okvire — zemljani odjek, ne kiša (Markov nalaz: Polača i Pridraga „žuto/crveno" uz same oblake; RainViewer ondje 17). RainViewer nijednu suhu postaju nije prešao 37. LibreWXR ostaje sloj na karti (ima z=11 i nowcast); za SUD se čita RainViewer |
| **Radarski dBZ se čita IZ BOJA, ne iz sive — i samo do z=7** (`api/radarSample.ts`) | LibreWXR shema 0 („Black and White") JEST siva dBZ skala (izmjereno: siva − 32, monotono, provjereno protiv sheme 2 na istim pikselima). RainViewer takvu shemu NEMA — njegova „0" je R kanal palete, pa vrijednosti izlaze besmislene (223, −32). Zato dekoder za RainViewer čita BOJE sheme 2 („Universal Blue") kroz kontinuirani gradijent, sa sidrima izmjerenima na LibreWXR-u. Uz to: RainViewer podaci staju na **z=7** — z=8 vraća pločicu s TEKSTOM „Zoom Level Not Supported" (izmjereno: ista za Zadar, Tokyo i Kairo), pa bijeli tekst bez zaštite ispada „tuča". Nepoznate boje daju `null`, ne broj |
| **Prazna pločica NIJE „ne pada" — pokrivenost se čita iz `/v2/coverage`** | Prva verzija je imala bbox Europe i time bi za pola kontinenta rekla „suho": izmjereno da RainViewer NEMA radara nad Kijevom, Moskvom, Istanbulom, Ankarom, Athinom, Beogradom ni Sarajevom, a svi su unutar bboxa. Coverage pločica je dokumentirana („prozirno = pokriveno, crno = nije"), keš joj je dan u memoriji i smije na disk — mreža radara se ne mijenja. Bez pokrivenosti sudac ŠUTI i vraća se na model |
| **PNG se dekodira ČISTIM JS-om (`fflate`), i mora podržati SVE dubine** | Nema nativnog modula za čitanje piksela (ni `expo-image-manipulator` ni Skia nisu u projektu), a dodati ga znači rebuild. `fflate` je 8 kB čistog JS-a, PNG unfilter je 60 redaka. **Zamka koju je mjerenje otkrilo:** pružatelji ne šalju uvijek 8-bit RGBA — gotovo prazne pločice dolaze kao 1-bitna paleta, one s malo boja kao 2/4-bitna (libpng bira najmanji zapis). Prva verzija je podržavala samo 8 bita i na pola Europe bacala „bit depth 4 nije podržan" — radar bi šutio točno tamo gdje je najlakše reći „ne pada". Dekoder se TESTIRA PROTIV SHARPA na pravim pločicama (`__fixtures__/radar/`, `expected.json` je libpng izlaz), ne protiv sebe |
| **Prije usporedbe dvaju izvora provjeriti opisuju li ISTI TRENUTAK** | Prvo baždarenje je usporedilo radar u 13:20 s DHMZ tekstom od 12:00 i dalo 65 % slaganja uz besmislice (Zagreb 45 dBZ uz „potpuno oblačno"). Isti trenutak daje **96 %** (44/46). Uzrok je bio moj: `Termin 12` pročitao sam kao 13:00 (UTC), a to je 12:00 LOKALNO — tekst je star do 1 h 27 min, ne 27 min. Pouka je općenitija od radara |
| **„Ima odjeka" NIJE „pada"** | 12 dBZ je ~0.1 mm/h — kapljice koje isparavaju prije tla (virga). Prva verzija sudca je svaki odjek zvala kišom i Zadar u 13:20 dobio „kišu" dok se kroz prozor vide samo oblaci. Zato je prag 20, ne „> 0" |
| **`router.navigate()` na rutu koja je ISPOD u stacku je PREMJEŠTANJE, ne pop — do početne se ide `back()`/`dismissAll()`** (`search.tsx`, `DrawerContent.goHome`) | Pročitano u `expo-router/build/layouts/StackClient.js` (`stackRouterOverride`, case NAVIGATE): postojeća ruta se traži samo ako je TRENUTNA ili uz `pop: true` (koji `navigate` ne šalje); ali expo-router SVAKOM ekranu daje `getId` (`useScreens.js:107`), pa ulazi u granu koja rutu izvadi i gurne NA VRH s istim ključem — `[index, search]` → `[search, index]`. Tražilica je ostajala montirana ispod (20 redova × 4 pretplate crtalo se pri svakom odabiru), a RNS je premještaj animirao kao push već montiranog ekrana (vlastiti komentar expo-routera: „DANGEROUS … can cause React Native Screens to freeze"). Uz to `navigate` ide kroz `routingQueue` koji se prazni u `useEffect` korijena — TEK nakon cijelog render passa koji je `select()` pokrenuo. Stari trag: čišćenje polja pretrage „jer se povratkom zatekne stari upit" imalo je smisla samo ako se tražilica nikad nije odmontirala. Karta je 9.9. popravljena istim lijekom; ladica i tražilica su bile propuštene, a komentar u ladici („navigate POPA stack") bio je netočan |
| **Skeleton pri promjeni grada je PREKRIVAČ izveden sinkrono, ne zamjena stabla iz efekta** (`index.tsx`: `shownPlaceId` kasni kadar za `place.id`) | Stari `switching` se palio u `useEffect` = nakon painta → prvi kadar novog grada crtao je heroja iz keša (stara satna traka), pa skeleton, pa heroja: „na milisekund kriva prognoza pa preskoči". I `return <HomeSkeleton/>` je ODMONTIRAO cijelo stablo — heroja, SVG slojeve, MapLibre kartu, 14 dana — i montirao ga kadar kasnije, pri svakoj promjeni. Sad je prvi render nakon promjene UVIJEK skeleton (izvedeno u renderu, bez efekta i bez painta između), a sadržaj ostaje montiran i prima novi grad pod prekrivačem. `belowFold` se više ne resetira po gradu (jednom, iza prijelaza kroz `runAfterInteractions`) |
| **Jezgra paketa čeka DHMZ i pristranost KAD KEŠ POSTOJI; dodaci (AQI, more, pelud) ne diraju jezgru** (`useWeatherBundle`: `core` + `fresh`) | Osam upita je svaki za sebe sastavljalo paket i crtalo heroja s DRUGOM temperaturom (model → +delta → +bias). Poznati grad: prikazuje se keš dok se ne riješe i DHMZ i pristranost (u pravilu ~0 — memorija ili disk), pa jedan skok umjesto tri. Novi grad: NE čeka (nešto na ekranu vrijedi više od 1 °C točnosti; jedan skok pri prvom posjetu je cijena koja se plaća jednom). `memo(Hero)` radi jer `current`/`hours` reference dolaze iz jezgre, a `fetchedAt` ide zaokružen na minutu — inače bi ga svaki novi `Date.now()` probijao bez ijedne vidljive razlike |
| **Keš upita na DISKU je PO UPITU (`experimental_createQueryPersister`), ne `persistQueryClient`; `gcTime` 60 min; `lastWeather` OSTAJE i obrezuje se** | `persistQueryClient` serijalizira CIJELI keš pri svakoj promjeni — obrazac zbog kojeg je `hourlyAll` već izbačen s diska. Per-query: zapis po upitu, lijeno čitanje pri prvoj uporabi, poštuje `staleTime` (svjež zapis = bez refetcha = bez treperenja), a GC u memoriji ne dira disk → `gcTime` s 24 h na 60 min (RAM omeđen, disk pamti dan); `persisterGc` jednom po pokretanju iza prijelaza. Isključeno s diska (`utils/queryPersist.ts`, testirano): kamere (token istječe za 10 min → spremljen URL vraća 401), Štampar (razvojni HTML), radarski okviri (mijenjaju se svakih 10 min). `lastWeather` ostaje PRODUKTNI keš (widget handler ga čita izravno, ladica/tražilica temperature, offline `isStale`) i sad se OBREZUJE u `save` na spremljene ∪ povijest ∪ odabrani ∪ najnoviji GPS — dosad je rastao zauvijek, a `persist` stringificirao SVE gradove pri svakom upisu. MMKV (30× brži, sinkroni) svjesno odgođen: nativni je modul, dakle tek uz sljedeći rebuild i samo ako mjerenje pokaže da su AsyncStorage čitanja uska. `react-query` podignut na 5.102.8 da s persisterom dijeli JEDAN `query-core` |
| **`backdropEffects` vraća STABILNE reference; ladica čita uske selektore i ambijent crta samo OTVORENA; `RainLayer` ne alocira u renderu** | `memo(HeroBackdrop)` nikad nije pogađao jer je svaki poziv vraćao novi niz — svaki render heroja (svake minute preko `useNow`, pri svakom dolasku podatka) crtao je sve SVG slojeve ambijenta iznova, i na početnoj i u ladici. Ladica je bila pretplaćena na CIJELI `byPlaceId`, pa se 500 linija s animiranim ambijentom crtalo pri svakom upisu u keš, za bilo koji grad; a petlje zaglavlja vrtjele su se i dok je bila zatvorena. Sad `useDrawerStatus` iz `expo-router/drawer` (ne iz `@react-navigation/*` — taj uvoz expo-router odbija) i `CityRight` s brojčanim selektorima, isti obrazac kao `PlaceRow` u tražilici. `useRefreshSavedCities` više nema pretplata (`getState()` u trenutku pokretanja), pa korijen aplikacije ne crta pri svakom odabiru grada |
| **Karta na početnoj: JEDNA MapLibre instanca, kamera se pomiče (`cameraRef.easeTo`, duration 0)** (`RadarPreviewCard`) — Markov odabir | Posljedica prekrivača i `belowFold` bez reseta: karta preživi promjenu grada; do tada se GL kontekst, stil i pločice rušilo i gradilo za svaki grad. `initialViewState` vrijedi samo za prvi mount. Radarski okvir je i dalje GLOBALAN (`["librewxr-frames"]`, LibreWXR pokriva Europu) — pregled crta zadnji prošli okvir, isti za Zadar i Helsinki, star najviše ~10 min; pri promjeni grada se traže samo pločice tog okvira za novi kadar |
| **MapLibre na `/map` se NE odmontira dok ekran nije fokusiran — i to je odluka BEZ mjerenja** | Štedjelo bi jedan GL kontekst dok se gleda početna, ali svaki ponovni ulazak u kartu postao bi hladan start (300–600 ms): sigurna regresija brzine za nesigurni dobitak memorije. Zamjena poznatog za nepoznato se ne radi na procjenu, a uređaj 10.9. nije bio priključen (`adb devices` prazan) pa `dumpsys meminfo` NIJE izmjeren. Kriterij je zapisan: ako memorija nakon 20 prebacivanja i posjeta karti RASTE bez platoa → karta se odmontira; ako je plato → ostaje kako je |
| **Bias 4 → 2 zahtjeva; geokodiranje regija u TRAJNOM kešu** (`bias.ts`, `store/geocodeCache.ts` + `useWarnings`) | Sati i dnevni ekstremi dolaze iz ISTOG Open-Meteo odgovora, a arhivski API je najsporiji od svih (1–3 s) — dva poziva umjesto četiri po mjestu. Regije se ne miču: ime → koordinate (i promašaj `null`, jer ime koje geokoder ne zna neće znati ni sutra) pamti se na disku pod ključem `DE:goslar`; nakon prvog posjeta zemlji nema do 12 geokodiranja po mjestu. Keš je u `store/`, ne u `api/`, da `meteoalarmEurope.ts` ostane čist modul bez AsyncStoragea (njegovi testovi ga uvoze izravno) |
| **Perf se mjeri OZNAKAMA, ne dojmom** (`utils/perf.ts`, `__DEV__` ili `EXPO_PUBLIC_PERF=1`) | Pet neizmjerenih popravaka 9.9. palo je na uređaju. `mark()` bilježi lanac od `search:tap` do `home:content(N°)` i `map:loaded`; broj `home:content` oznaka po dodiru = koliko je puta korisnik vidio DRUGU brojku (cilj: jedan), a `[perf] stack nakon prijelaza` dokazuje da je povratak pravi pop. Za brojke koje vrijede za korisnike treba RELEASE build lokalno (`npx expo run:android --variant release --device`): dev build nosi Metro network inspector i razvojni React |
| **RainViewer je ukinuo nowcast 1.1.2026. — ne može se kupiti; zamjena je LibreWXR** (`api/librewxr.ts`) | Ukinuti su i satelit, sve sheme boja osim jedne, zoom spušten na z=7. Pretplate NEMA — RainViewer više ne prodaje API pristup (ono što se plaća je njihova mobilna app). Zato je `radar.nowcast` prazan: ostatak strukture, ne nešto što ključ otvara. LibreWXR ima ISTI oblik odgovora (pa `librewxr.ts` je blizanac `rainviewer.ts` i nijedan potrošač nije trebao izmjenu), CC-BY-4.0 (slobodno uz atribuciju — drukčije od Plive), Europu preko OPERA mreže, i NEMA kvotu (provjereno: bez rate-limit zaglavlja, 30 pločica u nizu = 30× 200) |
| **Radar+ je TOČNIJI od starog radara: 9/12 vs 3/12** (DHMZ, 9.9.2026.) | RainViewer nije vidio NI JEDNU od pet postaja gdje je kiša stvarno padala (Krapina, Rab, Senj, Puntijarka, Zavižan) — ne koristi OPERA mrežu na kojoj su hrvatski radari. **Metodološka pouka:** prva verzija provjere gledala je samo velike gradove i zaključila da OBA lažu; postaje se biraju po tome GDJE PADA, ne po veličini |
| **Stari radar je „brži" jer nosi 39× MANJE podataka, ne zato što je bolji** | Markovo pitanje. Izmjereno (z=8 nad Zadrom): RainViewer **1 kB / 10 boja**, Radar+ **39 kB / 1415 boja**. Od z=8 RainViewer pada na 1 kB — to je onaj zid (podaci staju na z=7). Latencija je 44 vs 131 ms, dakle ne osjeti se; osjeti se ukupan broj bajtova × pločica × 3 okvira. Radar+ je čak NA CDN-u (`cf-cache-status: HIT`), RainViewer nije. Više podataka je upravo ono zbog čega je točniji — ne popravlja se smanjivanjem |
| **Veličina pločice se NE prepisuje između izvora** (`tileSize` 256 za Radar+, 512 za radar) | 512 je RainVieweru nužan jer mu podaci staju na z=7 — veća pločica je jedini način da rastezanje ne izgleda mutno. LibreWXR ima z=11 i tu potrebu nema; s 512 je bio **3.0 s vs 0.64 s po pločici** (Markov nalaz „20ak sec da učita"). „Kad pustim play tek radi" je isti uzrok: prvi prolaz grije poslužiteljev keš (ponovno 0.09 s) |
| **MJERENO stanje neba pobjeđuje model, domet 25 km, NAJBLIŽA postaja** (`useWeatherBundle`) | Markov nalaz s prozora: app je pisala „djelomično oblačno" dok je DHMZ na zadarskoj postaji MJERIO „pretežno oblačno". `conditionText` se dohvaćao od početka, ali se prikazivao SAMO u kartici „Mjerenja u blizini" — heroj je vozio model. Isto načelo koje projekt već ima za temperaturu (i za koje stoji zapis o Roču/Pazinu). Domet je UŽI od 60 km za temperaturu jer je naoblaka ZAKRPASTA, a bira se NAJBLIŽA postaja jer se opisi ne prosječuju („vedro" + „oblačno" ≠ „umjereno oblačno"). Tablica preslikavanja je iz PRAVOG feeda (13 opisa na 66 postaja) jer DHMZ ne objavljuje šifrarnik; opisi VJETRA („lahor") vraćaju `undefined` i prepuštaju modelu |
| **Popravak u funkciji koju NITKO NE ZOVE prolazi testove i ne radi** | Prvi popravak mjerenog neba napisan je u `correctWithObservation` — a `useWeatherBundle` sam sastavlja `current` iz `observationDelta` + `correctHourly`, pa je ta funkcija dostupna SAMO testovima. Testovi zeleni, app nepromijenjena. Pravilo: pri promjeni toka podataka provjeriti `grep` da funkcija ima pozivatelja IZVAN testova |
| **Vlastiti razred 3.5 „pretežno oblačno" (WMO ima 4 stupnja, DHMZ 5)** (`weatherCodes.ts`) | Prvi popravak je „pretežno oblačno" sveo na WMO 3 („Oblačno"), na što je Marko odmah rekao da app govori VIŠE nego mjerenje. Između 2 i 3 nema koda. Razlomak, a ne slobodan cijeli broj: sam po sebi kaže da je između, ne može se zamijeniti s WMO kodom koji jednog dana dobije značenje, a `code >= 3` ga uključuje dok `code === 3` ne. **OPASNOST koju uvodi:** sve grane po naoblaci bile su `code === 3`, pa je 3.5 propadao do `code <= 1` i dobivao SUNČANI gradijent na oblačnom nebu — isti kvar na PET mjesta (`paletteKey`, `widgetData`, dvije u `iconNames`, `quips`). Svaka usporedba s naoblakom mora biti RASPON |
| **Ambijent: četiri gustoće oblaka i količina oborine po jačini** (`cloudDensity`, `DENSITY_BY_INTENSITY`) | Markov nalaz „na djelomično imam dojam da je praktički full sunce": pretežno vedro (1) i djelomično (2) dijelili su `sparse`, a 3.5 i 3 `full` — dvije razine za četiri stanja. Sad `sparse`/`medium`/`dense`/`full` (3/4/5/5 oblaka), `cloudDensity(code)` je izvor istine umjesto zaključka „ima zraka → rijetko". Isto za oborinu: jačina je mijenjala SAMO brzinu, pa pljusak nije imao više kapi od rosulje — `DENSITY_BY_INTENSITY` daje 40/70/100 % popisa. Reže se `thin`-om, koji vraća IZVORNE elemente pa čestica čuva položaj i fazu (to je isto svojstvo koje je riješilo vodoravni prazni „val"). **Usput nađeno: `RaysLayer` je `density` primao i NIJE ga čitao od 8.8.** — zrake su bile svih 15 na svakom sunčanom nebu |
| **Svako vrijeme ima NOĆNU paletu** (`nightRain`, `nightSnow`, `nightThunder`) | Kiša, snijeg i grmljavina dijelile su jednu paletu za dan i noć, dok su oblaci i vedro noć već razlikovali. Izmjereno: dnevna `rain.light` je noću davala bijelom tekstu **1.87:1** na dnu — nije „svijetlo", nego nečitljivo. Nove tri su IZMEĐU oblačne noći i dnevnih, po Markovu opisu „dojam mračne kiše, al ne kao tamna jer ne želimo onu crninu dolje": dno noćne kiše je mjerljivo svjetlije od dna oblačne noći, sve ≥ 4.65:1 |
| **WMO 1 („pretežno vedro") NIJE golo sunce** (`weatherCodes`, `iconNames`) | Markov nalaz: traka sati je u 17 h crtala SUNCE uz 29° i 2 %, pa u 18 h odjednom oblak. Open-Meteo daje kod 1 i za **~45 % naoblake**, a ikona je bila `SunDim` — prigušeno sunce BEZ oblaka, na 21 px nerazlučivo od vedrog. Kod 1 sad dijeli `CloudSun`/`CloudMoon` s kodom 2; razlika ostaje u NAZIVU i u gustoći ambijenta. Widget je imao isti kvar (`code <= 1` → „sun") |
| **Open-Meteo geokodiranje traži SAMO PO PREFIKSU punog imena** (`expandQuery`) | Izmjereno: „Sveti Filip i Jakov" nalazi mjesto, a **„Sv Filip i Jakov", „Sv. Filip i Jakov", „Sv Juraj", „Sv Nedelja" i „Filip i Jakov" vraćaju NULU**. Kratica je na tablama pa je korisnik piše prvu. `expandQuery` širi samostalno „Sv"/„Sv." u OBA roda (ima ih oba) i traži ih UZ izvorni upit; rezultati se spajaju po `id`, izvorni ide prvi pa određuje redoslijed, svako proširenje hvata svoju grešku. Što samo POČINJE na „sv" („Svetvinčenat") ostaje jedan poziv |
| **Tražilica pokazuje ŽUPANIJU, ne samo državu** (`placeSubtitle`) | Marko je odabrao Vranu na Cresu umjesto one uz Vransko jezero — oba reda su pisala „Vrana · Hrvatska". Open-Meteo je `admin1` vraćao cijelo vrijeme, mapper ga je bacao. Isti problem ima Polača (Zadarska i Šibensko-kninska, plus Mala i Velika). Pravilo je opće („Bayern · Njemačka"); regija jednaka imenu se preskače (ne „Wien · Wien") |
| **Ime sheme boja NIJE njezina paleta — boje se mjere pikselima** | Dva promašaja u istom danu: shema 1 („Rainviewer Original") odabrana po IMENU → zelena; shema 10 („Viper HD") odabrana uz moju tvrdnju da nema zelenog → **izmjereno `rgb(19,160,65)` nad Zagrebom, dakle ZELENA na slaboj kiši** (najčešći slučaj). Tek histogram cijele palete dao je odgovor: samo **2 („Universal Blue") i 14 („Windy")** izbjegavaju zeleno, a 2 je ono što RainViewer koristi — pa zadovoljava „bez zelenog" I „slično radaru" odjednom. Jakost po TAMNINI, ne po tonu |
| **Izlaz s karte ide `router.back()`, ne `navigate("/")`; + brava od dvostrukog dodira** | `navigate` tretira početnu kao NOVU metu pa Drawer gradi zaslon i vrti prijelaz (Markov nalaz „treba mu sekundu"). `back()` samo odbacuje kartu i otkriva zaslon montiran ispod. Drugi dio pritužbe je zaseban kvar: bez brave drugi dodir ide JEDAN ZASLON DALJE, a na početnoj je gore lijevo tražilica — odatle „slučajno stisne search". Brava je `useRef` (ne stanje — čita se i piše u istom kadru), otpuštena pri montiranju jer karta kao Drawer zaslon preživi izlaz. Play se gasi pri izlasku |
| **Web kamere: put je Windy, NE WhatsUpCams; i to su SLIKE, ne video** (`api/windyWebcams.ts`) | WhatsUpCams **nema javni API** (`/api`, `/en/api` → 404); njihove 200+ hrvatskih kamera distribuira Windy, ali samo kroz VLASTITI iframe player (Flowplayer + hls.js) — tuđi izgled u našoj app. Uz to LiveCamCroatia tvrdi izključna prava za HR kamere i traži **pismeno dopuštenje** — isti obrazac na kojem je odbijena Pliva. Windyjev „live" je pak ZADNJA SLIKA: njihov `playerType=live` poslužuje `.jpg` s `max-age=150`, nigdje `.m3u8`. Zato se sekcija zove „Kamere", ne „Live" — obećanje mora odgovarati stvari. Free tier IZRIČITO dopušta mobilnu app uz navođenje Windyja (Professional je €9.990/god); usluga se ne smije staviti SAMO u plaćeni dio |
| **Windy token istječe za 10 min → ekran kamera ima VLASTITI upit** (`useWebcams`, `staleTime` 5 min) | Iznimka od pravila „ekran prima gotove podatke kroz parametre" (pelud, `widgetData`): proslijeđene adrese slika ne bi preživjele duže gledanje jer nose token koji nakon 10 min vraća 401. Ne istječe kamera nego LINK — novi se dobije običnim upitom, što Windy i preporučuje. Kroz parametre ide samo pozicija i ime mjesta. **Posljedica:** kamere su PRVI dio aplikacije koji bez mreže ne pokaže ništa (`lastWeather` posvuda drugdje preživi) |
| **Kamere: prvo IME mjesta, pa udaljenost; bez svoje → TOČNO JEDNA najbliža bez granice** (`pickWebcams`) | Mjesto sa svojom kamerom pokazuje SAMO svoje (Zadar ne pokazuje Vir na 20 km — to rješava pravilo po imenu, ne kilometri). Prva verzija je susjede rezala na 12 km i time Polači (najbliža 13.3 km) i Pridragi (16.3 km) ODUZELA sekciju — rez je bio postavljen zbog Vira pod Zadrom, gdje nije ni trebao. Udaljenost nije razlog da se ništa ne pokaže; kartica je ionako ispiše. Domet traženja 25 km, pa 100 km kao drugi krug samo kad prvi ne da ništa |
| **Windy `images.sizes` su DIMENZIJE, ne adrese** | Najskuplja greška 9.9.: parser je čitao `sizes.preview.url`, dobivao `undefined`, kartica bez slike pokazivala prazno stanje → **„nema kamera" za Polaču iako je API vratio deset**. Adrese su SAMO u `images.current` i `images.daylight`; `preview` (400×224) je najveća veličina koju v3 daje. Iz istog odgovora naučeno: Windy vraća i NEAKTIVNE kamere (slika stara danima laže gore nego prazan okvir) i po pet kamera istog mjesta → najviše jedna po mjestu. Fixture u testu je od tada isječak PRAVOG odgovora |
| **Detalji dana = SHEET (`formSheet` [0.75, 1]), ne harmonika u listi** (`day.tsx`, `useDayDetails`) | Pritužbe „otvori se podsekcija i skroz se izgubim": otvoreni red se nije razlikovao od susjeda, panel se otvarao ispod pregiba, a drugi otvoreni dan odskakivao je listu. Sheet: lista stoji, naslov kaže dan, čipovi prebacuju dan bez zatvaranja. Podaci kroz MEMORIJSKI zustand store (referenca, bez persista) — `hourlyAll` ~69 kB ne smije u parametre navigacije; kroz parametar ide samo `date`. Isto pravilo kao pelud: sheet je čisti prikaz |
| **formSheet sadržaj je UGOVOR s RNS-om: najviše header (`collapsable={false}`) + JEDAN ScrollView** | Nativni iOS kod (`RNSScreen.mm`/`RNSScreenContentWrapper.mm`) SAM nađe ScrollView u sadržaju i rukom mu postavi frame na veličinu sheeta MIMO Yoge (vlastiti TODO: na Fabricu završi na (0,0)). S tri brata (zaglavlje + čipovi + sadržaj) korekcija zgrabi krivi ScrollView — čipovi razvučeni preko naslova; `flexGrow: 0` sam NIJE pomogao jer native pregazi layout. Uz to: RN ScrollView (i VODORAVNI) nosi ugrađen `flexGrow: 1` — u omeđenom stupcu obavezan `flexGrow: 0` (RNS #2992, #3092) |
| 14-dnevna lista: siva „0 %" umjesto crtice; highlight retka na dodir s bleedom u padding kartice | Crtica je starijim korisnicima dvosmislena (nula? nema podatka?); nula ostaje prigušena (`/25`) pa koraljna i dalje vodi oko po stupcu. Traka sati na početnoj ostaje PRAZNA ispod 1 % — okomiti prostor pod ikonom je skup. Highlight kroz `onPressIn/Out` + stanje (pravilo: `pressed` ne radi uz NativeWind) s `-mx-2.5 px-2.5` — bez bleeda highlight završava „skroz do ruba broja" |
| **Haptika kroz ČUVANI `require`, ne statični import** (`DailyList`) | `requireNativeModule` BACA pri učitavanju modula: statični import `expo-haptics` RUŠI cijelu app na buildu bez nativne strane (dev buildovi 13/4). Čuvani require tiho preskoči do novog builda. Tik (`impactAsync` Light) ide PRIJE navigacije na sheet, fire-and-forget |
| Lock-screen prsten: 270° LUK + TOČKA na luku; `strokeBorder(shape: "circle")` na Spaceru; sve oznake unutar r~25 | „Bijeli kvadrat u kutu": zadani oblik `strokeBorder` overlaya je PRAVOKUTNIK, a `CircleView` je ISPUNJEN disk — treba `shape: "circle"` na praznom domaćinu s `frame` PRVIM modifikatorom. Točka umjesto ispunjenog napretka (Markov odabir po Appleovu widgetu): luk je ljestvica dnevnog raspona, točka kazaljka. Sustavna kružna maska reže dalje od ~26 px od središta — prsten 46, min/max unutra; `AccessoryWidgetBackground` iza |
| **Pelud je DNEVNI PROSJEK, ne tekući sat ni maksimum** (`pollenDaysFromHourly`) | Tekući sat: Zadar 6.9. je kroz dan imao ambroziju 1.4→48.7 (35×), pa je ista aplikacija na istom danu govorila „niska" i „vrlo visoka". Maksimum (prvi popravak istog dana) davao je RAZRED VIŠE od mjerenja — jer Hirstov peludomjer JEST 24-satni prosjek (traka se vrti dan, zrnca se podijele s protokom). Prosjek: 2/3 dana pogođeno u Zadru; max 0/3. Pragovi vrijede UZ PROSJEK — tko mijenja agregaciju, mijenja i njih |
| **Ambrozija pragovi `[2, 5, 90]`, baždareni na DVA grada** | Jedan grad nije dovoljan — Zagreb je otkrio da omjer CAMS/mjerenje NIJE stalan: Zagreb 67–89 uz mjereno 8.0 (7–11×), Zadar 17–26 uz 6.6 (0.7–4×). Kontinent dobiva red veličine veće brojke od obale, a mjerenja su slična — pa NIJEDAN množitelj ne pogađa oba; jedino širok razred „visoke" (6–90). Stari `[2,10,30]`: 2/6; novi: 5/6 (promašen samo dan gdje model predviđa 4.9, a Pliva prognozira visoku — model vs mjerenje). Test drži OBA grada. Ostale vrste NISU baždarene (nije sezona) |
| **Pelud prikazuje SAMO RAZRED, bez brojke** (Markov odabir) | Naša brojka je grains/m³ iz CAMS-a, Štamparova/Plivina je INDEKS 0–12+ (niska <2, umjerena <6, visoka <12, vrlo visoka ≥12) — isti dan kod nas 17.2, kod njih 6.6. Dvije mjere iste stvari jedna uz drugu izgledaju ko da netko griješi, a alergičar čita razred. Napomena na dnu IZRIČITO kaže model vs peludomjer i upućuje na županijski zavod — zdravstvena informacija, ne kozmetika |
| Marker na peludnoj skali iz RAZREDA, ne iz omjera (`gradeFraction`) | Skala su ČETIRI JEDNAKA polja, razredi nisu jednako široki — `vrijednost/high` je slao točkicu u krivo polje („piše visoko, točkica na umjereno": 26 → 43 % = drugo polje). Sad uvijek u polju svog razreda, unutar polja razmjerno. Test parnosti tekst↔točkica preko svih vrsta × 16 vrijednosti |
| **Štamparov peludomjer = RAZVOJNI izvor iza `__DEV__`; Pliva ODBIJENA** (`api/stampar.ts`) | Markova odluka nakon pravne provjere: čitanje javne stranice za vlastiti test ≠ distribucija tuđih podataka korisnicima. **Pliva** izričito zabranjuje distribuciju bez pismenog odobrenja i ionako PRESLIKAVA Štampara (brojke iste do decimale, istih 25 gradova). **Štampar** ne zabranjuje ponovnu uporabu — poziva se na Pravilnik o ponovnoj uporabi informacija javnog sektora i traži zahtjev (`info@stampar.hr`). Do dozvole: `enabled: __DEV__ && !!stamparCity` — u produkcijskoj gradnji upit se NIKAD ne pokrene, CAMS ostaje jedini izvor. Zaštita je u kodu, ne u konfiguraciji, da nema prekidača koji se zaboravi |
| Štampar tehnički: GET `?title=<id>`, parser nad HTML-om, 25 gradova s KOORDINATAMA, domet **40 km**, keš **6 h po gradu** | Drupal exposed filter, `method="get"` — nema API-ja. ID-evi NISU abecedni (Dubrovnik 4, Đakovo 5) — prepisani, ne računani. Najbliži grad po haversinu; 40 km a ne 25 jer je jedan peludomjer PO ŽUPANIJI, a Polača je 24.8 km od Zadra (s 25 bi ispadala po GPS šumu). Prvi dan MJERENJE (brojka), sljedeća dva PROGNOZA (samo razred, marker u sredini polja). Tempo (Markov zahtjev „ne pollati agresivno"): ključ po gradu, `staleTime` 6 h uz stranicu koja se mijenja jednom dnevno, bez refetcha na fokus, 1 retry/30 s, `User-Agent` identificira. Parser testiran na ISJEČKU PRAVE STRANICE (`__fixtures__/stampar-zagreb.html`) — kad Štampar promijeni HTML, taj test pukne prvi. Nepoznate vrste `console.warn` |
| `PollenGraded` — GOTOV razred pobjeđuje nad pragovima; 4 Štamparove vrste u tipu | Peludomjer daje razred, ne koncentraciju; provlačiti ga kroz CAMS pragove bilo bi krivo. `PollenDay { levels, graded?, source }`, `pollenSpecies(levels, graded)`. Koprive/trputac/crkvina/loboda dodane da se Štampar prikaže VJERNO (test protiv izvora ne vrijedi ako app prešuti vrstu); CAMS ih nikad ne puni. Napomena na ekranu prati `source` |
| Ime mjesta: `placeNameFrom` ODBIJA upravne jedinice (`useLocation`) | „Moja lokacija" je pisala *Zadarska županija*: na Androidu `city` zna biti `null` izvan velikih gradova pa je `city ?? subregion ?? region` palo na županiju. Filtar po SUFIKSU (županija/county/Landkreis/Bezirk…), ne po popisu; `district` ispred `subregion` (Android ondje nosi naselje). Radije „Moja lokacija" nego županija. 7 testova, uklj. da „Regionalni park Vransko jezero" PROLAZI |
| **iOS `Gauge` je u widgetu NEUPOTREBLJIV — prsten se crta RUKOM; ne pokušavati** | Dokazano u `node_modules`: `Gauge` oznake omata u `<Slot name="currentValue">`, nativna strana čita `children?.slot(...)` — a `SlotView` NIJE registriran u `expo-widgets/DynamicView.swift` (ima `GaugeView`, nema `SlotView`; `children` slaže kao običan niz). `slot()` uvijek `nil` → luk bez ijedne brojke (prazan krug od 7.8.). Popravak 8.8. je maknuo min/max, a `currentValueLabel` ide istim slotom pa je preživio. Sad `ZStack` + dva `Circle` sa `strokeBorder` + `dash` po opsegu (isti trik ko crtice vjetra) + `Text`; opseg po SREDNJICI (`strokeBorder` crta unutra) |
| Atribucija karte: uspravna uz rub ODBAČENA, sjena teksta ODBAČENA — goli tekst 42 % iznad legende, bez pilule | Uspravna: omot 18 px → red se PRELOMIO na dva prije rotacije, natpisi jedan ispod drugog; da radi, omot mora biti dug ko natpis = okvir preko pola ekrana koji guta dodire. Sjena: na 9 px slovima šira od poteza → „slova su mutna". Pilula maknuta (mrlja na tamnoj karti). Obveza (OSM ODbL, CARTO/RainViewer/Open-Meteo) ispunjena: vidljivo, dodir otvara izvor, `hitSlop` 10 |
| **Karta: DUGMAD dana; klizač pokriva SAMO odabrani dan; play vrti ODABRANI dan** (`MapTimeline`, `dayJumps`, `playRange`) | 96–120 satnih koraka na jednoj šini = dan je petina ekrana, piksel preskače sate. Dugme bira dan (skok na PODNE tog dana — po njemu se dan prepoznaje; danas → „sada"), klizač daje tom danu punu širinu (24 koraka; `minimumValue/maximumValue` iz raspona dana). Play se prije UVIJEK vraćao na „sada" i išao do kraja — odabir dana bio besmislen; sad petlja unutar dana, na današnjem od „sada". Sidro „Sada" samo kad je u vidljivom rasponu. Test: rasponi cjeloviti, bez preklapanja, skok unutar svog raspona |
| Oznake dana: `-24 h · Sada · Sutra · 8.9.` (karta) / `danas · sutra · uto 8.9.` (pelud); „danas" iz SATA UREĐAJA | Ime dana u prošlosti se pomiješa s istim danom idućeg tjedna; sutra je najčešća meta; od prekosutra datum. `isNow` traži TOČNO poklapanje niza s tekućim satom i pada čim se sat pomakne/zona razlikuje → svi dani ispadnu datum (Markov nalaz „sutra piše datum", 3×). Datum uređaja je rezerva; `isNow` ostaje samo za crticu na šini. Pelud računa po DATUMU, ne po indeksu — prvi dan je danas samo slučajno |
| `forecast_days` kod Open-Metea BROJI DANAS kao prvi dan | `3` = danas + 2, ne + 3. Karta ima `FORECAST_DAYS = 4` (jučer, danas, tri naprijed = 5 dugmadi); pelud `forecast_days=3` = danas + 2, kako Pliva objavljuje. OWM daje različite pločice i na +240 h |
| **OWM pločice se mijenjaju SVAKA 3 SATA, ne svaki sat** (`&date=` radi −120 h…+240 h, bez tihog ponavljanja) | Izmjereno md5-om kroz 24 h: 9 različitih slika (+0, +1, +4, +7, …). Klizač ima korak 1 h pa dvije trećine pomaka ne mijenjaju sliku — izgleda „zaglavljeno" iako radi. Vjetar (Open-Meteo mreža, `past_days=1&forecast_days=3` u `windGrid.ts`) je JEDINI satni sloj. Otvoreno: korak 3 h na temp/naoblaci (Status) |
| `useBottomInset`: safe-area dno SAMO na Androidu, kao DODATAK paddingu | App je edge-to-edge (`edgeToEdgeEnabled: true`, zadano SDK 57) → Androidova traka s 3 gumba (neprozirna, ~48 dp) leži PREKO dna svakog ScrollViewa; iOS indikator je proziran pa se čita (Marko potvrdio OK). Visina ovisi o uređaju (gesta ~24, gumbi ~48) — konstanta ne može. Svi ekrani + ladica; donji padding preseljen iz Tailwind klasa u `contentContainerStyle` da ga drži jedna vrijednost |
| Vjetar NEMA korekciju mjerenjem — i NE TREBA je (izmjereno 8.8.2026.) | Leave-one-out na 34 postaje: bez korekcije 2.056 m/s, aditivna 2.156, multiplikativna 2.064 — obje lošije. Vjetar je lokalan (Prevlaka 12.9 uz model 1.7, Rab 2.1 uz 7.3 — susjedne postaje suprotne), temperatura se u prostoru mijenja glatko. `windSpeed/windGusts` idu iz modela kakvi su |
| TestFlight = ZASEBAN production build; dev build NE MOŽE na TestFlight; `--auto-submit` nije build | Dev: `internal`, JS s Metroa — zato je alat za testiranje (svaka JS izmjena reloadom, bez novog builda). Production: `store`, JS ZAPEČEN — što nađeš traži cijeli novi build, zato se NE testira na TestFlightu. Ukupno 2 builda po ciklusu. Kvota se ne vidi iz CLI-ja, samo na expo.dev billing. EAS pakira LOKALNO stablo (fingerprint dokazuje što je unutra; `Commit` u ispisu je samo oznaka HEAD-a, ne popis) |
| **Akcenti**: odabrano = `ACCENT_UI` (#2C6FC4) na svijetlom, `ACCENT_STEEL` na tamnim trakama; `ACCENT_CORAL` samo gdje boja znači „pozor" | Jedna plava za „odabrano" (postavke, čipovi, ladica, tražilica, dugmad dana). Na tamnoj traci karte `ACCENT_UI` pada na 2.55:1 → `ACCENT_STEEL` (3.85–5.38:1); ispunjeni čipovi ostaju `ACCENT_UI` jer se mjeri bijeli tekst NA njima. Koraljna (3.03:1 na bijelom — pada) ostaje za UV, oborine, radar, crtice tlaka. Heroj: zlatna `HERO_GOLD` na vedrom nebu; traka sati vlastiti `stripAccent`. Sve mjereno kontrastom, po podlozi |
| **AI sažetak je OBRISAN, ostaju ručne rečenice** (`src/utils/quips.ts`) | Traženi glas je DALMATINSKI i grub ("jebački vruće", ikavica, `ča`, `kuva`) — model to na dva jezika ne pogađa pouzdano, a promašen domaći ton je gori od nikakvog. Uz to: rečenica je sad UVIJEK tu (bez mreže, kvote i čekanja od 2 s), nema ključa ni troška. Zakomentiran 10.8.2026., **obrisan 1.9.2026.** (Markov odabir — mrtav kod koji se dvaput čitao ko „možda se vrati"): otišli `src/api/summary.ts`, `src/hooks/useSummary.ts`, cijeli `worker/` (Cloudflare + Gemini), `EXPO_PUBLIC_SUMMARY_URL` iz `.env.example`, unosi u `.gitignore` i `exclude` u `tsconfig.json`. Ništa od toga nije bilo commitano, pa u povijesti nema što tražit — povratak bi značio pisat iznova |
| **Rečenica je iza PREKIDAČA u Postavkama, ZADANO UGAŠENA** (`quips`) | Markov odabir 1.9.2026. Tekst psuje, a vrijeme je usluga koju netko otvori pred djetetom ili pokaže kolegi — psovka koju nije tražio je promašaj kakav ostatak aplikacije nigdje ne radi. Ugašeno znači da se `QuipLine` NE RENDERIRA (odabrano između tri varijante; pristojna inačica svake rečenice je odbijena — dvostruko pisanje za glas koji nije bio poanta). Odluka je NA POČETNOJ: `quipBundle={quips ? bundle : undefined}`, jer heroj ne čita postavke ni za što drugo. Naslov u postavkama IZRIČITO spominje psovke — opcija ugašena zbog jezika mora reći što pali, inače je iznenađenje koje prekidač i treba spriječit |
| Pragovi vjetra se UVOZE iz `weatherLook`, ne prepisuju | `WIND_STORM_KMH` (61.2 km/h = 8 Bf) je isti broj na kojem značka bure postaje olujna. Da su prepisani, jedan bi se dan pomaknuo bez drugog i rečenica bi govorila "bura" dok značka šuti. Polje `current.windGusts` je u KM/H, ne m/s |
| Ikonski gumbi: pravi padding + `pointerEvents="none"` na ikonu | Nađeno na uređaju 8.8.: dodir NA glif nije radio, tek desno od njega. Lucide ikone su SVG (`react-native-svg`), koji na Androidu zna PROGUTATI dodir umjesto da ga pusti Pressableu; a sama ikona 22 px + nevidljivi `hitSlop` je premala meta. Pravilo za svaki ikonski gumb: `p-2` (uz `-m-2` da glif ostane na mjestu) + ikona u omotu bez dodira |
| Model NIJE mjerenje — pri pitanju „kakvo je vrijeme" gledati DHMZ | ECMWF je za Roč davao „vedro" dok je Pazin (18.6 km) javljao GRMLJAVINU i stvarno je bilo oblačno. Prvo `hrvatska_n.xml`, model samo za ono što postaje ne mjere |
| Traka sati se reže PRI CRTANJU (`futureHours`), ne pri dohvatu | `mapHourly` reže od punog sata pri dohvatu, a upit stoji 30 min — u 15:40 je prva kolona bila „15" s prognozom starom pola sata („piše kiša, a vani vedro"). Rez pri renderu prema `useNow`; kad su svi sati prošli, vraća zadnje poznato |
| Odmak animacije ide u FAZU, ne u odgodu pokretanja | Snijeg: `setTimeout` do 4 s prije `start()` → skupina stoji zamrznuta („kreće od pola ekrana") i visi na fiksnom bočnom pomaku (vodoravni tragovi). Petlje kreću odmah, razlika skupina kroz `setValue` početne vrijednosti. Vrijedi za svaki sloj sa skupinama |
| Smjer strujnica vjetra: TRI izvedbe odbačene — ne pokušavati | (1) `symbol` s „▶": CARTO glifovi su samo osnovni ASCII (dekodiran `.pbf` — raspon prazan); (2) `line-gradient`: spec ga IZRIČITO zabranjuje uz `line-dasharray`; (3) drugi sloj crtica (rep): typecheck čist, a NA UREĐAJU ruši ekran — dva dash sloja nad istim izvorom mijenjana svakih 130 ms native ne podnosi. Preostaje vlastita sličica u stilu karte |
| Ekran peludi prima podatke KROZ PARAMETRE navigacije, ne kroz hookove | Popravak 13.8.2026. („po sekunde da se otvori"): ekran je na montiranju vrtio `useWeatherBundle` (cijelo sastavljanje) i `useLocation` — a taj na „Mojoj lokaciji" pri SVAKOM otvaranju iznova traži GPS + reverse geocode PREKO MREŽE. Kartica sad šalje `levels` (JSON, desetak brojki) + `place` u parametrima, ekran je čisti prikaz. Odgoda liste za jedan kadar (8.8.) OSTAJE — crtanje skala unutar prijelaza i dalje košta. Isto pravilo kao `widgetData.ts`: što prima drugi ekran, mora biti gotovo |
| Skupa montiranja odgoditi za jedan kadar — i SKUPE POSLOVE iza prijelaza | Prošireno 8.8.: uz sadržaj ispod pregiba na početnoj, isti obrazac dobile tražilica (~20 `PlaceRow` redova) i pelud. `pushWidget` ide kroz `InteractionManager.runAfterInteractions` — svjež dohvat slijeće točno u kadar prijelaza, a widget crta oba Android widgeta i serijalizira iOS crtu; njegova točnost se mjeri u minutama |
| Ambijent widgeta: `frame` na VELIČINU PLOČICE + `clipped`, po `widgetFamily` | Dva kvara istog uzroka: SwiftUI `ZStack` poprimi veličinu najvećeg djeteta. Zrake od 226 px u pločici od 158 → sadržaj gurnut iz kadra (samo na SUNCU — kiša 32 px, oblaci 64 px stanu). Pa onda konstanta 360 px širine → mala pločica (158) rastegnuta, „samo slika bez brojki". Dimenzija se čita iz `environment.widgetFamily`. Sadržaj iOS widgeta uz to treba padding 18, ne 14: `ignoreSafeArea()` na pozadini ukida i sustavne margine sadržaja (Android s istih 14 izgleda prozračnije jer taj sloj nema) |
| `size` na `@expo/ui` `Image` vrijedi samo za SF Symbole | Ikona iz datoteke se crta u PUNOJ veličini dok se ne doda `resizable()` → `aspectRatio({fit})` → `frame()`, tim redom; sam `frame` preveliku sliku samo OBREŽE (golema odrezana ikona na uređaju) |
| `null` NE SMIJE u propove widgeta | `Exception in HostFunction`: propovi prelaze u Swift `[String: Any]`, gdje JS `null` nema parnjaka — crta se ne upiše i widget crta „undefined" posvuda. Odsutnost = boolean (`hasGusts`), broj = 0. Test čuva pravilo za sve buduće propove |
| Android widget se osvježava `requestWidgetUpdate`, crtež u `android/render.tsx` | `pushWidget` je zvao samo iOS put pa je widget ostajao na starom gradu do 30 min (`updatePeriodMillis` minimum). Sada dva pozivatelja (headless handler + aplikacija) dijele isti crtež da se ne raziđu |
| Meki rubovi na Androidu: `radialGradient`, ne `feGaussianBlur` | `RemoteViews` ne izvršava SVG filtere pouzdano — blur otpadne i ostane goli krug (tvrdi rubovi oblaka). Gradijent je ISPUNA pa prolazi svuda; izmjereno renderom (skok 2 razine na 5 px) |
| Ambijentalni slojevi se prorjeđuju na slabijim uređajima | Kiša štucala na S10e: 63 `<Line>` sa dash + round caps rasterizirano na CPU-u. Ispod Android API 33: 32 crte, ravni krajevi. Prorjeđivanje nosi IZVORNI indeks (uzorak i faza ovise o njemu) — inače se vraća vodoravni prazni „val" |
| `EXPO_PUBLIC_*` se ZAPEČE u bundle pri POČETKU builda; visibility `PLAIN`, profili navode `environment` | Build 9 (18:01) je krenuo prije nego je ključ stvoren (18:10) pa je izašao BEZ njega — OWM čipovi sivi. Metro te varijable zamjenjuje doslovnim tekstom pri pakiranju, nisu runtime. Zato: varijabla mora postojati PRIJE `build`, a ne za vrijeme. `SENSITIVE` je za njih lažna sigurnost — skriva vrijednost samo u EAS logovima, dok je u `.ipa` svejedno čitljiv tekst; javni ključ se drži `PLAIN` da se barem može provjeriti. Svaki profil u `eas.json` dobio je izričit `environment` da se ne pogađa koje okruženje EAS veže |
| `autoIncrement` ide na SVE profile, ne samo `production` | Uz `appVersionSource: "remote"` broj podiže samo profil koji ga ima — dev je stajao na 1 zauvijek, a iOS odbija instalirati dvije gradnje s istim brojem. `version` u `app.config.ts` ostaje ručan |
| Ladica se otvara `navigation.openDrawer()`, ne `DrawerActions` | Od SDK 56 `expo-router` odbija uvoz iz `@react-navigation/*` — `expo export` pukne. `@react-navigation/drawer` izbačen (hash bundlea identičan) |
| Pri dizanju SDK-a očekivati ČETIRI vrste sitnih zapreka | (1) paketi koji se prestanu autolinkati moraju ručno u `plugins`; (2) `tsconfig` `types` je izričit popis; (3) paketi pod `expo/node_modules` traže jest `moduleNameMapper`; (4) zabranjeni uvozi pucaju tek na `expo export` |
| `'widget'` direktiva izdvaja TIJELO funkcije u zaseban paket | Sve u dosegu MODULA je widgetu NEDOSTUPNO (`ReferenceError: Backdrop`) — pomoćne komponente i konstante unutra, i zovu se kao FUNKCIJE, ne JSX. Typecheck/testovi/export sve prođu — greška se vidi tek na uređaju |
| `expo-widgets` je ISKLJUČEN iz Android autolinkinga | `checkDuplicateClasses`: oba widget paketa traže `androidx.work` u različitim verzijama. `expo.autolinking.android.exclude` u `package.json`; na Androidu je `expo-widgets` ionako KOSTUR (crta `Text(widgetName)`) |
| Widget ikone su ODVOJENA briga od upisa crte; greške se logiraju | Pad ikona u istom `try` je preskakao `updateTimeline` → bijela pločica bez greške. Dva bloka + `console.warn` (`[burin] widget nije osvježen:` / `ikone nisu spremne:`). `expo-file-system` i `expo-asset` su izravne ovisnosti |
| Android widget: `SvgWidget` prima SVG string; handler čita AsyncStorage izravno | Gradijent s tri stopa i ambijent kao prava grafika; nema App Groupa. `index.js` postoji samo da registrira headless zadatak PRIJE expo-routera (require, ne import — hoisting) |
| Widget ima JEDNU verziju, uvijek tamnu | Tema telefona se ne prati; palete su potamnjene inačice (bijeli tekst ≥ 4.5:1, najniže 4.78). Vedar dan u widgetu je PLAVO NEBO — žuta ne trpi bijeli tekst (1.63:1) |
| Ambijent iOS widgeta od `Rectangle`/`Circle`; MALA pločica vidi ±79 px | Nema `Path`/`Canvas`. Kose crte = rotirani pravokutnici pod 29°. Sve što mora raditi na obje veličine mora biti u pojasu ±79 px od sredine |
| Ikone widgeta su PNG (`sharp`), lock screen dobiva PUNE, preklopi se režu MASKOM | SF Symbols se ne koriste (Appleov jezik). `vibrant` način stanji obrise → `*-fill` set. Maska ne dodaje boju na gradijent podloge. Tintanu verziju iOS radi sam — kod samo izostavi gradijent i ambijent u `accented` načinu |
| Gradijent u widgetu: `Rectangle` + `foregroundStyle` + `ignoreSafeArea()` | `containerBackground`/`background` primaju samo `Color`; jedini modifikator s `linearGradient` je `foregroundStyle`. Pouka: **tipove čitati iz `node_modules`, ne iz dokumentacije** |
| Widget dobiva IZRAČUNATE boje i tekstove kroz `updateTimeline` (12 h) | Widget ne izvršava naš JS i ne vidi AsyncStorage (App Group). iOS budžetira buđenja (~40–70/dan) pa snapshot zastarijeva. Tekući sat se preskače (duplikat datuma = neispravna crta). Tip propova u zasebnom `props.ts` (nativni uvozi ruše testove) |
| Značka bure: po UDARIMA, pragovi 10/17 m/s, vjetrulja s prozirnim rasjecima | Bura se pamti po udarima (Polača: 4.2 stalno, 9.1 udari). 17.2 = 8 Bf. Tri tona po podlozi (`card`/`hero`/`dark`). SVG provjeriti RENDEROM u PNG prije uređaja; koordinate se IZRAČUNAJU (`rotate(kut,cx,cy)` — `transform-origin` ne postoji u react-native-svg) |
| m/s zadan; Fahrenheit dobiva slovo (ispod kružića), 14 dana bez slova | DHMZ i pomorska prognoza govore m/s. `persist` čuva stari izbor postojećih instalacija |
| Jedinice u `MapTimeline` propom, ne iz storea | `useSettings` bi uvukao AsyncStorage i srušio testove čiste logike — isto pravilo kao `props.ts` u widgetu |
| Tražilica: tipkovnica se ne otvara sama; GPS TEK NA DODIR; hamburger desno | Najčešći potez je dodir na poznat grad. Iznimka za GPS: kad je heroj već „Moja lokacija". Ladica izlazi zdesna pa gumb desno |
| Hrvatska = ručna tablica 14 EMMA regija, Europa = geokodiranje + OBAVEZAN filtar države | Meteoalarm ne objavljuje granice; Njemačka ima 409 regija. Bez filtra „Velebit channel" geokodira u Srbiju |
| Sve što ide na disk mora biti malo | `hourlyAll` (69 kB/grad) se NE piše na disk — `persist` serijalizira na JS threadu. (Posljedica: 14-dnevni detalji offline nemaju izvor — otvoreno u Statusu) |
| Animirani elementi u SKUPINAMA koje dijele petlju; `useNativeDriver: true` uvijek | Po element = 31 sloj na suncu. Platno s IZRAČUNATOM rezervom (pokriti i fiksne pomake); `width="100%"` bez `viewBox` daje kvadrat; zrake sunca se NE pomiču, samo dišu |
| `pressed` stil na Pressableu NE radi uz NativeWind | `className` → `style` prepisuje funkciju. Odziv kroz `onPressIn/Out` + vlastito stanje |
| Dizajn se zaključava u HTML mockupu; vizualno se provjerava NA UREĐAJU | Nijedan vizualni bug nije uhvaćen provjerama — svi su prošli typecheck, testove i export. Render SVG-a u PNG (`sharp`) hvata dio prije telefona |
| react-query `queryFn` nikad `undefined`; `keepPreviousData` na upitima uz poziciju karte | „Query data cannot be undefined"; bez `keepPreviousData` svaki pomak karte gasi kontrole |
| Veličine ciljaju starije korisnike | Ništa sitno ispod 11 px, ništa bitno ispod 65 % kontrasta |
| Animacija karte izmjenom `raster-opacity`, ne `tiles`; crtice vjetra `line-dasharray`; smjer preko u/v | `tiles` na živom izvoru native ignorira. Geometrija 8×/s je preskupa; svi dash kadrovi moraju imati isti zbroj. Prosjek stupnjeva 350°/10° daje 180° |
| Open-Meteo ima SATNU kvotu (~600/h) — resetira se na puni sat | Probijena testiranjem mreže vjetra (154 koordinate = 154 poziva!). Duži `staleTime`, batch upiti, vidljiva poruka. **Ne trošiti kvotu na testiranje** — provjeravati kodom i lokalno |
| Sva mjerenja izmjeriti; protiv termometra, ne protiv V&R | Više je „logičnih" ideja izmjereno kao pogoršanje. Bug je 3 commita bio nevidljiv jer je slučajno približavao V&R-u |
| `PRIMARY_MODEL` (ECMWF IFS) dijele prikaz i bias; korekcija: prosjek 3 DHMZ postaje, domet 60 km, kazna za udaljenost JEDNOM, prigušenje po dosljednosti | Sve leave-one-out izmjereno (1.99 vs 2.37 °C itd.). NE učiti iz DHMZ postaja, NE vagati po visini, NE smanjivati domet, NE tražiti prognozu s kopnene točke za obalna mjesta |
| iOS ide na EAS dev build, ne Expo Go | Osobna licenca + jedini developer → internal distribution. EAS pakira LOKALNO stablo, push i build su neovisni |
| ~~yr.no ne pokriva HR~~ (NETOČNO od 11.9.2026.); Open-Meteo nema tile endpoint; OWM besplatni nema strelice vjetra | Zato: Open-Meteo JSON po točki + OWM pločice + vlastiti sloj vjetra. **Ispravak:** yr.no (MET Norway `locationforecast/2.0`) RADI za sve provjerene hrvatske gradove — 90 točaka, do +10 dana. Ostaje neupotrijebljen dok se ne odluči o traci (vidi odluku o yr.no) |

## Development

```bash
npx expo start --dev-client   # dev server; JS izmjene idu reloadom, BEZ rebuilda
npm run typecheck             # tsc --noEmit
npm test                      # jest, 664 testa u 41 skupini
node scripts/generate-widget-icons.mjs  # 20 ikona widgeta (traži sharp)
npx expo export --platform android   # puni Metro/Babel/NativeWind pipeline
npx expo run:android          # nativni dev build
node scripts/generate-icons.mjs      # ikone aplikacije (varijanta 7; traži sharp)
```

**Rebuild treba pri dodavanju nativnog modula, pri promjeni ikona I pri
SVAKOJ izmjeni iOS widgeta** — `assets/*.png` se ugrađuju u build, a widget
bundle se čita iz `Bundle.main`. Font, SVG gradijenti i ambijentalne
animacije su JS — vidljive običnim reloadom. **Android widget je iznimka**:
handler je običan JS (ali `clickAction`/config su nativni).

MJERNI ALATI za oborinu (11.9.2026., `docs/records/2026-09-11-…`). Ne diraju
aplikaciju — uvoze iste module prevedene esbuildom (RN uvozi ne prolaze u
čistom nodeu) i mjere protiv vanjskih izvora:

```bash
node scripts/radar-replay.mjs --stations 250 --save replay-dataset.json
node scripts/radar-tune.mjs replay-dataset.json      # pretraga pragova
node scripts/compare-vrijemeradar.mjs                # 113 mjesta vs vrijemeradar.hr
node scripts/compare-vrijemeradar.mjs --places zadar,split

# 12.9.2026. — protiv MJERENJA NA TLU, ne protiv tuđih aplikacija:
node scripts/compare-hr.mjs            # mi vs yr/WeatherAPI/ECMWF, istina = DHMZ
node scripts/compare-apps.mjs          # isto, istina = METAR (cijela Europa)
node scripts/probe-place.mjs 42.286,18.840 Budva   # sve što sudac vidi + KOJA grana
node scripts/rain-check.mjs            # nađe gdje PADA pa ondje pusti sudca
node scripts/compare-prob.mjs          # ECMWF vs best_match (slaganje + Brier)
node scripts/check-cleaning.mjs        # griješi li dropImpossiblePrecip
node scripts/collect-dataset.mjs                     # +230 redaka u data/*.jsonl
```

**Nijedan prag se ne mijenja bez ovoga.** Pravilo projekta „sva mjerenja
izmjeriti" 11.9. je dvaput spašeno upravo tako: prag od 0.5 mm je
propuštao Markov slučaj, a prag mediana od 15 dBZ obarao je pravu kišu —
oba su ispravljena tek kad je pogledana RASPODJELA, ne kad su odabrana.

`data/` i `replay-*.json` su u `.gitignoreu` (mjerni podaci, kao `docs/`).

EAS (dev + TestFlight):

```bash
npx eas-cli build --profile development --platform ios      # dev build, ~8 min
npx eas-cli build --profile development --platform android  # ~25 min
npx eas-cli build --profile production --platform ios --auto-submit  # TestFlight, 2-u-1
npx eas-cli build:list --limit 2                            # linkovi za instalaciju
```

**EAS ne povlači s GitHuba** — pakira LOKALNO radno stablo. Metro na
Windowsima povremeno padne s `EMFILE: too many open files` — nije aplikacija,
restart `npx expo start --dev-client -c` čisti (trajno rješenje: Watchman).

Provjera prije commita: `typecheck` + `test` + `expo export` moraju biti
čisti — pa `git push origin master` (repo je od 6.9.2026. na GitHubu,
commiti bez Claude co-author trailera). **Za sve vizualno to nije dovoljno** — svaki vizualni bug je prošao
sve tri provjere i bio vidljiv tek na uređaju.

## Architecture

Tok podataka: `useWeatherBundle` sastavlja `WeatherBundle` iz odvojenih
react-query upita (trenutno 10 min, prognoza 30 min, AQI/more 30–60 min,
DHMZ 10 min, pristranost 12 h) i primjenjuje korekcije u **ovom redoslijedu**:

1. `debiasHourly` / `debiasDaily` — ukloni naučenu pristranost modela
2. `observationDelta` + `correctHourly` — pripiši ostatak razlike mjerenju

Redoslijed je bitan: obrnuto bi se ista greška ispravila dvaput. Hero i prvi
sat u traci koriste **isti** `delta`. `fetchForecast` spaja ECMWF (temperature)
i `best_match` (UV/vidljivost/zadnja 2 dana). Svi vanjski izvori sigurni na
neuspjeh.

**Osvježavanje popisa** (8.8.2026.): `useRefreshSavedCities` u korijenu
aplikacije — jedan multi-koordinatni `fetchCurrentBatch` (spremljeni +
odabrani + povijest, samo već keširana mjesta) pri pokretanju i povratku,
prag 10 min. Upisuje samo `current` kroz `refreshCurrent` u `lastWeather`.

**Karta**: vlastiti tok (`MAP_LAYERS`, `mapLayerTileUrl`, `useTimelineHours`).
MapLibre GL, jedna živa karta, pločice `beforeId` ispod imena. Animacija
izmjenom `raster-opacity` na montiranim susjedima. `maxUserZoom` po sloju
na kameri (radar 9). Radar 512 px; `temp_new` se crta dvaput (`doubleUp`).
Vjetar: strujnice iz Open-Meteo mreže + sijanje dodatnih početaka; skala
bijelo→jantarno. **Vremenska crta** (`MapTimeline`): `useTimelineHours`
nosi `past_days=1, forecast_days=4` (5 dana); `dayJumps` daje dugmad
(`-24 h · Sada · Sutra · datum`), klizač pokriva SAMO odabrani dan,
`playRange` u `map.tsx` vrti odabrani dan. OWM pločice se mijenjaju svaka
3 h, vjetar svaki sat.

**Radar je LibreWXR** (9.9.2026.): `radar_plus` je JEDINI radarski sloj i
zove se „Radar"; stari `radar` (RainViewer) je ZAKOMENTIRAN u `MAP_LAYERS`,
a klijent `rainviewer.ts`, hook `useRadarFrames` i grana u `mapLayerTileUrl`
ostaju netaknuti (vraćanje = otkomentiravanje jednog unosa). Oba klijenta
vraćaju IDENTIČAN oblik (`{host, frames}` s `isNowcast`), pa `map.tsx` bira
izvor na jednom mjestu i crta/player/pločice rade bez izmjene — oznaka
„prognoza" i sidro „sada" su već postojali. **Izvor okvira i unos sloja se
moraju poklapati** (pločica se gradi iz `host` tog izvora) — i u
`RadarPreviewCard` na početnoj.

**Izgled**: `weatherLook.ts` je izvor istine — `weatherGradient` (plavo nebo,
isto kao widget), `backdropEffects` (WMO 1 = zrake + rijetki oblaci; grmljavina
= oblaci + kiša + bljeskovi), `heroAccent` (zlatna/hladna), `stripAccent`,
`ACCENT_UI`/`ACCENT_STEEL`/`ACCENT_CORAL`, `readableOn`. `HeroBackdrop` +
`components/backdrop/` (petlje u skupinama, faza umjesto odgode, prorjeđivanje
na slabijim uređajima kroz `IS_LOW_END`/`thin` u `shared.ts`).

**Pelud** (6.9.2026.): `fetchAirQuality` traži SATNI niz za 3 dana i
`pollenDaysFromHourly` ga svodi na DNEVNI PROSJEK po vrsti (peludomjer je
24-satni prosjek — ne max, ne tekući sat). `PollenDay { date, levels,
graded?, source }`; `pollenSpecies(levels, graded)` — gotov razred pobjeđuje
nad pragovima. **Štampar** (`api/stampar.ts`) je razvojni izvor: u
`useWeatherBundle` drugi upit `enabled: __DEV__ && !!nearestStamparCity`
(≤ 40 km), ključ po gradu, keš 6 h; kad vrati dane, zamjenjuje CAMS-ove.
Ekran peludi i kartica čitaju `day.graded` i `day.source` (napomena).

**Radar kao sudac za oborinu** (10.9., prepisano 11.9.2026.):
`api/radarSample.ts` dohvati RainViewer pločicu (shema 2, z=7), dekodira
PNG čistim JS-om (`fflate`) i vrati `sampleStats` nad krugom od **3 km** —
`maxDbz`, percentile (median, p75, p90, p95), pokrivenost po četiri praga,
težinski prosjek po udaljenosti i težište odjeka, sve u JEDNOM prolazu
kroz piksele. `fetchRadarCoverage` čita `/v2/coverage` (prozirno = radar
postoji). `hooks/useRadarEcho` to veže na `useRadarFrames` (provjera
svakih 90 s): odjek po OKVIRU (ne ide na disk), pokrivenost po PLOČICI
(dan u memoriji, smije na disk), plus PRETHODNI okvir i `persistence` iz
niza.

`utils/radarJudge.ts` je čist sudac. `judgeCurrentCode` uzima kod postaje
(+ starost + UDALJENOST), kod modela, naoblaku, temperaturu, odjek,
postojanost i clutter, pa vraća `{ code, source }`. Redoslijed odluka:
pokrivenost → starost okvira → suho (< 20 dBZ obara sve) → nebo/tlo (jaka
jezgra mora biti ŠIROKA) → postojanost → median → postaja na istoj točki →
grmljavina → oborina po Marshall-Palmeru. Kad radar ODUSTANE, model NE
smije tvrditi kišu (`stationThenSky`) — samo bliska svježa postaja.

`useWeatherBundle.core` ga zove; rezultat ide u `current.code` i u prvi
stupac trake (`withCurrentCode`). Ikone, ambijent i tekstovi se ne diraju:
čitaju `code` kao dosad. Pragovi i zašto — vidi odluke i zapis.

**V2 engine u SHADOW MODU** (11.9.2026.): `utils/radarFeatures.ts`
(postojanost, trend, treperenje, motion iz pomaka težišta, `clutterScore`)
+ `utils/currentWeatherV2.ts` (confidence umjesto hard switcha, razdvojeni
`precipitation` / `intensity` / `type` / `sky`, `CurrentWeatherResult` s
`evidence` i `diagnostics`). Računa se PARALELNO u `__DEV__` i samo se
logira (`[v2]`), bez ijednog dodatnog zahtjeva — `RadarEcho` od 11.9. nosi
cijele statistike. **V1 i dalje odlučuje**; V2 preuzima tek kad brojke iz
Hrvatske to pokažu (vidi Current Status).

**Traka sati se čisti od nemoguće oborine** (`dropImpossiblePrecip` u
`api/weather.ts`): model zna tvrditi kišu uz vedro nebo (mreža 25 km
razmaže oborinu iz susjedne ćelije) i visok postotak uz 0 mm. Kod se
zamjenjuje nebom iz naoblake, postotak se stišće na `cloudCover / 3`.
Primjenjuje se PRIJE `withCurrentCode`, na `hourly` i `hourlyAll`.
Od 12.9. prima `wetNowIso`: kad je RADAR presudio oborinu, tekući sat se
NE dira — nad planinom je niska naoblaka greška modela, ne dokaz suhoće.

**Vrijeme je u zoni MJESTA, ne uređaja** (12.9.2026.): `timezone=auto` je
na svim Open-Meteo pozivima, pa satni ključevi dolaze u vremenu grada.
`placeNow(now, utcOffsetSeconds)` u `utils/format.ts` pomiče „sada" u tu
zonu, i kroz njega ide SVAKA usporedba „je li sat prošao" — `futureHours`,
rez u `fetchForecast`, `withCurrentCode`/`withPastCodes`, `wetNowIso`.
Pomak putuje `fetchForecast` → `WeatherBundle.utcOffsetSeconds` →
`Hero`; `zoneLabel` ispisuje `UTC−4` uz sat, ali SAMO za strani grad.

**Vjerojatnost oborine je iz `best_match`**, ne ECMWF-a
(`HOURLY_FROM_FALLBACK` u `api/openMeteo.ts`, uz `uv_index` i
`visibility`). ECMWF ju sustavno napuhuje (+18.2 pb na 288 sati); sve
ostalo — temperatura, mm, kod, naoblaka — ostaje ECMWF-ovo.

**Brzina i keš** (10.9.2026.): do početne se s podekrana ide SAMO
`router.back()`/`dismissAll()` — `navigate` premješta, ne popa (vidi
odluke). `index.tsx`: skeleton je PREKRIVAČ (`switching` = `shownPlaceId
!== place.id`, izvedeno u renderu), sadržaj ostaje montiran; `belowFold`
jednom, iza prijelaza. `useWeatherBundle`: `core` (current + forecast +
dhmz + bias; čeka DHMZ i bias kad keš postoji) → `fresh` (+ AQI, more,
pelud), pa dodaci ne mijenjaju reference jezgre; `memo(Hero)`. Disk:
`experimental_createQueryPersister` u `_layout.tsx` (pravila i test u
`utils/queryPersist.ts`), `gcTime` 60 min, `persisterGc` pri pokretanju;
`lastWeather` je produktni keš, obrezan u `save` (`pruneBundles`). Perf
oznake `utils/perf.ts` (dev-only) od `search:tap` do `home:content`.

**Web kamere** (9.9.2026.): `windyWebcams.ts` → `useWebcams(lat, lon, name)`
→ `WebcamCard` u sekciji ispod karte, i `app/(screens)/cameras.tsx` za
popis (otvara se SAMO kad mjesto ima više od jedne vlastite kamere).
`pickWebcams` bira po IMENU pa po udaljenosti; bez ključa
(`EXPO_PUBLIC_WINDY_API_KEY`) sekcije nema. **Iznimka od pravila o
parametrima:** ekran ima vlastiti upit jer token slike istječe za 10 min
(vidi Recent Decisions). Slike, ne video.

**Mjereno nebo** (9.9.2026.): `dhmzTextToCode` u `weatherCodes.ts`
preslikava DHMZ opis („pretežno oblačno") u WMO kod, uz vlastiti razred
**3.5**. Primjenjuje se u `useWeatherBundle` gdje se `current` sastavlja —
najbliža postaja do `CONDITION_RANGE_KM` (25) pobjeđuje model. Svaka
usporedba s naoblakom u kodu mora biti RASPON (`code >= 3 && code < 4`), ne
`=== 3`.

**Lokacija**: `placeNameFrom` u `useLocation` bira ime mjesta iz reverse
geocodea i ODBIJA upravne jedinice (sufiksi županija/county/Landkreis…).

**Donji rub**: `useBottomInset` (Android-only safe-area dno, edge-to-edge)
dodan na padding svakog ScrollViewa i ladice.

**Detalji dana** (7.9.2026.): red u `DailyList` upiše REFERENCU na
`days/hourly/place` u `useDayDetails` pa navigira na `/day` (kroz parametar
samo `date`). `day.tsx` je `formSheet` [0.75, 1] s vlastitim naslovom, X-om
i čipovima dana; sadržaj OBAVEZNO oblika header (`collapsable={false}`) +
jedan ScrollView — nativna RNS korekcija (vidi Recent Decisions).

**Upozorenja** (`useWarnings`): HR ručna tablica 14 EMMA regija, Europa
geokodiranje + filtar države.

**Widgeti** dijele `widgetData.ts` (bundle → plosnati propovi; `hasGusts`,
nikad `null`). iOS: `expo-widgets`, propovi unaprijed kroz `updateTimeline`
(App Group), raspored CIJEL u `'widget'` funkciji, ambijent vezan `frame` +
`clipped` na `widgetFamily`. Android: `react-native-android-widget`, crtež u
`android/render.tsx` s DVA pozivatelja — headless handler (sustav) i
`pushWidget` → `requestWidgetUpdate` (promjena grada/podataka). `pushWidget`
se odgađa `InteractionManager`-om iza prijelaza.

## Files

```
app/_layout.tsx       Drawer (ladica zdesna); useRefreshSavedCities u korijenu
app/(screens)/        Stack: index (korijen), search, warnings, pollen,
                      day (sheet detalja dana iz 14-dnevne liste),
                      cameras (popis web kamera u blizini),
                      preview, settings, sources — swipe-back radi jer je
                      početna korijen stacka; search/pollen/cameras montiraju
                      liste kadar nakon ekrana
app/map.tsx           fullscreen karta, izvan stacka
src/api/              openMeteo (+fetchCurrentBatch, pollenDaysFromHourly), dhmz,
                      meteoalarm(+Europe), rainviewer, owm, mapLayers, windGrid,
                      windStyle, bias, weather, client (+fetchText headers), types,
                      stampar (RAZVOJNI izvor peludi; __fixtures__/stampar-zagreb.html
                      je isječak prave stranice za test parsera),
                      radarSample (SUDAC: RainViewer pločica → sampleStats
                      = percentili + pokrivenost po 4 praga + težine po
                      udaljenosti + težište, sve u JEDNOM prolazu; PNG
                      dekoder u čistom JS-u, coverage; __fixtures__/radar/
                      su PRAVE pločice + expected.json iz sharpa),
                      librewxr (radarski SLOJ na karti — nowcast +60 min,
                      blizanac rainviewera jer je oblik odgovora isti),
                      windyWebcams (web kamere; hasWindyKey, pickWebcams —
                      slike, ne video)
src/store/            settings, cities, lastWeather (+refreshCurrent,
                      pruneBundles, latestGpsBundle), geocodeCache (trajni
                      keš geokodiranja regija za Meteoalarm),
                      searchHistory, mapTimeline, dayDetails (memorijski
                      izvor za sheet detalja dana, bez persista)
src/components/       Hero, HeroBackdrop, QuipLine (domaća rečenica NA
                      heroju), HourlyStrip, BentoGrid (Card/Value/
                      Compass/PressureGauge), WarningBar, Wordmark, WindFlag,
                      MapPin, Skeleton, SunCycle, DailyList, DayDetails,
                      DhmzCard, MapTimeline (+dayJumps, klizač po danu),
                      WebcamCard (najbliža kamera ispod karte),
                      LayerChips, LayerLegend...
src/components/backdrop/  RaysLayer, RainLayer, SnowLayer, CloudsLayer,
                      FogLayer, LightningLayer + shared.ts (IS_LOW_END, thin,
                      SPEED_BY_INTENSITY + DENSITY_BY_INTENSITY)
src/hooks/            useWeatherBundle (+Štampar iza __DEV__, radar sudac),
                      useRadarEcho (odjek + pokrivenost nad mjestom),
                      useRefreshSavedCities, useWarnings, useNow, useRadarFrames,
                      useTimelineHours, useWindGrid, useWindStyle,
                      useLocation (+placeNameFrom, placeNameWithDistrict —
                      četvrt u ZG/ST/RI/OS), useBottomInset, useWebcams
src/utils/            radarJudge (V1 sudac za current.code — ODLUČUJE u
                      appu; cijeli raspon po Marshall-Palmeru, jaka jezgra
                      mora biti široka, postojanost, median, domet postaje;
                      svi pragovi IZMJERENI),
                      radarFeatures (temporalni: postojanost, trend,
                      treperenje, motion iz težišta, clutterScore),
                      currentWeatherV2 (V2 engine — SHADOW, ne odlučuje),
                      perf (perf oznake, no-op u produkciji), queryPersist
                      (što smije na disk; testirano),
                      weatherCodes (+dhmzTextToCode, razred 3.5),
                      weatherLook (+PollenGraded, 10 vrsta peludi,
                      cloudDensity, noćne palete),
                      emmaRegions, quips (domaće rečenice o danu — dalmatinski,
                      zamjena za OBRISANI AI sažetak), format
                      (+futureHours, placeSubtitle), geo, dayParts
src/i18n/hr.ts        SVI UI stringovi (kanonski rječnik = izvor tipa)
index.js              registrira Android widget zadatak pa diže expo-router
src/widgets/          iOS: BurinWidget, widgetData (most, dijeli i Android),
                      props/iconNames, widgetIcons
src/widgets/android/  BurinAndroidWidget, widgetTaskHandler, render (zajednički
                      crtež za handler i requestWidgetUpdate)
assets/widget/        20 PNG ikona widgeta
scripts/generate-icons.mjs         ikone aplikacije (varijanta 7)
scripts/generate-widget-icons.mjs  ikone widgeta
scripts/radar-replay.mjs           V1/V2 protiv GeoSphere Austria (mm/10 min)
scripts/radar-tune.mjs             pretraga pragova na spremljenom datasetu
scripts/compare-vrijemeradar.mjs   usporedba s vrijemeradar.hr, 113 mjesta
scripts/collect-dataset.mjs        JSONL dataset za budući vlastiti model
scripts/compare-hr.mjs             mi vs yr/WeatherAPI/ECMWF, ISTINA = DHMZ
scripts/compare-apps.mjs           isto, ISTINA = METAR (cijela Europa)
scripts/probe-place.mjs            jedna točka: sve što sudac vidi + koja grana
scripts/rain-check.mjs             nađe gdje u Europi PADA pa ondje sudi
scripts/compare-prob.mjs           ECMWF vs best_match (slaganje + Brier)
scripts/check-cleaning.mjs         griješi li dropImpossiblePrecip
data/                 LOKALNO, u .gitignoreu — mjerni podaci (*.jsonl)
docs/                 LOKALNO, u .gitignoreu — zapisi odluka su radni
                      materijal; opće odluke žive OVDJE i u README-u
```

**Razvojni ekran:** Postavke → *Pregled pozadina po vremenu* (`/preview`)
prikazuje svih 15 kombinacija vremena s pravim `HeroBackdrop`-om.
