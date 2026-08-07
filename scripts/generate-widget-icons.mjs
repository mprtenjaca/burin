/**
 * Ikone za iOS widget (7.8.2026.). Pokretanje:
 *   node scripts/generate-widget-icons.mjs
 *
 * ZAŠTO PNG, a ne SVG kao u aplikaciji: widget se crta kroz
 * `@expo/ui/swift-ui`, koji **nema ni jedan crtaći primitiv za putanje** —
 * ima `Rectangle`/`Circle`/`Ellipse`/`Capsule`, ali NE `Path` ni `Canvas`.
 * Naši glifovi (zapuh, zrake, pahulja) su putanje, pa se ne mogu nacrtati
 * komponentama.
 *
 * Izlaz je zato PNG koji widget učita preko `<Image uiImage>`. Ikone su
 * BIJELE i PROZIRNE, pa jedan set radi na svim gradijentima — na tamnoj
 * noći i na narančastom suncu jednako.
 *
 * NE koristi se SF Symbols: to je Appleov vizualni jezik, a aplikacija
 * ima svoj (glif "Zapuh" + lucide). Widget koji posudi Appleove ikone
 * izgleda kao Appleov widget, ne kao Burin.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

/** Ikone su bijele — boja se ne mijenja po vremenu, prozirnost nosi sve. */
const W = "#FFFFFF";

/** Izlazna veličina. 96 px pokriva @3x prikaz ikone od 32 pt. */
const SIZE = 96;

const OUT = "assets/widget";

/**
 * VJETAR — glif "Zapuh" iz `generate-icons.mjs`, ISTE putanje.
 *
 * Namjerno se ne poseže za vjetruljom (`WindFlag`): ona ima stup, tri
 * pruge i prozirne rasjeke, što na 32 pt postane siva mrlja — ista greška
 * koja je pri izradi značke uhvaćena renderom. Zapuh je čitljiv i malen,
 * a već JE ikona aplikacije, pa se čita kao "Burin vjetar".
 *
 * Svi potezi su bijeli (u aplikaciji je srednji koraljni): na obojenom
 * gradijentu koraljna se utapa, a ovdje ikona mora raditi na svih osam
 * paleta.
 */
const windSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="-2 -2 28 28" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2"/>
    <path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/>
    <path d="M12.59 19.41A2 2 0 1 0 14 16H2"/>
  </g>
</svg>`;

/**
 * SUNCE — krug i osam zraka koje se NE POMIČU (isto pravilo kao
 * `RaysLayer`: kad se kose crte kližu, oko ih čita kao oborinu).
 *
 * Zrake se izračunavaju, ne pogađaju — kao koordinate u `WindFlag`-u:
 * svaka ide od r1 do r2 po istom kutu, pa su razmaci jednaki.
 */
function sunSvg() {
  const cx = 12, cy = 12, r1 = 7.2, r2 = 10.4;
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = (cx + Math.cos(a) * r1).toFixed(2);
    const y1 = (cy + Math.sin(a) * r1).toFixed(2);
    const x2 = (cx + Math.cos(a) * r2).toFixed(2);
    const y2 = (cy + Math.sin(a) * r2).toFixed(2);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="${W}" stroke-linecap="round" stroke-width="2">
    <circle cx="${cx}" cy="${cy}" r="4.6"/>
    ${rays}
  </g>
</svg>`;
}

/** Oblak — jedno tijelo od tri kružnice i podnožja, kao lucide `cloud`. */
const cloudPath = "M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 11.3A3.85 3.85 0 0 0 6.5 19Z";

const cloudSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="${cloudPath}" fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
</svg>`;

/**
 * DJELOMIČNO OBLAČNO — sunce GORE LIJEVO pa oblak preko njega.
 *
 * Sunce mora ostati vidljivo (odluka 6.8.2026.: djelomično oblačno je
 * prije izgledalo kao "vedro, samo manje" jer oblaka nije bilo). Zrake su
 * skraćene na četiri — s osam bi se pod oblakom skupile u mrlju.
 */
const partlySvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="cut-cloud-sun">
      <rect x="0" y="0" width="24" height="24" fill="#fff"/>
      <path d="M17.5 20a4.2 4.2 0 0 0 .4-8.37A5.6 5.6 0 0 0 7.1 12.8A3.6 3.6 0 0 0 7.4 20Z"
            fill="#000" stroke="#000" stroke-width="3.4"
            stroke-linejoin="round" stroke-linecap="round"/>
    </mask>
  </defs>
  <g fill="none" stroke="${W}" stroke-linecap="round" stroke-width="1.9" mask="url(#cut-cloud-sun)">
    <circle cx="8" cy="7.5" r="3.1"/>
    <line x1="8" y1="1.6" x2="8" y2="3"/>
    <line x1="3.8" y1="3.3" x2="4.8" y2="4.3"/>
    <line x1="1.7" y1="7.5" x2="3.1" y2="7.5"/>
    <line x1="12.2" y1="3.3" x2="11.2" y2="4.3"/>
  </g>
  <path d="M17.5 20a4.2 4.2 0 0 0 .4-8.37A5.6 5.6 0 0 0 7.1 12.8A3.6 3.6 0 0 0 7.4 20Z"
        fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
</svg>`;

/** Kiša — oblak i tri kose crte; kut prati `SLOPE` ambijentalnih slojeva. */
const rainSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
    <path d="M16.6 15.5a4.1 4.1 0 0 0 .4-8.17A5.5 5.5 0 0 0 6.4 8.5A3.5 3.5 0 0 0 6.7 15.5Z"/>
    <line x1="8.4" y1="18.2" x2="7.2" y2="21.4"/>
    <line x1="12.4" y1="18.2" x2="11.2" y2="21.4"/>
    <line x1="16.4" y1="18.2" x2="15.2" y2="21.4"/>
  </g>
</svg>`;

/**
 * SNIJEG — pahulja sa ŠEST krakova i sitnim vilicama na vrhovima.
 *
 * Šest, ne osam: pravi kristal je šesterokutan, a na 32 pt osam krakova
 * izgleda kao zvijezda. Vilice su ono što je razlikuje od sunca — bez
 * njih su to samo crte iz središta.
 */
function snowSvg() {
  const cx = 12, cy = 12, R = 9.4, fork = 2.6;
  /*
   * Vilice sjede na 62 % kraka i granaju se PREMA VANI, ali pod tupim
   * kutom (±0.95 rad ≈ 54°) od smjera kraka.
   *
   * Prva izvedba ih je stavljala NA VRH i usmjeravala natrag prema
   * središtu — render je pokazao da tako izgledaju kao strelice, pa se
   * cijela ikona čitala kao znak "raširi", ne kao pahulja. Prava pahulja
   * ima grane na sredini kraka, kao jelka.
   */
  const arms = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    const tipX = cx + Math.cos(a) * R;
    const tipY = cy + Math.sin(a) * R;
    const bx = cx + Math.cos(a) * R * 0.62;
    const by = cy + Math.sin(a) * R * 0.62;
    const barbs = [-1, 1]
      .map((s) => {
        const ba = a + s * 0.95;
        return `<line x1="${bx.toFixed(2)}" y1="${by.toFixed(2)}" x2="${(bx + Math.cos(ba) * fork).toFixed(2)}" y2="${(by + Math.sin(ba) * fork).toFixed(2)}"/>`;
      })
      .join("");
    return `<line x1="${cx}" y1="${cy}" x2="${tipX.toFixed(2)}" y2="${tipY.toFixed(2)}"/>${barbs}`;
  }).join("");
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="${W}" stroke-linecap="round" stroke-width="1.7">${arms}</g>
</svg>`;
}

/**
 * VEDRA NOĆ — mjesec u mijeni i tri zvijezde s KRAKOVIMA.
 *
 * Srp se reže putanjom (dva luka), a ne krugom sjene preko kruga: isti
 * popravak kao u `StarsLayer`, gdje je pomaknuti krug virio izvan mjeseca
 * i cijelo je izgledalo kao pomrčina.
 *
 * Zvijezde su četverokrake iskre, ne točke — točka od 1 px na 32 pt
 * nestane, a krakovi se čitaju kao "zvijezda" i pri toj veličini.
 */
function starSpark(cx, cy, r) {
  const t = r * 0.34; // debljina "struka" iskre
  return `<path d="M${cx} ${cy - r}Q${cx + t} ${cy - t} ${cx + r} ${cy}Q${cx + t} ${cy + t} ${cx} ${cy + r}Q${cx - t} ${cy + t} ${cx - r} ${cy}Q${cx - t} ${cy - t} ${cx} ${cy - r}Z" fill="${W}"/>`;
}

const nightSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M20.1 14.6A8.4 8.4 0 0 1 9.4 3.9a8.4 8.4 0 1 0 10.7 10.7Z"
        fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9"/>
  ${starSpark(18.4, 5.2, 2.5)}
  ${starSpark(13.6, 2.6, 1.5)}
  ${starSpark(21.2, 9.8, 1.3)}
</svg>`;

/**
 * OBLAČNA NOĆ — mjesec IZA oblaka.
 *
 * Oblak se REŽE IZ MJESECA maskom, ne ispunjava bojom (popravak
 * 7.8.2026., nakon što je Marko uočio da se linija mjeseca vidi kroz
 * oblak i da to izgleda kao dva prstena koja se sijeku).
 *
 * Ispuna ovdje ne dolazi u obzir: podloga widgeta je GRADIJENT koji se
 * mijenja po vremenu, pa nema jedne boje kojom bi se oblak ispunio.
 * Maska nema taj problem — ne dodaje boju, samo uklanja ono što je iza.
 *
 * Isti postupak kao mjesečev srp u `StarsLayer`: ondje je krug sjene u
 * boji neba virio izvan mjeseca i izgledalo je kao pomrčina.
 *
 * Oblak u masci nosi i OBRIS (`stroke`) širi od svojeg poteza, pa oko
 * njega ostane tanka praznina — bez nje bi se linije mjeseca i oblaka
 * dodirivale i opet slijepile u jedno tijelo.
 */
const cloudBody = "M17.5 20a4.2 4.2 0 0 0 .4-8.37A5.6 5.6 0 0 0 7.1 12.8A3.6 3.6 0 0 0 7.4 20Z";

const nightCloudySvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="cut-cloud">
      <rect x="0" y="0" width="24" height="24" fill="#fff"/>
      <path d="${cloudBody}" fill="#000" stroke="#000" stroke-width="3.4"
            stroke-linejoin="round" stroke-linecap="round"/>
    </mask>
  </defs>
  <path d="M13.4 10.2A6.2 6.2 0 0 1 5.5 2.3a6.2 6.2 0 1 0 7.9 7.9Z"
        fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
        mask="url(#cut-cloud)"/>
  <path d="${cloudBody}"
        fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
</svg>`;

/**
 * GRMLJAVINA — oblak i munja; munja je PUNA da se vidi na 32 pt.
 *
 * Munja se reže iz oblaka istom maskom kao mjesec (7.8.2026.): njen vrh
 * ulazi u oblak, pa bi se bez toga linija oblaka vidjela KROZ munju i
 * presjekla ju popola.
 */
const boltPath = "M12.8 13.4h3.1l-4.7 8.2 1.2-5.2h-2.7l3.3-6.1Z";

const thunderSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="cut-bolt">
      <rect x="0" y="0" width="24" height="24" fill="#fff"/>
      <path d="${boltPath}" fill="#000" stroke="#000" stroke-width="1.9"
            stroke-linejoin="round" stroke-linecap="round"/>
    </mask>
  </defs>
  <path d="M16.6 15a4.1 4.1 0 0 0 .4-8.17A5.5 5.5 0 0 0 6.4 8A3.5 3.5 0 0 0 6.7 15Z"
        fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        mask="url(#cut-bolt)"/>
  <path d="${boltPath}" fill="${W}"/>
</svg>`;

/** Magla — oblak i tri vodoravne crte različitih dužina. */
const fogSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
    <path d="M16.6 13.5a4.1 4.1 0 0 0 .4-8.17A5.5 5.5 0 0 0 6.4 6.5A3.5 3.5 0 0 0 6.7 13.5Z"/>
    <line x1="4.5" y1="17.2" x2="17.5" y2="17.2"/>
    <line x1="7" y1="20.6" x2="15" y2="20.6"/>
  </g>
</svg>`;

/*
 * ---- PUNE inačice, za ZAKLJUČANI ZASLON ----
 *
 * iOS ondje crta u `vibrant` načinu: sve se svede na JEDAN ton i pretvori
 * u masku. Tanke linije se pritom stanjuju do neprimjetnosti, a prazna
 * unutrašnjost obrisa se ne razlikuje od podloge — zato Appleov widget
 * na zaključanom zaslonu koristi PUNE ikone (`*.fill` u SF Symbolsima).
 *
 * Ovdje je isti postupak: isti oblici, ali ispunjeni. Kapljice, pahulja i
 * zvijezde ostaju odvojene od tijela oblaka razmakom, ne linijom.
 */

/** Puni oblak — jedno tijelo, bez obrisa. */
const cloudFill = `<path d="${cloudBody}" fill="${W}"/>`;

const sunFillSvg = (() => {
  const cx = 12, cy = 12, r1 = 7.4, r2 = 10.6;
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = (cx + Math.cos(a) * r1).toFixed(2);
    const y1 = (cy + Math.sin(a) * r1).toFixed(2);
    const x2 = (cx + Math.cos(a) * r2).toFixed(2);
    const y2 = (cy + Math.sin(a) * r2).toFixed(2);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${cx}" cy="${cy}" r="5.4" fill="${W}"/>
  <g stroke="${W}" stroke-linecap="round" stroke-width="2.4">${rays}</g>
</svg>`;
})();

const cloudFillSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  ${cloudFill}
</svg>`;

/** Kiša: puni oblak i tri debele kapi (kose, pod istim nagibom). */
const rainFillSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M16.6 15.5a4.1 4.1 0 0 0 .4-8.17A5.5 5.5 0 0 0 6.4 8.5A3.5 3.5 0 0 0 6.7 15.5Z" fill="${W}"/>
  <g stroke="${W}" stroke-linecap="round" stroke-width="2.4">
    <line x1="8.4" y1="18.4" x2="7.4" y2="21.2"/>
    <line x1="12.4" y1="18.4" x2="11.4" y2="21.2"/>
    <line x1="16.4" y1="18.4" x2="15.4" y2="21.2"/>
  </g>
</svg>`;

/** Djelomično: puno sunce gore lijevo, pa puni oblak preko njega. */
const partlyFillSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="pf">
      <rect x="0" y="0" width="24" height="24" fill="#fff"/>
      <path d="${cloudBody}" fill="#000" stroke="#000" stroke-width="2.6" stroke-linejoin="round"/>
    </mask>
  </defs>
  <g mask="url(#pf)">
    <circle cx="8" cy="7.5" r="3.8" fill="${W}"/>
    <g stroke="${W}" stroke-linecap="round" stroke-width="2">
      <line x1="8" y1="1.5" x2="8" y2="2.9"/>
      <line x1="3.6" y1="3.1" x2="4.7" y2="4.2"/>
      <line x1="1.6" y1="7.5" x2="3" y2="7.5"/>
      <line x1="12.4" y1="3.1" x2="11.3" y2="4.2"/>
    </g>
  </g>
  ${cloudFill}
</svg>`;

/** Snijeg: puna pahulja s debljim krakovima (linije, ali guste). */
const snowFillSvg = (() => {
  const cx = 12, cy = 12, R = 9.4, fork = 2.8;
  const arms = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    const tx = cx + Math.cos(a) * R, ty = cy + Math.sin(a) * R;
    const bx = cx + Math.cos(a) * R * 0.6, by = cy + Math.sin(a) * R * 0.6;
    const barbs = [-1, 1]
      .map((s) => {
        const ba = a + s * 0.95;
        return `<line x1="${bx.toFixed(2)}" y1="${by.toFixed(2)}" x2="${(bx + Math.cos(ba) * fork).toFixed(2)}" y2="${(by + Math.sin(ba) * fork).toFixed(2)}"/>`;
      })
      .join("");
    return `<line x1="${cx}" y1="${cy}" x2="${tx.toFixed(2)}" y2="${ty.toFixed(2)}"/>${barbs}`;
  }).join("");
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <g stroke="${W}" stroke-linecap="round" stroke-width="2.5">${arms}</g>
</svg>`;
})();

/** Puni mjesec u mijeni, sa zvijezdama — srp je već puna ploha. */
const nightFillSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M20.1 14.6A8.4 8.4 0 0 1 9.4 3.9a8.4 8.4 0 1 0 10.7 10.7Z" fill="${W}"/>
  ${starSpark(18.9, 4.9, 2.6)}
  ${starSpark(13.9, 2.4, 1.6)}
</svg>`;

const nightCloudyFillSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="ncf">
      <rect x="0" y="0" width="24" height="24" fill="#fff"/>
      <path d="${cloudBody}" fill="#000" stroke="#000" stroke-width="2.6" stroke-linejoin="round"/>
    </mask>
  </defs>
  <path d="M13.4 10.2A6.2 6.2 0 0 1 5.5 2.3a6.2 6.2 0 1 0 7.9 7.9Z" fill="${W}" mask="url(#ncf)"/>
  ${cloudFill}
</svg>`;

const thunderFillSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="tf">
      <rect x="0" y="0" width="24" height="24" fill="#fff"/>
      <path d="${boltPath}" fill="#000" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/>
    </mask>
  </defs>
  <path d="M16.6 15a4.1 4.1 0 0 0 .4-8.17A5.5 5.5 0 0 0 6.4 8A3.5 3.5 0 0 0 6.7 15Z"
        fill="${W}" mask="url(#tf)"/>
  <path d="${boltPath}" fill="${W}"/>
</svg>`;

const fogFillSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M16.6 13.5a4.1 4.1 0 0 0 .4-8.17A5.5 5.5 0 0 0 6.4 6.5A3.5 3.5 0 0 0 6.7 13.5Z" fill="${W}"/>
  <g stroke="${W}" stroke-linecap="round" stroke-width="2.4">
    <line x1="4.5" y1="17.4" x2="17.5" y2="17.4"/>
    <line x1="7" y1="20.8" x2="15" y2="20.8"/>
  </g>
</svg>`;

/** Vjetar: isti zapuh, samo deblji — glif je i inače potez, ne ploha. */
const windFillSvg = `<svg width="${SIZE}" height="${SIZE}" viewBox="-2 -2 28 28" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.9">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2"/>
    <path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/>
    <path d="M12.59 19.41A2 2 0 1 0 14 16H2"/>
  </g>
</svg>`;

const ICONS = {
  wind: windSvg,
  sun: sunSvg(),
  partly: partlySvg,
  cloud: cloudSvg,
  rain: rainSvg,
  snow: snowSvg(),
  night: nightSvg,
  "night-cloudy": nightCloudySvg,
  thunder: thunderSvg,
  fog: fogSvg,

  // Pune inačice za zaključani zaslon (sufiks `-fill`).
  "sun-fill": sunFillSvg,
  "partly-fill": partlyFillSvg,
  "cloud-fill": cloudFillSvg,
  "rain-fill": rainFillSvg,
  "snow-fill": snowFillSvg,
  "thunder-fill": thunderFillSvg,
  "fog-fill": fogFillSvg,
  "night-fill": nightFillSvg,
  "night-cloudy-fill": nightCloudyFillSvg,
  "wind-fill": windFillSvg,
};

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const [name, svg] of Object.entries(ICONS)) {
    await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${name}.png`);
  }
  console.log(`Widget ikone (${Object.keys(ICONS).length}) generirane u ${OUT}/.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
