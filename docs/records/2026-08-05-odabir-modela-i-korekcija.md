# Odabir modela prognoze i korekcija temperature

**Datum:** 5.8.2026.
**Status:** Primijenjeno — **djelomično ispravljeno**, vidi
[ispravak](2026-08-05-ispravak-referentnog-modela.md)

> **ISPRAVAK (5.8.2026., isti dan).** Dvije tvrdnje u ovom zapisu su naknadno
> izmjerene kao netočne:
>
> 1. **"Pogrešna ćelija mreže na 6 m"** nije uzrok. ERA5 arhiva na *istim*
>    koordinatama Starigrada zna ohladiti jutro (04–08 h: 22.3 / 21.9 / 22.0 /
>    23.8 / 25.5 °C), a ECMWF protiv arhive promašuje −0.04 °C na prošlim
>    danima. Da je ćelija problem, griješila bi i arhiva — dijeli istu mrežu.
> 2. **"Uz ECMWF je naučeni bias ≈ 0"** — nije. Bio je +1.88 °C, ali izmjeren
>    na *pogrešnom modelu*: `learnModelBias` je zvao Open-Meteo bez `&models=`
>    pa je učio `best_match`, dok je prikaz bio ECMWF.
>
> Također: V&R **ne** prikazuje Zemunik za Starigrad. Prikazuje 21 °C, što je
> ispod svake okolne postaje (Zemunik 21 °C, Puntamika 26.3 °C) — dakle
> vlastita modelska procjena, ne preslikana postaja.

## Problem

Jutarnje temperature u zaleđu i pod planinom bile su 3–7 °C previsoke u odnosu
na Vrijeme&Radar, iOS Weather i stvarna DHMZ mjerenja. Primjer Starigrad
(4.–5.8.2026.): aplikacija 28 °C za jutro, V&R 21 °C, arhiva stvarnih
mjerenja prosjek 21.5 °C.

## Uzrok (izmjereno, ne pretpostavljeno)

Open-Meteo za Starigrad uzima ćeliju mreže na **6 m nadmorske visine** i
tretira ga kao morsku točku. More je noću ~27 °C i drži zrak, pa model ne
dopušta noćno hlađenje pod Velebitom.

Presudni dokaz: **isti model za Zemunik** (30 km dalje, 76 m) **daje 21 °C** —
model zna ohladiti taj kraj, samo ne na toj ćeliji. Dnevna amplituda to
izdaje: izmjereno u Starigradu 10–11.7 °C, model daje ~6 °C.

## Odluke

### 1. Glavni model: ECMWF IFS (`ecmwf_ifs025`)

Izmjereno 6 modela × 12 mjesta protiv arhive stvarnih jutarnjih minimuma
(12.–30.7.2026.):

| model | promašaj minimuma |
|---|---|
| **ECMWF IFS** | **0.97 °C** |
| GFS | 1.09 °C |
| UKMO | 1.18 °C |
| KNMI | 1.55 °C |
| best_match (prije) | 1.83 °C |
| ICON-EU | 1.84 °C |

ECMWF najbolji na 8 od 12 mjesta; najveća razlika upravo gdje je aplikacija
griješila (Starigrad 0.5 vs 2.8 °C, Split 0.4 vs 2.7 °C). Odmak od V&R za
Starigrad pao s 5.3 °C na 3.0 °C.

ECMWF ne daje UV indeks ni vidljivost i pokriva 14 od 16 dana, pa se ta
polja i zadnji dani dopunjuju iz `best_match` poziva (`mergeForecasts`).

### 2. Naučena pristranost modela iz arhive (`src/api/bias.ts`)

Usporedi što model tvrdi za protekla 3 tjedna s arhivom stvarnih vrijednosti,
razdvojeno na `earlyNight` (22–03 h), `dawn` (04–08 h) i `day` (09–21 h).
Jutarnja se uči iz **dnevnih minimuma**, ne prosjeka sati (prosjek zamuti
vrh krivulje: 2.2 vs 2.8 °C za Starigrad).

Prigušenje po **dosljednosti** (`|prosjek| / prosjek |promašaja|`) umjesto
fiksnog faktora: dosljedna greška se primijeni gotovo cijela, šum se uguši.
Fiksni faktor 0.75 je gušio stvarnu grešku (Starigrad ostajao 2 °C pretopao).

Uz ECMWF je naučeni bias ≈ 0 — dokaz da je ECMWF dobro kalibriran; korekcija
ostaje za mjesta gdje ipak griješi.

### 3. Korekcija "sada" mjerenjima DHMZ postaja (`src/api/weather.ts`)

Prosjek do 3 okolne postaje, vagano po udaljenosti (domet 40 km, pomak
ograničen 1–5 °C ovisno o blizini). Mjereno leave-one-out na 62 postaje:
prosjek 3 postaje 1.73 °C, samo najbliža 1.91 °C, čisti model 1.85 °C.

Ista razlika prenosi se na satnu krivulju (`correctHourly`) — puna snaga
noću, 35 % danju, blijedi nakon 8 h do nule na 30 h. Bez toga hero i prvi
sat u traci pokazuju različit broj.

## Odbačeno (i zašto)

**Učenje pristranosti iz DHMZ postaja.** Zvuči logično (postaje mjere
stvarnost, arhiva dijeli grubu mrežu s prognozom), ali izmjereno da
**pogoršava**: u međuterminima DHMZ objavi samo ~29 postaja, pa su najbliže
Starigradu Gospić i Plitvice (600+ m) i svjetionik Veli Rat (na moru). Model
je tamo prehladan → naučilo se −0.9 °C i Starigrad bi postao 30 °C. Greška
modela se ne prenosi preko reljefa.

**Podešavanje elevacije / `cell_selection=land`.** Testirano `elevation=80`,
`elevation=150`, pomicanje točke 1–3 km u kopno: pomak samo 0.5–0.9 °C.

**ICON-EU kao glavni model.** Bio je najtočniji protiv trenutnih DHMZ
mjerenja (1.69 vs 1.95 °C), ali za jutarnje minimume je među najgorima
(1.84 °C). Kratko primijenjen pa vraćen.

**Puna bias korekcija.** Mjereno: bez korekcije 1.76 °C, puna 1.86 °C
(pojačava šum), polovična 1.67 °C. Zato prigušenje po dosljednosti.

## Što ostaje otvoreno

~~U 06–08 h Starigrad je još 3–5 °C iznad V&R. Uzrok je ista pogrešna ćelija
na 6 m koju nijedan model ne zaobilazi za tu točku. Jedini put dalje: za
obalna mjesta pod planinom tražiti prognozu s točke u kopnu ili s najbliže
postaje — ali to znači prikazivati vrijeme *drugog mjesta* (upravo to radi
V&R, koji za Starigrad prikazuje Zemunik).~~

**ZATVORENO kao pogrešno postavljeno** (5.8.2026.). Ćelija nije uzrok (vidi
ispravak na vrhu). Prognoza s kopnene točke je izmjerena i odbačena: 5 km u
kopno od Starigrada skače na 623 m n.v. i daje 20.9 °C — to je vrijeme
Velebita, ne Starigrada. Blaga kopnena točka na toj obali ne postoji.

Pravi preostali odmak je **drugdje**: nakon ispravka referentnog modela jutra
su u Lici još 4–6 °C iznad V&R (Otočac 6.06, Gospić 3.78 °C MAE). Ta razlika
nije dokazana greška — V&R tamo prognozira hladnija jutra od ECMWF-a, a koji
je od njih bliži istini zna se samo naknadno, protiv arhive.

## Metodologija

Svi brojevi su izmjereni, ne procijenjeni. Korištene tehnike:

- **leave-one-out** — svaka DHMZ postaja se tretira kao "grad" bez vlastite
  postaje, korigira se ostalima, rezultat se mjeri protiv njenog termometra
- **kronološko razdvajanje** — pristranost se uči na starijim danima,
  provjerava na novijim (nikad na istima)
- **neovisna kontrola** — ECMWF kao provjera za mjesta gdje je imao nultu
  pristranost

## Zamke otkrivene u stvarnom radu

- DHMZ feed **nije stabilan**: 74 postaje u 22 h, 38 u 23 h, 29 u ponoć;
  Split-Marjan povremeno nestane pa se vrati
- DHMZ feed jednom vratio **nevaljan XML** (pročitan usred objave) —
  obrambeni parser (`parseDhmzXml` → `null`) se isplatio u praksi
- Marine API za kopno vraća `sea_surface_temperature: null`, ne grešku —
  bez izričite provjere Zagreb bi prikazao "0°" temperature mora
- ERA5 arhiva zaostaje ~6 dana; ERA5 i ERA5-Land daju iste vrijednosti za
  ove točke, pa se ne mogu koristiti kao "model vs istina"
