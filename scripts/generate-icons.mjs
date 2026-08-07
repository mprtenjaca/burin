/**
 * Generira sve ikone aplikacije iz jednog SVG glifa. Glif je "Zapuh"
 * (odabran 6.8.2026. među 6 prijedloga): tri poteza vjetra koji se na
 * kraju UVIJAJU — sadašnje ravne crte čitale su se kao izbornik, ne kao
 * vjetar. Mint je zamijenjen koraljnim akcentom aplikacije.
 * Pokretanje: node scripts/generate-icons.mjs
 *
 * SVIJETLA JE GLAVNA (Markov odabir 6.8.2026.): zadana tema aplikacije je
 * svijetla, pa je tamna pločica na početnom zaslonu odudarala od onoga
 * što se otvori dodirom. Tamna ostaje kao iOS `dark` varijanta.
 */
import sharp from "sharp";

/**
 * KORALJNA JE MAKNUTA IZ IKONE (Markov odabir 8.8.2026., varijanta 7).
 *
 * Aplikacija je prešla na plavo nebo, pa je narančasta ostala jedina
 * topla mrlja i na ikoni je izgledala kao ostatak starog dizajna.
 *
 * `STEEL` je ista plava koju nosi wordmark na karti i u ladici — logo
 * time izgleda jednako gdje god stajao.
 */
const STEEL = "#4C8FDF";
const PAPER = "#FAFAF8";
/**
 * Podloga glavne ikone: gotovo crna, s blagim PLAVIM pomakom (#141821
 * umjesto čistog #0E0E0E). Neutralna crna uz plavi potez izgleda kao
 * odsutnost boje; ova se čita kao namjerno odabran ton.
 */
const TILE = "#141821";
const INK = "#141414";

/**
 * Glif u 24×24 mreži (isti potezi kao u prijedlogu): gornji i donji zapuh
 * u prvoj boji, srednji (najduži) u akcentu. `stroke-width` je u
 * jedinicama mreže — konačnu debljinu određuje viewBox ispod.
 */
const glyph = (c1, c2) => `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2" stroke="${c1}"/>
    <path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2" stroke="${c2}"/>
    <path d="M12.59 19.41A2 2 0 1 0 14 16H2" stroke="${c1}"/>
  </g>`;

/**
 * Puna pločica: glif na podlozi (1024×1024). Negativni viewBox uokviruje
 * 24-mrežu s marginom — glif zauzima ~63 % pločice.
 */
const tileSvg = (bg, c1, c2) => `<svg width="1024" height="1024" viewBox="-7 -7 38 38" xmlns="http://www.w3.org/2000/svg">
  <rect x="-7" y="-7" width="38" height="38" fill="${bg}"/>
  ${glyph(c1, c2)}
</svg>`;

/**
 * GLAVNA IKONA JE TAMNA (Markov odabir 8.8.2026.).
 *
 * Prije je glavna bila svijetla (papirnata podloga, tintani potezi).
 * Tamna podloga je otpornija: na svijetlim i šarenim pozadinama zaslona
 * pločica ostaje odvojena, a plavi potez na njoj puca najjače.
 *
 * `light` i `dark` su OVDJE ISTI. iOS 18 dopušta zasebnu svijetlu
 * varijantu, ali ikona koja mijenja podlogu s temom prestaje biti isti
 * znak — a i widget već ima jednu verziju bez obzira na temu.
 */
const lightSvg = tileSvg(TILE, PAPER, STEEL);
const darkSvg = lightSvg;

/**
 * TINTED (iOS 18): Apple traži JEDNOBOJAN glif na CRNOJ podlozi i sam mu
 * mapira svjetlinu u korisnikovu boju — prozirna pozadina ovdje NE radi
 * kao kod Androidovog monochromea.
 *
 * Oba tona su svijetla (bijela i 72 % siva) jer tamni pikseli u tintanoj
 * ikoni ispadnu gotovo crni: koraljna (#EE6E3C) bi se pretvorila u mrlju
 * bez oblika. Razlika u svjetlini čuva to da je srednji potez zaseban.
 */
const tintedSvg = tileSvg("#000000", "#FFFFFF", "#B8B8B8");

/** Adaptivni foreground: glif u sigurnoj zoni (~52 % sredine), proziran. */
const foregroundSvg = (color1 = PAPER, color2 = STEEL) => `<svg width="1024" height="1024" viewBox="-11 -11 46 46" xmlns="http://www.w3.org/2000/svg">
  ${glyph(color1, color2)}
</svg>`;

const backgroundSvg = (bg) => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${bg}"/>
</svg>`;

async function main() {
  // --- iOS: tri varijante, sustav bira po temi ---
  await sharp(Buffer.from(lightSvg)).png().toFile("assets/icon.png");
  await sharp(Buffer.from(darkSvg)).png().toFile("assets/icon-dark.png");
  await sharp(Buffer.from(tintedSvg)).png().toFile("assets/icon-tinted.png");

  /*
   * --- Android: adaptivna ikona u TRI SLOJA ---
   *
   * Android NEMA zasebnu tamnu ikonu — `monochrome` je taj mehanizam:
   * kad korisnik uključi Material You temiranje, sustav uzme taj glif i
   * sam ga oboji prema svojoj paleti, u svijetloj i tamnoj temi jednako.
   *
   * Foreground i background prate GLAVNU pločicu, koja je od 8.8.2026.
   * TAMNA: bijeli potezi s plavim srednjim na podlozi #141821.
   */
  await sharp(Buffer.from(foregroundSvg(PAPER, STEEL)))
    .png()
    .toFile("assets/android-icon-foreground.png");
  await sharp(Buffer.from(backgroundSvg(TILE)))
    .png()
    .toFile("assets/android-icon-background.png");
  /*
   * MONOCHROME mora biti JEDNOBOJAN na prozirnom — sustav čita samo alfu
   * i sam nanosi boju. Koraljni potez bi se ovdje izgubio, pa su sva tri
   * poteza bijela: oblik nosi cijelu informaciju.
   */
  await sharp(Buffer.from(foregroundSvg("#FFFFFF", "#FFFFFF")))
    .png()
    .toFile("assets/android-icon-monochrome.png");

  // --- Splash i web ---
  /*
   * Splash glif ide u TINTU, ne u papirnatu: podloga splasha je i dalje
   * papirnata (`backgroundColor: "#FAFAF8"` u `app.config.ts`), pa bi
   * bijeli potezi ondje bili nevidljivi. Srednji je plav kao na ikoni.
   */
  await sharp(Buffer.from(foregroundSvg(INK, STEEL)))
    .png()
    .toFile("assets/splash-icon.png");
  await sharp(Buffer.from(lightSvg)).resize(196, 196).png().toFile("assets/favicon.png");

  // Varijanta koju expo-dev-launcher traži s Metroa (192px, zaobljena).
  const base192 = await sharp(Buffer.from(lightSvg)).resize(192, 192).png().toBuffer();
  const mask = Buffer.from(
    `<svg width="192" height="192"><rect width="192" height="192" rx="44" ry="44" fill="#fff"/></svg>`,
  );
  await sharp(base192)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toFile("assets/icon192_rounded.png");

  console.log("Ikone generirane u assets/.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
