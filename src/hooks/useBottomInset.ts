import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Donji rub koji sadržaj MORA ostaviti praznim da ga ne pokrije sustavna
 * navigacijska traka (popravak 6.9.2026., Markov nalaz na uređaju: tekst na
 * dnu početne i peludi "se ne vidi u potpunosti, prekriva ga Android
 * bottom nav").
 *
 * Zašto samo Android: aplikacija je u edge-to-edge načinu
 * (`edgeToEdgeEnabled: true`, zadano od SDK 57), pa Androidova traka s tri
 * gumba — neprozirna, ~48 dp — leži PREKO dna svakog ScrollViewa. iOS-ov
 * indikator početnog zaslona je proziran i tanak, pa se ispod njega sve
 * čita; Marko je na iPhoneu potvrdio da je u redu. Dodati inset i ondje
 * značilo bi prazan pojas bez razloga.
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
  return Platform.OS === "android" ? insets.bottom : 0;
}
