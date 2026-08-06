import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { ACCENT_CORAL } from "@/utils/weatherLook";

/**
 * Wordmark "U redu" (Marko odabrao 6.8.2026. među 5 prijedloga): ikona
 * "Zapuh" lijevo + "burin" malim slovima, Space Grotesk Bold. Ikona je
 * isti glif kao u `scripts/generate-icons.mjs` — jedan izvor oblika.
 *
 * Koristi se u zaglavlju ladice, u traci početne (pri skrolu) i na karti.
 */
export function Wordmark({
  color,
  accent = ACCENT_CORAL,
  iconSize = 22,
  textSize = 18,
}: {
  /** Boja teksta i vanjskih zapuha — prilagođava se podlozi. */
  color: string;
  /** Srednji zapuh; zadano koraljni. */
  accent?: string;
  iconSize?: number;
  textSize?: number;
}) {
  return (
    <View className="flex-row items-center" style={{ gap: iconSize * 0.32 }}>
      <Svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.15}
      >
        <Path d="M9.59 4.59A2 2 0 1 1 11 8H2" stroke={color} />
        <Path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2" stroke={accent} />
        <Path d="M12.59 19.41A2 2 0 1 0 14 16H2" stroke={color} />
      </Svg>
      <Text
        style={{
          fontFamily: "SpaceGrotesk_700Bold",
          fontSize: textSize,
          letterSpacing: -0.5,
          color,
        }}
      >
        burin
      </Text>
    </View>
  );
}
