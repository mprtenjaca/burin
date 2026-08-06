import { Text, View } from "react-native";
import Svg, { ClipPath, Defs, LinearGradient, Line, Rect, Stop } from "react-native-svg";

import { colors } from "@/theme/colors";
import type { GradientStops } from "@/utils/weatherLook";
import { readableOn } from "@/utils/weatherLook";

/**
 * Značka mjesta na karti (dorada 6.8.2026.): krug nosi GRADIJENT
 * TRENUTNOG VREMENA i dijagonalne pruge — isti jezik kao heroj, samo u
 * malom. Prije je bio ravan tamni krug; ovako se s karte odmah vidi
 * kakvo je vrijeme u odabranom mjestu, a ne samo koliko stupnjeva.
 *
 * Bijeli obrub i šiljak drže značku čitljivom nad svakom pločicom
 * (radar, temperatura, snijeg) — gradijent sam po sebi ne bi.
 */

const SIZE = 46;
const BORDER = 2.5;

/** Pruge u krugu: [pomak od lijevog ruba, širina, prozirnost]. */
const STRIPES: [number, number, number][] = [
  [-6, 3, 0.32],
  [6, 5, 0.16],
  [20, 2.5, 0.26],
  [30, 4, 0.34],
  [42, 5, 0.14],
];

/** Nagib pruga — isti dojam kao na heroju. */
const SLOPE = 0.55;

export function MapPin({
  temp,
  stops,
}: {
  /** Zaokružena temperatura; bez nje je značka samo točka. */
  temp?: number;
  /** Gradijent vremena; bez njega značka pada na tamnu ispunu. */
  stops?: GradientStops;
}) {
  const compact = temp === undefined;
  const size = compact ? 22 : SIZE;

  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          borderWidth: BORDER,
          borderColor: "#FFFFFF",
          backgroundColor: colors.ink,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          elevation: 4,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {stops && (
          <Svg
            width={size}
            height={size}
            style={{ position: "absolute", top: 0, left: 0 }}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id="pin-bg" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stops[0]} />
                <Stop offset="0.5" stopColor={stops[1]} />
                <Stop offset="1" stopColor={stops[2]} />
              </LinearGradient>
              {/* Pruge se režu na krug — inače vire preko obruba. */}
              <ClipPath id="pin-clip">
                <Rect x="0" y="0" width={size} height={size} rx={size / 2} />
              </ClipPath>
            </Defs>
            <Rect x="0" y="0" width={size} height={size} fill="url(#pin-bg)" />
            {STRIPES.map(([offset, w, opacity]) => (
              <Line
                key={offset}
                x1={size - offset}
                y1={0}
                x2={size - offset - size * SLOPE}
                y2={size}
                stroke="#FFFFFF"
                strokeWidth={w}
                strokeOpacity={opacity}
                clipPath="url(#pin-clip)"
              />
            ))}
          </Svg>
        )}

        {temp !== undefined && (
          <Text
            style={{
              /*
               * Boja se računa iz SREDNJEG stopa (ondje stoji tekst).
               * Bez toga bi ista značka bila nečitljiva na pola paleta:
               * tamna na noćnom indigu ili bijela na sunčanom zlatu.
               */
              color: stops ? readableOn(stops[1]) : "#FFFFFF",
              fontFamily: "SpaceGrotesk_700Bold",
              fontSize: 16,
            }}
          >
            {temp}°
          </Text>
        )}
      </View>

      {/* Šiljak: trokut iz obrubljenog kvadrata bez ispune. */}
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 9,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: "#FFFFFF",
        }}
      />
    </View>
  );
}
