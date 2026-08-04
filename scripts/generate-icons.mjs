/**
 * Generira sve ikone aplikacije iz jednog SVG glifa (tri zaobljena poteza
 * vjetra — "burin"). Pokretanje: node scripts/generate-icons.mjs
 */
import sharp from "sharp";

const MINT = "#2EE6A8";
const PAPER = "#FAFAF8";
const NIGHT = "#0E0E0E";

/** Glavna ikona: glif na tamnoj podlozi (1024x1024). */
const mainSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${NIGHT}"/>
  <g stroke-linecap="round" stroke-width="88" fill="none">
    <line x1="272" y1="392" x2="632" y2="392" stroke="${PAPER}"/>
    <line x1="272" y1="536" x2="752" y2="536" stroke="${MINT}"/>
    <line x1="272" y1="680" x2="512" y2="680" stroke="${PAPER}"/>
  </g>
</svg>`;

/** Adaptivni foreground: glif u sigurnoj zoni (~66% sredine), proziran. */
const foregroundSvg = (color1 = PAPER, color2 = MINT) => `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <g stroke-linecap="round" stroke-width="72" fill="none">
    <line x1="368" y1="420" x2="608" y2="420" stroke="${color1}"/>
    <line x1="368" y1="536" x2="688" y2="536" stroke="${color2}"/>
    <line x1="368" y1="652" x2="528" y2="652" stroke="${color1}"/>
  </g>
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
