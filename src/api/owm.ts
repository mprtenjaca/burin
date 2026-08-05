const KEY = process.env.EXPO_PUBLIC_OWM_API_KEY;

/**
 * Bez ključa su OWM slojevi onemogućeni (sivi čip + napomena), a Radar i
 * ostatak aplikacije rade normalno.
 */
export function hasOwmKey(): boolean {
  return typeof KEY === "string" && KEY.trim().length > 0;
}

/**
 * OWM tile sloj, po potrebi za određeni trenutak.
 *
 * `&date=<unix>` NIJE u službenoj dokumentaciji sloja 1.0, ali radi:
 * izmjereno 5.8.2026. da svaki pomak od −48 h do +120 h vraća jedinstvenu
 * pločicu (usporedba MD5 hashova). Bez njega je klizanje po satima mijenjalo
 * samo oznaku, a slika je ostajala ista.
 *
 * Kad `atUnix` nije zadan, vraća se trenutno stanje.
 */
export function owmTileUrl(
  layer: "temp_new" | "clouds_new" | "wind_new",
  atUnix?: number,
): string {
  const base = `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${KEY ?? ""}`;
  return atUnix === undefined ? base : `${base}&date=${Math.floor(atUnix)}`;
}
