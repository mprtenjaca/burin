import Slider from "@react-native-community/slider";
import { Pause, Play } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import type { RadarFrame } from "@/api/types";
import { t } from "@/i18n";
import { colors } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { clockTime } from "@/utils/format";

/**
 * Player animacije radara: play/pauza + klizač po okvirima.
 * Nowcast okviri nose oznaku "prognoza".
 */
export function TimelinePlayer({
  frames,
  index,
  playing,
  onTogglePlay,
  onScrub,
}: {
  frames: RadarFrame[];
  index: number;
  playing: boolean;
  onTogglePlay: () => void;
  onScrub: (index: number) => void;
}) {
  const { dark } = useThemeColors();
  const frame = frames[index];
  if (!frame) return null;

  return (
    <View className="rounded-2xl border border-ink/[0.08] bg-paper/95 px-4 py-3 dark:border-paper/10 dark:bg-night/95">
      <View className="flex-row items-center gap-3">
        <Pressable onPress={onTogglePlay} hitSlop={10}>
          {playing ? (
            <Pause size={22} strokeWidth={1.5} color={colors.mint} />
          ) : (
            <Play size={22} strokeWidth={1.5} color={colors.mint} />
          )}
        </Pressable>
        <Slider
          style={{ flex: 1, height: 32 }}
          minimumValue={0}
          maximumValue={Math.max(0, frames.length - 1)}
          step={1}
          value={index}
          onValueChange={(v) => onScrub(Math.round(v))}
          minimumTrackTintColor={colors.mint}
          maximumTrackTintColor={dark ? "#FAFAF833" : "#14141426"}
          thumbTintColor={colors.mint}
        />
      </View>
      <View className="flex-row items-center justify-between pl-9">
        <Text className="text-xs text-ink/60 dark:text-paper/60">
          {clockTime(frame.time * 1000)}
        </Text>
        {frame.isNowcast && (
          <Text className="text-xs text-mint">{t.map.forecastLabel}</Text>
        )}
      </View>
    </View>
  );
}
