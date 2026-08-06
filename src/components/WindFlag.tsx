import Svg, { G, Path, Rect } from "react-native-svg";

import type { WindStrength } from "@/utils/weatherLook";
import { WIND_FLAG_COLORS, windStrength } from "@/utils/weatherLook";

/**
 * Značka jačine vjetra — VJETRULJA (windsock) na stupu, po Markovom SVG-u
 * (6.8.2026.). Isti znak koji koristi Vrijeme&Radar, jer je to standardni
 * meteorološki simbol za vjetar.
 *
 * Zašto vjetrulja, a ne zastava: vjetrulja je INSTRUMENT za vjetar, pa se
 * i sama čita kao "vjetar". Zastava je signal i značenje nosi samo bojom.
 * Ovako oblik govori "vjetar", a boja "koliko" — dva neovisna kanala.
 *
 * Prije ovoga su bile dvije promašene izvedbe (obje viđene na uređaju):
 * čist krug bez stupa ("mala točka"), pa zastava s valovitim rubom.
 *
 * Ispod 10 m/s ne crta NIŠTA (`null`) — vidi `windStrength`. Time lista
 * ostaje mirna kad nema vjetra, pa je značka odmah vidljiva kad ga ima.
 */

/**
 * Nagib rukava: 38° dolje-desno iz Markovog SVG-a. Vjetrulja koja visi
 * pod kutom čita se kao "vjetar puše", a vodoravna kao "olujno" — zato
 * olujna stoji ravnije (22°).
 */
const TILT_STRONG = 38;
const TILT_STORM = 22;

/**
 * Boja rukava za jak (ne olujni) vjetar, po podlozi (Markov odabir
 * 6.8.2026.). Prozirni rasjeci uvijek propuštaju podlogu, pa je znak na
 * svijetlom "siv s bijelim prugama", a na tamnom obrnuto — isti oblik.
 *
 *  - `card`  BIJELA kartica (ladica, tražilica, bento): tamnija siva,
 *            jer bijelo na bijelom ne postoji. Tamnija je i od prigušenih
 *            ikona vremena u istom redu, da vjetrulja ostane vodeći znak.
 *  - `hero`  OBOJENI gradijent heroja: SVJETLIJA siva. Heroj nije bijel,
 *            pa mu ne treba toliko tamnog za odvajanje — na 0x6E je
 *            izgledala pretamno i teško (Markov ispravak).
 *  - `dark`  tamna tema i tamne podloge: bijela.
 */
const BAND_BY_TONE = {
  card: "#6E6E69",
  hero: "#e2e2e2",
  dark: "#FAFAF8",
} as const;

export type WindFlagTone = keyof typeof BAND_BY_TONE;

export function WindFlag({
  speedKmh,
  size = 18,
  tone = "dark",
}: {
  /**
   * UDARI u km/h — kako stoje u `WeatherBundle`, bez pretvaranja.
   *
   * Namjerno udari, a ne stalni vjetar: izmjereno 6.8.2026. da ECMWF za
   * Polaču daje 4.2 m/s stalnog uz 9.1 m/s u udarima. Bura se osjeti po
   * udarima; po stalnom vjetru značka se u zaleđu ne bi upalila gotovo
   * nikad.
   */
  speedKmh: number;
  size?: number;
  /**
   * Kakva je PODLOGA ispod značke — vidi `BAND_BY_TONE`.
   *
   * Nije `boolean` jer nisu dva slučaja nego tri: bijela kartica traži
   * tamnu sivu, obojeni gradijent heroja svjetliju, tamna tema bijelu.
   * Prije je bio jedan `onLight` za oboje, pa je heroj dobivao istu tamnu
   * sivu kao kartica i izgledao pretežak (nađeno na uređaju).
   *
   * Bijela vjetrulja na bijeloj kartici je NEVIDLJIVA — dok je rukav imao
   * obris, znak se nazirao; s prozirnim rasjecima je obris otpao.
   */
  tone?: WindFlagTone;
}) {
  const strength: WindStrength = windStrength(speedKmh);
  if (strength === "calm") return null;

  const storm = strength === "storm";
  /*
   * BOJE (Markov odabir 6.8.2026.):
   *  - rukav su TRI odvojene pruge; između njih su PROZIRNI rasjeci kroz
   *    koje se vidi podloga
   *  - olujna bura je CRVENA na SVIM podlogama — crveno je znak opasnosti
   *    i ne smije ovisiti o temi
   *  - jak vjetar prati podlogu (`BAND_BY_TONE`)
   */
  const band = storm ? WIND_FLAG_COLORS.storm : BAND_BY_TONE[tone];
  const tilt = storm ? TILT_STORM : TILT_STRONG;
  /*
   * Stup NIJE crven ni u oluji — on je jarbol, ne dio rukava; crveni štap
   * bi se čitao kao nastavak zastave. Prati samo podlogu.
   */
  const mast = BAND_BY_TONE[tone];

  return (
    /*
     * viewBox je PRIKROJEN crtežu, ne 64×64 kao izvorni SVG (6.8.2026.):
     * tamo stup ide od y=12 do y=52 unutar 64 jedinica, pa je trećina
     * kadra bila prazna — značka je zato izgledala sitno i pri size 17.
     *
     * IZRAČUNATE granice crteža (rotacija rukava oko (21,18)):
     *   nagib 38°: x 14.8–46.4, y 13.3–41.4
     *   nagib 22°: x 17.3–50.3, y 12.4–34.7
     *   stup:      x 16–20,     y 12–52
     * Unija je x 14.8–50.3, y 12–52 → kadar 13.5,11 → 38×42 s malom
     * rezervom za `strokeWidth` (2), koji viri pola debljine izvan puta.
     */
    <Svg width={size} height={size * 1.1} viewBox="13.5 11 38 42">
      {/*
        Stup: tanak i zaobljen (3 — 4 je bilo tromo). Boju dijeli s
        prugama, pa na bijeloj kartici ne ostane nevidljiv bijeli štap.
      */}
      <Rect x={16.5} y={12} width={3} height={40} rx={1.5} fill={mast} />

      {/*
        Rukav se rotira oko SVOG ovjesa na stupu (21, 18) — `rotate` s
        centrom, jer `transform-origin` iz weba u react-native-svg ne
        postoji. Bez zadanog centra rotacija ide oko (0,0) i rukav odleti
        izvan kadra.
      */}
      <G transform={`rotate(${tilt}, 21, 18)`}>
        {/*
          TRI PUNE PRUGE, bez podloge ispod njih (dorada 6.8.2026.):
          rasjeci između pruga su PROZIRNI, pa se kroz njih vidi gradijent
          ladice ili bijela kartica. Prije je rukav bio ispunjen bijelom, a
          pruge sive — renderano u PNG i vidjelo se da značka izgleda SIVA.

          Pruge nisu kosine (`skewX` bi tražio `transform-origin`, kojeg u
          react-native-svg nema), nego četverokuti čiji gornji i donji rub
          PRATE SUŽENJE rukava, pa "leže" u njegovoj perspektivi.

          Koordinate su IZRAČUNATE iz jednadžbi rubova rukava (gore
          12 → 16.5, dolje 28 → 23.5 na potezu x = 21 → 52), uz rasjek od
          3.6 jedinice: širina pruge ispada 7.93.

          Rasjeci ostaju PROZIRNI i pri olujnoj buri (Markovo pitanje
          6.8.2026.): na pravoj vjetrulji naizmjenične pruge SU oblik — bez
          rasjeka bi znak postao puni crveno-bijeli blok i prestao se
          čitati kao rukav. Prozirno usto radi na svakoj podlozi bez
          pogađanja boje ispod.
        */}
        <Path d="M21.00 12.00 L28.93 13.15 L28.93 26.85 L21.00 28.00 Z" fill={band} />
        <Path d="M32.53 13.67 L40.47 14.83 L40.47 25.17 L32.53 26.33 Z" fill={band} />
        <Path d="M44.07 15.35 L52.00 16.50 L52.00 23.50 L44.07 24.65 Z" fill={band} />
      </G>
    </Svg>
  );
}
