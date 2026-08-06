import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { ACCENT_CORAL } from "@/utils/weatherLook";

/**
 * Wordmark "Podcrt" (Marko odabrao 6.8.2026. u 3. krugu prijedloga):
 * riječ `burin`, a srednji zapuh glifa "Zapuh" ide POD njom i na kraju se
 * uvija UZ DESNI RUB riječi, u visini slova. Bez zasebne ikone slijeva —
 * logo je uplet u sam slog.
 *
 * Isti potez je i srednja (akcentna) linija glifa u
 * `scripts/generate-icons.mjs` — jedan izvor oblika za ikonu i wordmark.
 *
 * Koristi se u zaglavlju ladice, u traci početne (pri skrolu) i na karti.
 */

/**
 * Srednji zapuh iz glifa 24×24: crta ide zdesna ulijevo i na kraju se
 * uvija u kovrču. Put je NEDIRAN iz `generate-icons.mjs`.
 *
 * Granice (izračunato iz luka r = 2.5, centar (19.5, 9.5)):
 * x 2–22, y 7.0–12.0; uz pola debljine poteza kadar je
 * x 1.2–22.8, y 6.2–12.8.
 */
const GUST = "M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2";

export function Wordmark({
  color,
  accent = ACCENT_CORAL,
  textSize = 18,
}: {
  /** Boja teksta — prilagođava se podlozi. */
  color: string;
  /**
   * Boja poteza; zadano koraljna.
   *
   * NA TOPLIM PODLOGAMA proslijedi `heroAccent(...)`: koraljna se na
   * narančastom gradijentu utapa (izmjereno 6.8.2026.), a ovdje akcent
   * NOSI cijeli logo — ako izblijedi, wordmark ostane samo tekst.
   */
  accent?: string;
  textSize?: number;
}) {
  /*
   * MJERE SU IZVEDENE, ne pogođene (Markov ispravak 6.8.2026. + render u
   * PNG s pravim fontom):
   *
   * Kovrča mora stajati DESNO OD RIJEČI, u visini slova — ne spljoštena
   * pod cijelom riječi (prva izvedba) i ne preko slova (druga, gdje je
   * udarala u "n").
   *
   * Računica: riječ "burin" u Space Grotesk Boldu uz letterSpacing −0.5
   * široka je ≈ 2.62 × textSize. U putu zapuha vodoravni dio zauzima
   * prvih ~66 % širine, a kovrča zadnjih ~34 %. Da kovrča padne IZA
   * zadnjeg slova, ukupna širina mora biti wordW / 0.66.
   *
   * `preserveAspectRatio` se ČUVA (nema `none`), pa kovrča ostaje
   * okrugla; visina slijedi iz odnosa stranica kadra 21.6 : 6.6 ≈ 3.27.
   */
  const wordW = textSize * 2.62;
  const w = wordW / 0.66;
  const h = w / 3.27;

  return (
    /*
     * Potez je APSOLUTNO pozicioniran ispod riječi i NE povećava okvir:
     * inače bi wordmark u redu s hamburgerom i tražilicom gurao susjede
     * prema dolje. Zato nosač dobiva visinu teksta + rep poteza.
     */
    <View style={{ width: w, height: textSize * 0.34 + h }} className="items-start justify-start">
      <Text
        style={{
          fontFamily: "SpaceGrotesk_700Bold",
          fontSize: textSize,
          letterSpacing: -0.5,
          color,
          // Rep poteza staje ispod baseline-a bez razmicanja retka.
          includeFontPadding: false,
        }}
      >
        burin
      </Text>
      <Svg
        width={w}
        height={h}
        viewBox="1.2 6.2 21.6 6.6"
        style={{
          position: "absolute",
          left: 0,
          /*
           * 0.34 × textSize: kovrča tada dosegne visinu slova, a
           * vodoravni dio poteza prolazi ispod riječi. Izmjereno
           * renderom — na 0.52 je potez visio nisko pod riječi.
           */
          top: textSize * 0.34,
        }}
      >
        <Path
          d={GUST}
          fill="none"
          stroke={accent}
          /*
           * 1.2 u jedinicama kadra (Markov odabir 6.8.2026.): 1.9 je bilo
           * pretromo uz slova, 1.5 još uvijek malo debelo.
           */
          strokeWidth={1}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
