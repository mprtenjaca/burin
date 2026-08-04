# Ispravak referentnog modela za učenje pristranosti

**Datum:** 5.8.2026.
**Status:** Primijenjeno
**Ispravlja:** [2026-08-05-odabir-modela-i-korekcija.md](2026-08-05-odabir-modela-i-korekcija.md)

## Problem

`learnModelBias` je zvao Open-Meteo **bez `&models=`** parametra, pa je
dobivao `best_match`. Prikaz je istovremeno koristio `ecmwf_ifs025`
(`PRIMARY_MODEL` u `openMeteo.ts`). Učila se pristranost jednog modela i
oduzimala od brojeva drugog modela.

Razlika nije mala:

| slot | `best_match` (što se učilo) | `ecmwf_ifs025` (što se prikazivalo) |
|---|---|---|
| dawn (04–08) | **+1.88** | −0.03 |
| earlyNight (22–03) | +2.17 | −0.12 |
| day (09–21) | −0.19 | −0.13 |

Bug je bio nevidljiv jer je na Starigradu — mjestu po kojem se aplikacija
mjerila — **slučajno pomagao**: oduzimao je 1.88 °C i vukao jutra prema
Vrijeme&Radaru. Zato je prethodni zapis zabilježio "uz ECMWF je naučeni bias
≈ 0" i odmak od 3.0 °C kao uspjeh.

## Zašto prethodna dijagnoza nije bila točna

Zapis je uzrok pripisao "pogrešnoj ćeliji mreže na 6 m" koja Starigrad tretira
kao morsku točku. To se ne slaže s mjerenjem: **ERA5 arhiva na istim
koordinatama zna ohladiti Starigrad.**

| sat | 04 | 05 | 06 | 07 | 08 |
|---|---|---|---|---|---|
| arhiva (ERA5, pros. 12.–30.7.) | 22.3 | 21.9 | 22.0 | 23.8 | 25.5 |
| V&R za 5.8. | 23 | 22 | 21 | 22 | 25 |
| ECMWF prognoza za 5.8. | 24.8 | 24.9 | 25.9 | 27.3 | 28.8 |

Arhiva i prognoza dijele istu grubu mrežu. Da je ćelija uzrok, arhiva bi
griješila jednako — ne griješi. ECMWF protiv arhive na prošlim danima
(20.–30.7.) promašuje **−0.04 °C** u prosjeku, nikad više od 1.5 °C ni jedan
dan. Model na toj točki nije pristran.

A 24.8 °C za 5.8. nije artefakt: kroz srpanj su jutra stvarno bila 17–23 °C,
5.8. je bio topliji zrak.

## Odluka

`PRIMARY_MODEL` se **izvozi** iz `openMeteo.ts`, a `bias.ts` ga uvozi i dodaje
na oba forecast poziva (satni i dnevni). Arhivski pozivi ostaju bez modela —
arhiva je mjerenje, ne prognoza.

Konstanta se dijeli namjerno, ne duplira: izmjena modela na jednom mjestu ne
smije razdvojiti prikaz od učenja. Test `learnModelBias — referentni model`
provjerava da svaki forecast URL nosi `models=${PRIMARY_MODEL}`.

## Izmjereno — 13 mjesta, 7 sati (noć, jutro, dan)

Referenca: satna prognoza V&R-a za 5.8.2026., prepisana s njihovih stranica.
Mjesta od Slavonije i Zagorja do Like, Istre i Dalmacije.

| | prosječni MAE prema V&R |
|---|---|
| ECMWF čist (bez korekcije) | 2.65 °C |
| **prije — bias iz `best_match`** | **2.66 °C** |
| **poslije — bias iz `ecmwf`** | **2.40 °C** |

Sadašnje stanje prije ispravka **nije** bilo bliže V&R-u nego nikakva
korekcija. Ključ je u predznaku: naučeni `best_match` bias je bio pozitivan na
jugu (Starigrad +1.88, Split +2.18) ali **negativan u Lici, Istri i Zagorju**
(Otočac −1.60, Pula −1.47, Varaždin −1.35) — tamo je jutra *grijao*.

Samo jutarnji sati (dawn), MAE prema V&R:

| mjesto | prije | poslije |
|---|---|---|
| Otočac | 8.70 | **6.06** |
| Gospić | 6.78 | **3.78** |
| Varaždin | 6.30 | **4.87** |
| Pula | 6.07 | **4.33** |
| Rovinj | 6.05 | **4.59** |
| Split | 2.88 | **1.10** |
| Starigrad | **1.89** | 3.78 |

Starigrad je jedino mjesto koje ispravkom gubi.

Neovisna kontrola protiv termometra — leave-one-out na 22 DHMZ postaje
(istina = izmjerena temperatura postaje, model na koordinatama postaje):

| | odmak od termometra |
|---|---|
| bez korekcije biasa | 2.61 °C |
| bias iz `best_match` (prije) | **2.97 °C** |
| bias iz `ecmwf` (poslije) | **2.36 °C** |

Ispravak je dakle bliži i V&R-u (2.40 < 2.66) i termometru (2.36 < 2.97).
Stanje prije bilo je gore od nikakve korekcije po obje mjere.

Naučeni dawn bias, prije → poslije: Starigrad 1.88 → −0.04, Otočac −1.60 →
1.04, Varaždin −1.35 → 0.08, Split 2.18 → −0.46, Gospić −0.98 → 2.02.

## Odbačeno (izmjereno)

**Prognoza s kopnene točke** za obalna mjesta pod planinom (izvorni "jedini
put dalje" iz prethodnog zapisa). Pomak od Starigrada prema kopnu:

| smjer / udaljenost | n.v. | dawn min |
|---|---|---|
| 5 km u kopno | 623 m | 20.9 °C |
| 10 km | 943 m | 18.8 °C |
| 15 km | 1106 m | 16.8 °C |

Nema blage kopnene točke — Velebit se digne odmah. Već na 5 km prikazivalo bi
se vrijeme planine, ne mjesta.

**`cell_selection=land`** — ne mijenja ništa (identičan odgovor, elev 36 m).
**`elevation=100`** — 0.4 °C. Potvrđuje prethodni zapis.

**Prosjek modela** (ECMWF+ICON, +GFS, +UKMO) radi *poklapanja* s V&R-om:
udaljava, ne približava (3.83–4.39 MAE vs 3.67 za čisti ECMWF na Starigradu).
Pretpostavka da V&R koristi ICON pa nas prosjek s ICON-om približava njima je
pogrešna — ICON je tamo **najtopliji** model (27.9 °C u 04 h).

**Fiksni jutarnji pomak** kalibriran prema V&R-u. Za Starigrad bi optimum bio
−3.75 °C (MAE 1.48), ali to je konstanta štimana na jedan grad, jedan dan i
šest sati, bez fizikalnog opravdanja i bez dokaza da vrijedi za drugi tip
vremena. Odbačeno.

## Zamke

- `models=best_match` **eksplicitno** daje bit-identičan odgovor kao
  izostavljanje parametra (provjereno na 5 lokacija × 672 sata, max razlika
  0.0000). Bug se dakle nije mogao otkriti usporedbom odgovora — samo
  čitanjem URL-a.
- Komentar u `bias.ts` se pozivao na `learnBiasFromStations`, funkciju koja
  ne postoji (uklonjena je kad je stanično učenje odbačeno). Ispravljeno.
- V&R za Starigrad prikazuje 21 °C, **ispod svake okolne postaje** (Zemunik
  21, Puntamika 26.3, Gospić 23.1, Knin 24.9). Nije preslikana postaja nego
  vlastita modelska procjena — pa ni pretpostavka "V&R prikazuje Zemunik" iz
  prethodnog zapisa ne stoji.

## Drugi ispravak: prigušenje korekcije mjerenjem

Izmjereno na **29 DHMZ postaja** (termin 01 h): ECMWF promašuje termometar za
**+2.24 °C u prosjeku i pretopao je na 25 od 29 postaja** (Gruda +10.2,
Daruvar +9.3, Varaždin +5.5). Kontrola na 3 mjesta gdje je grad ujedno DHMZ
postaja: **V&R je bliži termometru — 0.73 vs naših 2.67 °C.**

`learnModelBias` to ne vidi jer uči protiv ERA5 arhive: na Polači nauči
**+0.14 °C** uz stvarnu noćnu grešku od **+4 °C**. Arhiva zaostaje 6 dana i
sama je model na istoj gruboj mreži. Dakle korekcija mjerenjem je jedina
obrana — a bila je prigušena.

`observationDelta` je množio vagani prosjek s `bestCloseness`, čime se
udaljenost kažnjavala **dvaput**: težina svake postaje već pada s udaljenošću.
Za mjesto s najbližom postajom na 28 km puštalo se samo ~30 % stvarne razlike.

**Primijenjeno:** uklonjeno množenje s `bestCloseness`, domet 40 → 60 km.
Granica pomaka (`cap`) i dalje ovisi o blizini, pa daleka postaja ne može
napraviti velik pomak.

| leave-one-out, 29 postaja | odmak od termometra |
|---|---|
| bez korekcije | 2.579 °C |
| prije (prigušenje, 40 km) | 2.370 °C |
| bez prigušenja, 40 km | 2.090 °C |
| **bez prigušenja, 60 km** | **1.986 °C** |

Prema V&R-u na 14 mjesta: 2.56 → **2.40 °C**.

Domet 60 km je bitan jer DHMZ u međuterminima objavi samo ~29 postaja — na
40 km je pola zemlje ostajalo posve bez korekcije.

**Bez efekta** (ne primijenjeno, YAGNI): dopuštanje aerodromskih postaja,
5 postaja umjesto 3, nacionalni odmak kao rezerva — sve daju istih 1.986 °C.

## Što ostaje otvoreno — Polača (zaleđe uz morsku postaju)

Polača (122 m, Ravni kotari) je **jedina jasna žrtva** drugog ispravka: 4.7 →
5.5 °C odmaka od V&R. Uzrok je nedostatak ispravnog mjerenja, ne logika
korekcije. Postaje koje dobije su **Šibenik 26.2, Veli Rat (svjetionik na
moru) 26.5, Knin 23 °C** — sve toplije od potrebnog, pa svaka varijanta
korekcije Polaču *grije*: prikaže ~25 °C gdje V&R kaže 20.

Zemunik (80 m, 21 °C, 12 km) — jedina ispravna referenca, koju V&R i citira —
**nije u feedu**: u terminu 01 h DHMZ objavi samo 29 postaja. Provjereno je i
da gušćeg DHMZ feeda nema (`hrvatska1_n.xml` i još 6 kandidata → isti 29 ili
404).

Presudan dokaz da je to greška *modela*, a ne mikroklima: na koordinatama
Zemunika, gdje **postoji termometar koji kaže 21 °C**, ECMWF na točnoj
elevaciji (76 m) daje **25 °C**.

### Izmjereno i odbačeno (leave-one-out, 29 postaja)

| varijanta | odmak od termometra |
|---|---|
| težina po visini, skala 100–500 m | 2.462–2.487 °C (**gore** od 2.435) |
| domet 15–25 km | 2.503–2.631 °C (**gore**) |
| domet 40 km + odbaci \|Δh\|>150 m | 2.416 °C (šum; "dobitak" samo zato što odustaje na 14 mjesta) |

**Težina po nadmorskoj visini ne radi** — svaka skala je gora od polazišta, i
što je popravak slabiji, to je bliži nuli (nema optimuma). S 29 postaja i
dometom 40 km ostane 1–3 postaje; kazniti ih po visini znači ostati bez ijedne.

Put dalje: izvor mjerenja s većom gustoćom postaja od DHMZ-ovog trenutnog
termina. Bez podatka iz Ravnih kotara Polača se ne može riješiti vaganjem.
