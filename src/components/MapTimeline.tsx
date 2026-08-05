import Slider from "@react-native-community/slider";
import { Pause, Play } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import type { MapLayer } from "@/api/mapLayers";
import type { RadarFrame } from "@/api/types";
import type { TimelineHour } from "@/hooks/useTimelineHours";
import { t } from "@/i18n";
import { colors } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { clockTime } from "@/utils/format";

/** Jedan korak crte, sveden na ono što se prikazuje. */
type Step = {
  label: string;
  /** Desna oznaka: "prognoza" za nowcast, vrijednost za centar na OWM slojevima. */
  note?: string;
  isNow: boolean;
};

function hourLabel(iso: string): string {
  return `${iso.slice(11, 13)}:00`;
}

/** Vrijednost za centar karte, ovisno o sloju (bez nje je klizač mrtav). */
function valueNote(layer: MapLayer, hour: TimelineHour): string | undefined {
  switch (layer.id) {
    case "temp_new":
      return hour.temp === undefined ? undefined : `${Math.round(hour.temp)}°`;
    case "clouds_new":
      return hour.cloudCover === undefined ? undefined : `${Math.round(hour.cloudCover)} %`;
    case "wind_new":
      return hour.windSpeed === undefined
        ? undefined
        : `${Math.round(hour.windSpeed)} km/h`;
    default:
      return undefined;
  }
}

/** Izvezeno radi testova: koraci crte za dani sloj. */
export function timelineSteps(
  layer: MapLayer,
  frames: RadarFrame[],
  hours: TimelineHour[],
): Step[] {
  if (layer.timeline === "frames") {
    return frames.map((f, i) => ({
      label: clockTime(f.time * 1000),
      note: f.isNowcast ? t.map.forecastLabel : undefined,
      // Zadnji izmjereni okvir je "sada"; nowcast je budućnost.
      isNow: !f.isNowcast && frames.map((x) => x.isNowcast).lastIndexOf(false) === i,
    }));
  }
  return hours.map((h) => ({
    label: hourLabel(h.time),
    note: valueNote(layer, h),
    isNow: h.isNow,
  }));
}

/**
 * Vremenska crta karte — **ista komponenta na svim slojevima**, uvijek na
 * istom mjestu na dnu. Play/pauza lijevo od klizača, oznaka vremena ispod.
 *
 * Na radaru koraci su RainViewer okviri i animacija mijenja sliku. Na OWM
 * slojevima besplatne pločice nose samo trenutno stanje, pa klizanje mijenja
 * sat i **vrijednost za centar karte** (temperatura / naoblaka / vjetar) —
 * kontrola ostaje smislena i nikad se ne skriva.
 */
export function MapTimeline({
  layer,
  frames,
  hours,
  index,
  playing,
  onTogglePlay,
  onScrub,
}: {
  layer: MapLayer;
  frames: RadarFrame[];
  hours: TimelineHour[];
  index: number;
  playing: boolean;
  onTogglePlay: () => void;
  onScrub: (index: number) => void;
}) {
  const { dark } = useThemeColors();
  const steps = timelineSteps(layer, frames, hours);
  const step = steps[index];

  // Bez koraka (izvor još učitava) crta ostaje vidljiva, ali neaktivna —
  // nikad se ne odmontira, da ne poskakuje pri prebacivanju sloja.
  const disabled = steps.length === 0;

  return (
    <View className="rounded-2xl border border-ink/[0.08] bg-paper/95 px-4 py-3 dark:border-paper/10 dark:bg-night/95">
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onTogglePlay}
          hitSlop={10}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={playing ? t.map.pause : t.map.play}
        >
          {playing ? (
            <Pause size={22} strokeWidth={1.5} color={colors.mint} />
          ) : (
            <Play
              size={22}
              strokeWidth={1.5}
              color={colors.mint}
              opacity={disabled ? 0.35 : 1}
            />
          )}
        </Pressable>
        <Slider
          style={{ flex: 1, height: 32 }}
          minimumValue={0}
          maximumValue={Math.max(0, steps.length - 1)}
          step={1}
          value={index}
          disabled={disabled}
          onValueChange={(v) => onScrub(Math.round(v))}
          minimumTrackTintColor={colors.mint}
          maximumTrackTintColor={dark ? "#FAFAF833" : "#14141426"}
          thumbTintColor={colors.mint}
        />
      </View>
      <View className="flex-row items-center justify-between pl-9">
        <Text className="text-xs text-ink/60 dark:text-paper/60">
          {step ? (step.isNow ? t.map.nowLabel : step.label) : "–"}
        </Text>
        {step?.note && <Text className="text-xs text-mint">{step.note}</Text>}
      </View>
    </View>
  );
}
