import type { RadarEcho } from "@/api/radarSample";

/**
 * SUDAC ZA `current.code` — tko odlučuje što heroj piše i crta.
 *
 * Tri izvora, tri različite svježine, tri različite snage:
 *
 *   radar (RainViewer) 1–10 min   JEDINI zna pada li nad TVOJOM točkom
 *   postaja (DHMZ)     30–120 min zna naoblaku, maglu, temperaturu, vjetar;
 *                                 za oborinu je snimka TERMINA, ne „sada"
 *   model (Open-Meteo) 6–12 h     zna trend; za kišu koja pada ne zna
 *
 * ─────────────────────────────────────────────────────────────────────
 * PREPISANO 11.9.2026. — RADAR SUDI KROZ CIJELI RASPON
 *
 * Prva izvedba (10.9.) dala je radaru glas SAMO u krajnostima: < 20 dBZ
 * obori, ≥ 42 podigni, između NE DIRAJ. Markov nalaz kroz prozor sutradan
 * je pokazao zašto je to promašaj:
 *
 *   Zadar, 11.9. 07:50 — nad Puntamikom i Poluotokom lije kiša.
 *   Radar (RainViewer, 5 km oko točke), tri okvira zaredom:
 *       07:30  33 dBZ ( 56 piksela)   ← kiša počinje
 *       07:40  39 dBZ (131 piksela)   ← vrhunac
 *       07:50  37 dBZ (141 piksela)
 *   Postaja Zadar-aerodrom (Zemunik, 10.8 km u unutrašnjosti, termin
 *       07:00, dakle SNIMLJEN PRIJE PRVE KAPI): „pretežno oblačno".
 *   Model ECMWF: kod 1, „pretežno vedro", 0 mm.
 *   App je pisala OBLAČNO — punih 20 minuta, s točnim podatkom u ruci.
 *
 * Uzrok: 33/39/37 padaju u mrtvu zonu. Sudac ih je svakih 10 minuta
 * uredno dohvatio, pogledao i BACIO. Osvježavanje je radilo besprijekorno;
 * ono što je radilo pogrešno bilo je pravilo koje svjež podatak ignorira.
 *
 * Pouka, Markovim riječima: „napravi da pokriva SVE brojeve kad mi mogla
 * padat bilo kakva oborina". Radar sad daje kod kroz cijeli raspon, po
 * FIZICI (Marshall-Palmer), a ne po tri stepenice.
 * ─────────────────────────────────────────────────────────────────────
 *
 * Z–R RELACIJA (Marshall-Palmer, Z = 200·R^1.6) pretvara odjek u mm/h.
 * Ona je razlog zašto pragovi ispod stoje gdje stoje:
 *
 *      dBZ    mm/h    što je to
 *      ───────────────────────────────────────────
 *       20    0.65    slaba kiša (granica vidljivog na tlu)
 *       25    1.33    slaba kiša
 *       30    2.73    umjerena
 *       35    5.62    umjerena/jača
 *       40   11.53    jaka
 *       45   23.68    jaka
 *       50   48.62    pljusak
 *       55   99.85    pljusak — samo konvekcija diže ovoliko
 *
 * ŠTO JE OSTALO OD MJERENJA 10.9.2026. (RainViewer protiv mjerenja na
 * TLU: Austrija 270 postaja s mm/10 min, Slovenija 20 s pojavom, Hrvatska
 * 46 × 2 termina). Ta mjerenja i dalje vrijede i dalje čuvaju od Polače:
 *
 *  - ispod 20 dBZ: od 269 postaja samo 13 (5 %) mokro, i to 0.1 mm.
 *    → OBARANJE OSTAJE. Ovdje radar pouzdano kaže „ne pada".
 *  - nijedna od 290 SUHIH postaja nije prešla 37 dBZ.
 *    → iznad 37 radar je pouzdan i bez ičije potvrde.
 *  - između 20 i 28 ima i jednog i drugog (Loibl 42 uz 0 mm — planinski
 *    clutter; Zadar 19 uz „slaba kiša").
 *    → tu radar govori, ali ga postaja SMIJE nadglasati — ako je BLIZU i
 *      dovoljno svježa da je tu kišu uopće mogla vidjeti.
 *
 * ZAŠTO POSTAJA GUBI GLAS KAD JE STARA: termin je satni i objavljuje se
 * 30–70 min kasnije, a `Termin` je LOKALNI sat. Postaja snimljena u 07:00
 * fizički ne može znati za kišu koja je počela u 07:30. Naoblaka i magla
 * nemaju rok — one se mijenjaju sporo i radar ih ne vidi.
 *
 * ZAŠTO GUBI GLAS I KAD JE DALEKO (11.9.2026.): u istom terminu 08:00 je
 * postaja Zadar (Puntamika, 2.3 km) javila „jaka kiša", a Zadar-aerodrom
 * (Zemunik, 10.8 km) „pretežno oblačno". Oba mjerenja su TOČNA — kiša je
 * zakrpasta. Postaja na 11 km zato ne smije ni tvrditi ni obarati oborinu
 * nad tuđom točkom (`STATION_PRECIP_RANGE_KM`).
 *
 * USPUT NAUČENO: DHMZ ne objavljuje isti skup postaja u svakom terminu —
 * izmjereno istog jutra 48, pa 65, pa 130 postaja. Zadarske postaje u
 * terminu 07:00 NIJE BILO, u 08:00 jest. Zato se najbliža postaja traži
 * iz onoga što feed nosi U TOM TRENUTKU i ništa se ne pamti; a kad
 * najbliža nestane pa se padne na daleku, oborinu preuzima radar.
 *
 * OSTALE POUKE KOJE OVAJ MODUL KODIRA:
 *  - LibreWXR NIJE sudac: 10–25 dBZ jači od RainViewera na istim točkama,
 *    100 % nepomičan odjek nad Dalmacijom (Polača 42 uz suho, RV 17).
 *  - usporedba mora biti u ISTOM trenutku (radar 13:20 vs DHMZ 12:00 dao
 *    je besmislice).
 *  - pravila su ISTA za sve zemlje; Hrvatska samo ima jedan izvor više.
 *  - munje radar ne vidi: grmljavina samo uz potvrdu ili ≥ 55 dBZ.
 */

/** Ispod ovoga radar kaže „ne pada" (95 % suhih od 269 postaja). */
export const DBZ_DRY = 20;
/**
 * Od ovoga radar tvrdi oborinu i BEZ ičije potvrde.
 *
 * 11.9.2026. sa 37 na 28 (≈ 2 mm/h). 37 je bila granica „nijedna od 290
 * SUHIH postaja nije je prešla" — dobra za pitanje „laže li radar", ali
 * previsoka za pitanje „pada li". Izmjereno istog jutra: Zemunik Donji je
 * imao 35 dBZ (5.6 mm/h, dakle pravu kišu), a app je pisala „pretežno
 * oblačno" jer je 35 < 37 pa je svježa postaja pobijedila.
 *
 * 28 dBZ ≈ 2 mm/h: ispod toga su rosulja i virga, gdje radar stvarno ne
 * razlikuje kišu na tlu od one koja isparava; iznad toga pada.
 */
export const DBZ_CERTAIN = 28;
/** Od ovoga „jaka oborina" (~11 mm/h). */
export const DBZ_HEAVY = 40;
/**
 * Od ovoga GRMLJAVINA i bez drugog izvora (10.9.2026., Markov nalaz na
 * Lombardiji).
 *
 * Zašto se ovdje smije izmisliti grmljavina koju radar ne vidi: 55 dBZ je
 * ~100 mm/h, a takvu jezgru fizički diže SAMO konvektivni oblak — slojasta
 * kiša ne dolazi ni blizu. Izmjereno u tom trenutku: Quistello 60 dBZ,
 * Verona 55, a kišomjeri ARPA Lombardije u okolici bilježe **6.4 mm i
 * 5.2 mm u DESET minuta** (Bigarello, Mantova S.Agnese) — 38 mm/h.
 *
 * Ispod 55 pravilo ostaje staro: grmljavina samo uz potvrdu postaje ili
 * modela — munje radar ne vidi i ne smije ih nagađati iz 45 dBZ.
 */
export const DBZ_STORM = 55;
/** Okvir stariji od ovoga se ne uzima — radar tada šuti. */
export const RADAR_MAX_AGE_MIN = 20;
/**
 * Tekst OBORINE s postaje stariji od ovoga ne vrijedi ni kad radar šuti.
 * Naoblaka i magla nemaju rok — one se mijenjaju sporo.
 *
 * 11.9.2026. s 90 na 25 min (Markov zahtjev: „što češća ažuriranja,
 * pogotovo na ovako promjenjivo vrime"). 90 min je bila pretpostavka, i
 * istog jutra se pokazala kao kvar: postaja Zadar u terminu 08:00 javlja
 * „jaka kiša", radar u 08:20 vidi 17 dBZ (0.4 mm/h) — kiša je stala u
 * 08:05, a app bi tvrdila jaku kišu do 09:30.
 *
 * 25 min je izvedeno iz same pojave, ne odabrano: konvektivna ćelija nad
 * jednom točkom traje 10–30 min (danas: 07:30–08:05, dakle 35). Tvrdnja
 * starija od toga opisuje kišu koje više nema.
 *
 * Kad radar RADI, on ionako presuđuje prije ovoga — ovaj rok vrijedi za
 * mjesta bez radarske pokrivenosti i za stare okvire.
 */
export const STATION_PRECIP_MAX_AGE_MIN = 25;
/**
 * Koliko dugo postaja smije „svjedočiti" grmljavinu uz jaku jezgru.
 * Ostaje dulje od obične oborine (45 min): munje radar ne vidi, pa je
 * postaja jedini svjedok, a grmljavinski sustav se zadržava dulje od
 * jedne ćelije. I dalje upola kraće nego prije.
 */
export const STATION_THUNDER_MAX_AGE_MIN = 45;
/**
 * Koliko svježa postaja mora biti da smije reći „ne pada" protiv radara
 * koji vidi oborinu u nesigurnom pojasu (20–28 dBZ).
 *
 * 11.9.2026. s 40 na 20 min. Isti razlog kao gore: 40 min je značilo da
 * termin od 07:00 još u 07:40 obara radar koji gleda kišu koja je počela
 * u 07:30 (Zemunik).
 */
export const STATION_TRUSTED_AGE_MIN = 20;
/**
 * Dokle postaja uopće smije govoriti o TVOJOJ oborini.
 *
 * Markov nalaz 11.9.: postaja Zadar (Puntamika, 2.3 km) javlja jaku kišu
 * dok Zadar-aerodrom (Zemunik, 10.8 km) javlja „pretežno oblačno" — u
 * ISTOM terminu. Oba mjerenja su točna; kiša je jednostavno zakrpasta.
 * Postaja na 11 km zato ne smije ni tvrditi ni obarati oborinu nad
 * tvojom točkom; za to postoji radar, koji gleda upravo nju.
 *
 * 8 km: iznad toga je već drugo mjesto (Zemunik prema Zadru), ispod toga
 * je isti komad neba. Naoblaka i magla ostaju na širem `CONDITION_RANGE_KM`
 * (25 km) — one se mijenjaju na većoj skali od pljuska.
 */
export const STATION_PRECIP_RANGE_KM = 8;
/**
 * NEBO vs TLO: koliko kruga mora biti pod odjekom da se JAKA jezgra
 * proglasi jakom oborinom bez druge potvrde.
 *
 * Izmjereno 11.9.2026. (Markov nalaz „po kamerama uživo kiše tamo nema"):
 *
 *   Metković, jezgra u oblaku — LAŽNA jaka kiša:
 *     08:20  30 dBZ ( 8 %)  08:30  45 (18 %)  08:40  24 ( 6 %)
 *     08:50  49 dBZ (49 %)  09:00  39 (71 %)  09:10  BEZ ODJEKA
 *     postaja Ploče u isto vrijeme: „grmljavina BEZ OBORINA"
 *
 *   Korenica, pravo kišno polje — ISTINITA kiša (Marko: „još pada"):
 *     08:30–09:00  29–37 dBZ na 100 % kruga, stabilno pola sata
 *
 * Jaka jezgra na malom dijelu kruga je vrh konvektivnog oblaka: radar
 * gleda presjek na nekoliko km visine, a grad i krupne kapi tamo ne
 * moraju stići do tla (topao i suh zrak pri tlu, delta Neretve).
 * Široko polje pod odjekom pada.
 *
 * 40 % je ispod Metkovićevih 49 % samo zato što se ONO nije ODRŽALO —
 * pokrivenost sama nije dovoljna, traži se i postojanost kroz dva
 * okvira. Zato prag smije biti nizak: filtrira 8/18/6 % treptaje, a
 * Korenicu (100 %) i Zadar ne dira.
 */
export const WIDE_ECHO_PCT = 40;
/**
 * Koliko okvira mora imati odjek da se OBORINA uopće tvrdi, 0..1.
 *
 * Markov nalaz 11.9.2026.: „Metković sad piše slaba kiša a nema tamo
 * uopće na radaru oborina". Izmjereno u tom trenutku:
 *   09:50 bez odjeka · 10:00 bez · 10:10 bez · 10:20 bez · 10:30 23 dBZ
 *   na 8 % kruga
 * Odjek u JEDNOM okviru od pet, na 8 % kruga — rub nečega ili šum, ne
 * kiša. Postaja Ploče je javljala „umjereno oblačno", a model „slabu
 * kišu" iz runa starog 128 min. App je ipak pisala kišu, jer je pravilo
 * tražilo samo `dBZ >= 20` i ništa više.
 *
 * 0.25 je IZMJEREN na 240 postaja s mjerenjem na tlu (GeoSphere mm/10min):
 *
 *   pravilo                      mokro  suho   F1     lažnih
 *   ────────────────────────────────────────────────────────
 *   dBZ >= 20 (bez uvjeta)        41 %  94 %  0.469     12
 *   dBZ >= 20 I postojanost 25 %  38 %  97 %  0.483      7   ← ovo
 *   dBZ >= 20 I pokrivenost 10 %  27 %  96 %  0.364      8
 *
 * Lažne kiše padaju za 42 % uz gubitak od 3 poena na pogotku — a
 * pokrivenost je kao zaštita mjerljivo slabija od postojanosti.
 *
 * NE PRIMJENJUJE SE kad postojanost nije poznata (jedan okvir, npr. pri
 * prvom pokretanju): radije kiša koje nema nego propuštena kiša koja
 * pada — isto načelo kao kod `prevEcho`.
 */
export const PERSISTENCE_WET = 0.25;
/**
 * Najmanji MEDIAN uzorka da se tvrdi oborina, dBZ.
 *
 * Median je jačina NAD TOČKOM (vidi `intensityDbz` u V2): ne ovisi o
 * polumjeru uzorka, dok `maxDbz` ovisi o jednom pikselu. Uska jezgra 3 km
 * dalje digne max, ali ne median.
 *
 * Izmjeren na 240 postaja s mjerenjem na tlu, uz već postavljenu
 * postojanost:
 *
 *   pravilo                          mokro  suho   lažnih
 *   ─────────────────────────────────────────────────────
 *   dBZ >= 20                         41 %  94 %     12
 *   + postojanost >= 25 %             38 %  97 %      7
 *   + median >= 14 dBZ                38 %  98 %      5   ← ovo
 *
 * Dvije lažne kiše manje BEZ ijednog poena izgubljenog na pogotku.
 *
 * ZAŠTO 14, A NE 15 (isti dan, Markov nalaz „za ZG je sad kiša, mi kažemo
 * oblačno"): prag je prvo bio 15 i Zagreb je pao za JEDNU jedinicu.
 * Izmjereno u tom trenutku — ćelija prolazi preko grada:
 *   13:30  26 dBZ, median 10,  5 % kruga
 *   13:40  32 dBZ, median 23, 68 % kruga
 *   13:50  31 dBZ, median 14, 16 % kruga   ← app je rekla „oblačno"
 * Tri postaje istovremeno: Zagreb-Grič (0.8 km) „potpuno oblačno",
 * RC Puntijarka (10 km) „KIŠA", Zagreb-aerodrom (11 km) „slaba rosulja".
 *
 * Median pada čim rub ćelije uđe u krug, iako još pada. Na austrijskom
 * datasetu su 14 i 15 IDENTIČNI (oba 38 % / 98 %, 5 lažnih), pa brojka ne
 * odlučuje — odlučuje hrvatski slučaj, gdje 14 hvata pravu kišu.
 *
 * Pokrivenost je za istu svrhu izmjerena kao LOŠIJA: svaki prag (2–15 %)
 * gubio je na kiši (38 % → 27 %) bez dobitka na suhom.
 */
export const MEDIAN_WET_DBZ = 14;
/**
 * Postaja BLIŽE od ovoga smije oboriti radar bez obzira na jačinu odjeka.
 *
 * Markov nalaz 11.9.2026. (usporedba na 112 mjesta): Senj — radar 33 dBZ
 * postojanih 80 %, ali odjek pokriva samo 8 % kruga, a DHMZ postaja je
 * **400 metara** daleko i javlja „pretežno oblačno". To je Velebit: uska,
 * postojana jezgra nad brdom, klasičan orografski odjek.
 *
 * Pravilo `DBZ_CERTAIN` (28) tu ne pomaže jer je odjek jači od toga.
 * Ali postaja na 400 m mjeri ISTU točku — nema prostorne nesigurnosti
 * koja je 8 km dalje stvarna (Puntamika lije, Zemunik suh). Zato unutar
 * 2 km njezina riječ vrijedi i protiv jakog odjeka, dok je svježa.
 *
 * 2 km, a ne 5: na z=7 je piksel 0.88 km, pa je 2 km približno isti
 * radarski piksel — dalje od toga postaja i radar više ne gledaju isto.
 */
export const STATION_SAME_SPOT_KM = 2;
/**
 * Koliko stara smije biti postaja NA ISTOJ TOČKI da obori USKI odjek.
 *
 * `STATION_TRUSTED_AGE_MIN` (20) je za nju bio prestrog: DHMZ termin je u
 * trenutku objave već 25–40 min star, pa pravilo praktički nikad nije
 * palilo. Senj 11.9. dvaput: postaja 400 m „pretežno oblačno" stara
 * 28 min, radar 33 pa 48 dBZ na 8–16 % kruga, kamere suho — i oba puta
 * je app pisala kišu jer je 28 > 20.
 *
 * 45 min vrijedi SAMO uz uski odjek: on je i inače sumnjiv (jezgra u
 * oblaku ili brdo). Uz široki odjek postaja mora biti svježa (≤ 20) —
 * kiša je mogla početi nakon termina.
 */
export const STATION_SAME_SPOT_AGE_MIN = 45;

export type CodeSource = "radar" | "station" | "model";

export type JudgeInput = {
  /** Kod iz DHMZ teksta (`dhmzTextToCode`), ili `undefined` kad ga nema. */
  stationCode?: number;
  /** Starost mjerenja s postaje u minutama (`Infinity` kad nije poznata). */
  stationAgeMin?: number;
  /**
   * Udaljenost postaje u km. Odlučuje smije li postaja govoriti o OBORINI
   * (`STATION_PRECIP_RANGE_KM`); za nebo i maglu se ne gleda — one dolaze
   * već filtrirane kroz `CONDITION_RANGE_KM`. `undefined` = ne zna se, pa
   * se postaji vjeruje kao i dosad.
   */
  stationDistanceKm?: number;
  /** Kod iz modela za „sada". */
  modelCode: number;
  /** Naoblaka iz modela, %. */
  cloudCover: number;
  /** Temperatura, °C — bira kišu ili snijeg. */
  temp: number;
  /** Radarski odjek; `undefined` = radar nedostupan. */
  echo?: RadarEcho;
  /**
   * Odjek u PRETHODNOM okviru (~10 min prije). Iz njega se čita
   * POSTOJANOST: jezgra koja se pojavi u jednom okviru i nestane je
   * oblak, a ne kiša na tlu (vidi `WIDE_ECHO_PCT`). `undefined` = ne zna
   * se, i tada se postojanost ne traži (radije kiša koje nema nego
   * propuštena kiša koja pada).
   */
  prevEcho?: RadarEcho;
  /**
   * Udio okvira s odjekom, 0..1 (`radarFeatures.radarTemporal`). Kad je
   * poznata, ima prednost nad izvođenjem iz `prevEcho` — više okvira daje
   * bolju sliku. `undefined` = ne zna se, i tada se ne obara.
   */
  persistence?: number;
  /** Ima li radar nad točkom (RainViewer coverage). Bez toga radar šuti. */
  covered?: boolean;
  /** Sada, epoch ms. */
  nowMs: number;
};

export type Judged = { code: number; source: CodeSource };

export const isThunder = (c: number) => c >= 95 && c <= 99;
export const isFog = (c: number) => c === 45 || c === 48;
export const isPrecip = (c: number) => (c >= 51 && c <= 67) || (c >= 71 && c <= 86) || isThunder(c);
export const isCloudCode = (c: number) => c >= 0 && c < 4;

/**
 * Marshall-Palmer: Z = 200·R^1.6 → mm/h iz dBZ. Služi i kao dokumentacija
 * pragova i kao provjera u testu (nitko da ne pomakne prag „po osjećaju").
 */
export function rainRateFromDbz(dbz: number): number {
  return Math.pow(Math.pow(10, dbz / 10) / 200, 1 / 1.6);
}

/**
 * Naoblaka u WMO kod, s vlastitim razredom 3.5 („pretežno oblačno") koji
 * aplikacija već ima. Granice su na jednakim koracima kroz pet razreda.
 */
export function cloudCodeFromCover(pct: number): number {
  if (pct <= 12) return 0;
  if (pct <= 37) return 1;
  if (pct <= 62) return 2;
  if (pct <= 87) return 3.5;
  return 3;
}

/**
 * KOD OBORINE IZ ODJEKA — pokriva SVE vrijednosti od `DBZ_DRY` naviše, ne
 * samo krajnosti. Snijeg umjesto kiše ispod 1 °C; ledena kiša se ne
 * pogađa iz radara (zahtijeva profil temperature po visini koji nemamo).
 *
 * Granice su Z–R, zaokružene na WMO stepenice koje aplikacija ima:
 *   20–27 dBZ  (0.65–1.8 mm/h)   → 61 slaba kiša   / 71 slab snijeg
 *   28–39 dBZ  (2.0–10.9 mm/h)   → 63 kiša         / 73 snijeg
 *   ≥ 40 dBZ   (11.5 mm/h+)      → 65 jaka kiša    / 75 jak snijeg
 */
export function precipCodeFromDbz(dbz: number, temp: number): number {
  const snow = temp <= 1;
  if (dbz >= DBZ_HEAVY) return snow ? 75 : 65;
  if (dbz >= 28) return snow ? 73 : 63;
  return snow ? 71 : 61;
}

/**
 * Smije li postaja uopće govoriti o OBORINI: mora biti i dovoljno svježa
 * i dovoljno blizu. Za nebo i maglu ovo se ne pita.
 */
function stationMayClaimPrecip(i: JudgeInput): boolean {
  const fresh = (i.stationAgeMin ?? Infinity) <= STATION_PRECIP_MAX_AGE_MIN;
  const near = (i.stationDistanceKm ?? 0) <= STATION_PRECIP_RANGE_KM;
  return fresh && near;
}

/** Postaja i model — ali OBORINA s postaje ima i rok i domet. */
function stationThenModel(i: JudgeInput): Judged {
  const s = i.stationCode;
  if (s !== undefined) {
    if (isPrecip(s) && !stationMayClaimPrecip(i)) {
      return { code: i.modelCode, source: "model" };
    }
    return { code: s, source: "station" };
  }
  return { code: i.modelCode, source: "model" };
}

/** Nebo bez oborine: postaja ako govori o nebu ili magli, inače model. */
function skyOnly(i: JudgeInput): Judged {
  const s = i.stationCode;
  if (s !== undefined && (isFog(s) || isCloudCode(s))) return { code: s, source: "station" };
  return { code: cloudCodeFromCover(i.cloudCover), source: "radar" };
}

/**
 * RADAR RADI, ALI NE POTVRĐUJE OBORINU — tko onda smije tvrditi kišu?
 *
 * Samo BLISKA I SVJEŽA POSTAJA. Model NE.
 *
 * Krk 11.9.2026. (usporedba na 112 mjesta): radar 31 dBZ uz 20 %
 * postojanosti → sudac ga ispravno obori… pa je grana pala na
 * `stationThenModel`, postaja je javljala samo vjetar (kod `undefined`),
 * i MODEL je uskočio sa „slaba kiša". Dakle radar je rekao „nisam
 * uvjeren", a onda smo pustili izvor star dva sata da tvrdi ono što radar
 * od 3 minute nije htio. Isto se dogodilo Metkoviću ujutro (jezgra u
 * oblaku → model 80 „pljuskovi", a kamere suho).
 *
 * Načelo je već zapisano za suhi radar („tko god tvrdi oborinu, u krivu
 * je") — ovdje se samo dosljedno primjenjuje na SVE grane u kojima je
 * radar odustao od tvrdnje: nepostojan, uzak, nizak median. Postaja
 * smije jer mjeri tlo; model ne smije jer ga je radar upravo nadglasao.
 */
function stationThenSky(i: JudgeInput): Judged {
  const s = i.stationCode;
  if (s !== undefined && isPrecip(s) && stationMayClaimPrecip(i)) return { code: s, source: "station" };
  return skyOnly(i);
}

/**
 * Odluka o kodu „sada". Nikad ne baca; bez radara i bez postaje vraća model.
 *
 * Redoslijed je namjeran: prvo grmljavina (najjača tvrdnja i traži
 * potvrdu), pa suho (jedino što radar zna pouzdano oboriti), pa oborina
 * kroz cijeli preostali raspon.
 */
export function judgeCurrentCode(i: JudgeInput): Judged {
  const ageMin = i.echo ? (i.nowMs / 1000 - i.echo.frameTime) / 60 : Infinity;
  const radarSpeaks = i.echo !== undefined && i.covered === true && ageMin <= RADAR_MAX_AGE_MIN;
  if (!radarSpeaks) return stationThenModel(i);

  const dbz = i.echo!.maxDbz ?? -Infinity;

  // ── SUHO: radar ne vidi ništa → tko god tvrdi oborinu, u krivu je.
  if (dbz < DBZ_DRY) {
    const claimed = stationThenModel(i);
    if (isPrecip(claimed.code)) return skyOnly(i);
    return claimed;
  }

  /*
   * ── NEBO vs TLO (11.9.2026.): je li odjek POSTOJAN i ŠIROK?
   *
   * Jaka jezgra koja treperi kroz okvire i pokriva mali dio kruga je vrh
   * konvektivnog oblaka, ne kiša na tlu (Metković: 49 dBZ na 18 % kruga,
   * nestalo u 10 min, postaja „grmljavina BEZ OBORINA"). Za JAKU tvrdnju
   * se zato traži jedno od dvoga: široko polje ili potvrda da je odjek
   * ondje i prije 10 minuta.
   *
   * Slaba i umjerena oborina (< DBZ_HEAVY) ovo ne prolazi — one ionako ne
   * tvrde ništa dramatično, a traženje postojanosti bi propustilo kišu
   * koja upravo počinje (Zadar 07:30, prvi okvir).
   */
  const pct = i.echo!.coverPixels > 0 ? (100 * i.echo!.echoPixels) / i.echo!.coverPixels : 0;
  const wide = pct >= WIDE_ECHO_PCT;
  const persisted =
    i.prevEcho === undefined ||
    (i.prevEcho.maxDbz !== null && i.prevEcho.maxDbz >= DBZ_DRY);
  /*
   * JAKA jezgra je oborina SAMO ako je ŠIROKA (11.9.2026., Markove kamere).
   *
   * Prva verzija je puštala i usku jezgru ako je bila POSTOJANA. Kamere su
   * to oborile na četiri mjesta u jednom danu: Omiš 32 52 49 49 29 dBZ
   * kroz 50 min na 6 % kruga — suho; Senj 48–58 na 16 % — suho; Metković
   * 45 na 18 % — suho; Trilj 33–36 — suho. Sve krš i planina (Mosor,
   * Velebit, Kamešnica): radar tamo vidi brdo, ne kišu, i vidi ga
   * POSTOJANO — pa postojanost tu ne razlikuje ništa.
   *
   * Prava jaka kiša istog dana bila je ŠIROKA: Novi Vinodolski 46 dBZ na
   * 67 %, Korenica 100 %, Zadar 86 %. Na austrijskim postajama nijedna
   * (0/37 mokrih, 0/204 suhih) nije imala jaku a usku jezgru, pa pravilo
   * tamo ne košta ništa. `persisted` ostaje izračunat za dijagnostiku.
   */
  const groundedHeavy = wide;
  void persisted;

  // ── GRMLJAVINA: samo iz konvektivne jezgre ili uz potvrdu drugog izvora.
  const stationThunder =
    i.stationCode !== undefined &&
    isThunder(i.stationCode) &&
    (i.stationAgeMin ?? Infinity) <= STATION_THUNDER_MAX_AGE_MIN;
  if (dbz >= DBZ_HEAVY && (dbz >= DBZ_STORM || stationThunder || isThunder(i.modelCode))) {
    return { code: 95, source: "radar" };
  }

  /*
   * Jaka jezgra BEZ pokrića na tlu: ne tvrdi se jaka kiša. Spušta se na
   * ono što drugi izvori znaju — postaja („grmljavina bez oborina" kod
   * Metkovića) pa model. Radar je tu vidio nešto stvarno, ali visoko.
   */
  if (dbz >= DBZ_HEAVY && !groundedHeavy) {
    return stationThenSky(i);
  }

  /*
   * ── POSTOJANOST: odjek u jednom okviru NIJE oborina.
   *
   * Metković 11.9. 10:30 — 23 dBZ na 8 % kruga nakon četiri prazna
   * okvira, uz postaju „umjereno oblačno" i model star dva sata. Prije
   * je prolazilo jer je pravilo tražilo samo `dBZ >= 20`.
   *
   * `persistence` se računa iz onoga što sudac ima: kad je poznata
   * (`i.persistence`), vrijedi ona; inače se izvodi iz prethodnog okvira
   * — jedan prethodni s odjekom znači 100 %, bez njega 50 % (jedan od
   * dva). Bez ijednog podatka o prošlosti se NE obara (prvo pokretanje).
   */
  const persistence =
    i.persistence ??
    (i.prevEcho === undefined
      ? undefined
      : i.prevEcho.maxDbz !== null && i.prevEcho.maxDbz >= DBZ_DRY
        ? 1
        : 0.5);
  if (persistence !== undefined && persistence < PERSISTENCE_WET) {
    return stationThenSky(i);
  }

  /*
   * ── MEDIAN: jačina NAD TOČKOM, a ne jedan piksel u krugu.
   * Uska jezgra 3 km dalje digne `maxDbz`, ali ne median (vidi
   * `MEDIAN_WET_DBZ` — izmjereno: dvije lažne kiše manje bez gubitka).
   * Kad mediana nema (stari keširani odjek), ne obara se.
   */
  const median = i.echo!.medianDbz;
  if (median !== null && median < MEDIAN_WET_DBZ) {
    return stationThenSky(i);
  }

  /*
   * ── POSTAJA NA ISTOJ TOČKI obara i jak odjek.
   * Senj 11.9.: 33 dBZ postojanih 80 % na 8 % kruga, a postaja 400 m
   * javlja „pretežno oblačno" — orografska jezgra nad Velebitom. Unutar
   * `STATION_SAME_SPOT_KM` postaja i radar gledaju isti piksel, pa
   * prostorne nesigurnosti (koja postoji na 8 km) nema.
   */
  if (
    i.stationCode !== undefined &&
    !isPrecip(i.stationCode) &&
    (i.stationDistanceKm ?? Infinity) <= STATION_SAME_SPOT_KM &&
    // Uski odjek: postaja smije biti i 45 min stara (Senj 28 min, dvaput
    // kamere suho). Široki odjek: samo svježa — kiša je mogla početi
    // nakon termina (Zadar 07:30 uz termin 07:00).
    (i.stationAgeMin ?? Infinity) <= (pct < WIDE_ECHO_PCT ? STATION_SAME_SPOT_AGE_MIN : STATION_TRUSTED_AGE_MIN)
  ) {
    return { code: i.stationCode, source: "station" };
  }

  // ── OBORINA KROZ CIJELI RASPON (≥ DBZ_DRY).
  //
  // Radar vidi oborinu nad TVOJOM točkom. Pitanje je samo smije li ga itko
  // nadglasati, i to smije SAMO postaja koja je dovoljno svježa da je tu
  // istu kišu mogla vidjeti (`STATION_TRUSTED_AGE_MIN`) — a i tada samo u
  // nesigurnom pojasu ispod `DBZ_CERTAIN`, gdje mjerenje pokazuje i suhe
  // slučajeve (planinski clutter).
  //
  // Iznad `DBZ_CERTAIN` radar vodi bez pitanja: nijedna od 290 suhih
  // postaja nije prešla 37 dBZ.
  // Jačina NAD TOČKOM iz MEDIANA, ne iz najjačeg piksela — isti okvir nad
  // splitskom Rivom davao je 8.9 ili 31.6 mm/h samo ovisno o polumjeru
  // (max), a median je bio 38 dBZ na svakom polumjeru. Kamere: rosi.
  const radarCode = precipCodeFromDbz(i.echo!.medianDbz ?? dbz, i.temp);
  const station = i.stationCode;
  const near = (i.stationDistanceKm ?? 0) <= STATION_PRECIP_RANGE_KM;
  const stationFresh = (i.stationAgeMin ?? Infinity) <= STATION_TRUSTED_AGE_MIN;

  if (station !== undefined && isPrecip(station)) {
    // Postaja i radar se SLAŽU da pada. Postaja zna VRSTU (susnježica,
    // ledena kiša, grmljavina) koju radar ne razlikuje, pa vrsta ostaje
    // njezina — ali samo dok smije govoriti o oborini (rok + domet).
    if (stationMayClaimPrecip(i)) return { code: station, source: "station" };
    return { code: radarCode, source: "radar" };
  }

  // Postaja tvrdi da NE pada (nebo, magla) ili je nema. Smije oboriti
  // radar samo ako je BLIZU, SVJEŽA i ako je odjek u nesigurnom pojasu —
  // ondje živi Loibl (42 dBZ uz 0 mm) i planinski clutter općenito.
  // Zemunik (10.8 km) time više ne obara kišu nad Puntamikom.
  if (dbz < DBZ_CERTAIN && station !== undefined && near && stationFresh && !isPrecip(station)) {
    return { code: station, source: "station" };
  }

  // Radar vodi — ili je iznad praga sigurnosti, ili je postaja prestara da
  // bi znala (Zemunik 11.9.: termin 07:00, kiša od 07:30).
  return { code: radarCode, source: "radar" };
}

/**
 * `measuredAt` iz DHMZ feeda („10.09.2026. 12:00", lokalno) → starost u
 * minutama u odnosu na `nowMs`. Nepoznat oblik → `Infinity` (= „staro").
 */
export function stationAgeMinutes(measuredAt: string | undefined, nowMs: number): number {
  const m = measuredAt?.match(/(\d{2})\.(\d{2})\.(\d{4})\.\s*(\d{1,2}):(\d{2})/);
  if (!m) return Infinity;
  const [, dd, mm, yyyy, hh, min] = m;
  const t = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min)).getTime();
  return (nowMs - t) / 60_000;
}
