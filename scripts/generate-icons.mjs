/**
 * Generira sve ikone aplikacije iz jednog SVG glifa. Glif je "Zapuh"
 * (odabran 6.8.2026. među 6 prijedloga): tri poteza vjetra koji se na
 * kraju UVIJAJU — sadašnje ravne crte čitale su se kao izbornik, ne kao
 * vjetar. Mint je zamijenjen koraljnim akcentom aplikacije.
 * Pokretanje: node scripts/generate-icons.mjs
 */
import sharp from "sharp";

const CORAL = "#EE6E3C";
const PAPER = "#FAFAF8";
const NIGHT = "#0E0E0E";

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
 * Glavna ikona: glif na tamnoj podlozi (1024×1024). Negativni viewBox
 * uokviruje 24-mrežu s marginom — glif zauzima ~63 % pločice, kao prije.
 */
const mainSvg = `<svg width="1024" height="1024" viewBox="-7 -7 38 38" xmlns="http://www.w3.org/2000/svg">
  <rect x="-7" y="-7" width="38" height="38" fill="${NIGHT}"/>
  ${glyph(PAPER, CORAL)}
</svg>`;

/** Adaptivni foreground: glif u sigurnoj zoni (~52 % sredine), proziran. */
const foregroundSvg = (color1 = PAPER, color2 = CORAL) => `<svg width="1024" height="1024" viewBox="-11 -11 46 46" xmlns="http://www.w3.org/2000/svg">
  ${glyph(color1, color2)}
</svg>`;

const backgroundSvg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${NIGHT}"/>
</svg>`;

async function main() {
  await sharp(Buffer.from(mainSvg)).png().toFile("assets/icon.png");
  await sharp(Buffer.from(foregroundSvg()))
    .png()
    .toFile("assets/android-icon-foreground.png");
  await sharp(Buffer.from(backgroundSvg))
    .png()
    .toFile("assets/android-icon-background.png");
  await sharp(Buffer.from(foregroundSvg("#FFFFFF", "#FFFFFF")))
    .png()
    .toFile("assets/android-icon-monochrome.png");
  await sharp(Buffer.from(foregroundSvg()))
    .png()
    .toFile("assets/splash-icon.png");
  await sharp(Buffer.from(mainSvg)).resize(196, 196).png().toFile("assets/favicon.png");

  // Varijanta koju expo-dev-launcher traži s Metroa (192px, zaobljena).
  const base192 = await sharp(Buffer.from(mainSvg)).resize(192, 192).png().toBuffer();
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
