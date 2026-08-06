import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { t } from "@/i18n";
import { useThemeColors } from "@/theme/useThemeColors";
import { formatTime } from "@/utils/format";

const H = 44;
const Y0 = 36;
const PEAK_Y = 8;
/** Dan počinje/završava na ovim udjelima širine — stilizirano kao referenca. */
const X_RISE = 0.16;
const X_SET = 0.84;

/**
 * Kartica zalaska (po referentnoj slici, 6.8.2026.): veliko vrijeme
 * zalaska priljubljeno uz krivulju, krivulja sa SIVIM ravnim krajevima
 * (noć) i žuto→narančastim lukom (dan), okomita crtica na sredini vrha;
 * dolje "Izlazak: HH:MM".
 */
export function SunCycle({ sunrise, sunset }: { sunrise: string; sunset: string }) {
  const { dark } = useThemeColors();
  const [w, setW] = useState(0);

  const xR = w * X_RISE;
  const xS = w * X_SET;
  // Kvadratni Bézier kroz vrh: kontrolna točka da vrh bude na PEAK_Y.
  const ctrlY = 2 * PEAK_Y - Y0;
  const mid = (xR + xS) / 2;

  const night = dark ? "rgba(250,250,248,.3)" : "rgba(20,20,20,.22)";
  const tick = dark ? "#FAFAF8" : "#141414";

  return (
    <View className="flex-1" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {/* Vrijeme + krivulja kao cjelina, centrirani u kartici. */}
      <View className="flex-1 justify-center">
        <Text className="text-center font-grotesk-bold text-[30px] text-ink dark:text-paper" style={{ marginBottom: -8 }}>
          {formatTime(sunset)}
        </Text>
        {w > 0 && (
          <Svg width={w} height={H}>
            <Defs>
              <LinearGradient id="sun-day" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#F5D547" />
                <Stop offset="1" stopColor="#EE8F3C" />
              </LinearGradient>
            </Defs>
            {/* Noć: ravne sive crte prije izlaska i poslije zalaska. */}
            <Line x1={0} y1={Y0} x2={xR} y2={Y0} stroke={night} strokeWidth={2} />
            <Line x1={xS} y1={Y0} x2={w} y2={Y0} stroke={night} strokeWidth={2} />
            {/* Dan: žuto→narančasti luk. */}
            <Path d={`M ${xR} ${Y0} Q ${mid} ${ctrlY} ${xS} ${Y0}`} fill="none" stroke="url(#sun-day)" strokeWidth={2.5} strokeLinecap="round" />
            {/* Okomita crtica na sredini vrha, kao na referenci. */}
            <Line x1={mid} y1={PEAK_Y - 5} x2={mid} y2={PEAK_Y + 5} stroke={tick} strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        )}
      </View>
      <Text className="font-grotesk-medium text-[12.5px] text-ink/70 dark:text-paper/70">
        {t.home.sunriseShort}: {formatTime(sunrise)}
      </Text>
    </View>
  );
}
