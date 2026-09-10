import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Donji rub koji sadržaj MORA ostaviti praznim da ga ne pokrije sustavna
 * navigacijska traka (popravak 6.9.2026., Markov nalaz na uređaju: tekst na
 * dnu početne i peludi "se ne vidi u potpunosti, prekriva ga Android
 * bottom nav").
 *
 * Android nosi PUNI inset: aplikacija je u edge-to-edge načinu
 * (`edgeToEdgeEnabled: true`, zadano od SDK 57), pa Androidova traka s tri
 * gumba — neprozirna, ~48 dp — leži PREKO dna svakog ScrollViewa.
 *
 * iOS nosi POLOVICU (dorada 10.9.2026., Markov nalaz: „u sidebaru i u
 * opcijama zadnja opcija je preblizu dna, nema prostora ispod").
 *
 * 6.9. je iOS dobio 0 jer je pitanje bilo „prekriva li traka tekst" — a
 * ne prekriva: indikator početnog zaslona je proziran i tanak, pa se
 * ispod njega sve ČITA. Ali čitljivo nije isto što i udobno: zadnji red
 * je time završavao točno na indikatoru, bez ijednog piksela zraka, i to
 * je ono što bode. Pola inseta (~17 od 34 pt) daje disanje, a ne otvara
 * prazan pojas kakav bi puni inset napravio ispod prozirnog indikatora.
 *
 * Vrijednost je IZVEDENA iz `insets.bottom`, ne konstanta: uređaji bez
 * indikatora (SE s tipkom) imaju 0 i tada ne dobivaju ništa — a tamo
 * dodatni prostor ni ne treba, jer nema što izbjegavati.
 *
 * Zašto hook, a ne `pb-12` po ekranu: visina trake ovisi o uređaju
 * (gestualna ~24 dp, tri gumba ~48 dp) i ne može se pogoditi konstantom —
 * `useSafeAreaInsets().bottom` je jedini izvor koji zna pravu brojku.
 *
 * Koristi se KAO DODATAK na postojeći padding, ne umjesto njega:
 * `paddingBottom: 16 + useBottomInset()`.
 */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "android") return insets.bottom;
  // iOS: pola sigurnog ruba — vidi objašnjenje gore.
  return Math.round(insets.bottom / 2);
}
