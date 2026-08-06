import Slider from "@react-native-community/slider";
import { Pause, Play } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import type { MapLayer } from "@/api/mapLayers";
import type { RadarFrame } from "@/api/types";
import type { TimelineHour } from "@/hooks/useTimelineHours";
import { t } from "@/i18n";
import { useThemeColors } from "@/theme/useThemeColors";
import { clockTime } from "@/utils/format";
import { ACCENT_CORAL } from "@/utils/weatherLook";

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
 * Indeks koraka "sada" — sidro crte. Kad ga nema (npr. radar bez ijednog
 * izmjerenog okvira), vraća -1 i crta se ponaša kao prije.
 */
export function nowStepIndex(steps: Step[]): number {
  return steps.findIndex((s) => s.isNow);
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

  /*
   * Sidro "Sada" na skali (dorada 6.8.2026.): crta ide OD prošlosti
   * PREKO sada U BUDUĆNOST, pa se mora vidjeti gdje je ta granica.
   * Oznaka stoji na svom stvarnom mjestu, a ne uvijek na kraju.
   *
   * Na radaru je "sada" pri kraju jer RainViewer nowcast zna biti prazan
   * (izmjereno 6.8.2026.: 13 prošlih okvira, 0 nowcasta). Na Open-Meteo
   * slojevima je otprilike u sredini (past_days=1, forecast_days=3).
   */
  const nowIdx = nowStepIndex(steps);
  const lastIdx = Math.max(1, steps.length - 1);
  const nowPct = nowIdx >= 0 ? (nowIdx / lastIdx) * 100 : undefined;
  const isFuture = nowIdx >= 0 && index > nowIdx;

  return (
    /*
     * Tamna kartica preko karte (referentna slika, 6.8.2026.): naziv
     * sloja gore, ispod veliki sat + vrijednost, pa tanki klizač. Uvijek
     * tamna — na karti (koja je čas svijetla, čas tamna, čas plava) je
     * tamna ploha jedina podloga koja svugdje drži kontrast.
     */
    <View className="gap-2 rounded-2xl bg-ink/90 px-4 py-3">
      <Text className="font-grotesk-bold text-[12.5px] text-paper/60">
        {layer.label}
      </Text>

      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onTogglePlay}
          hitSlop={10}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={playing ? t.map.pause : t.map.play}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: disabled ? "#FAFAF81F" : ACCENT_CORAL }}
        >
          {playing ? (
            <Pause size={17} strokeWidth={2.5} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play
              size={17}
              strokeWidth={2.5}
              color="#FFFFFF"
              fill="#FFFFFF"
              opacity={disabled ? 0.4 : 1}
              // Trokut je optički lijevo od sredine kruga bez ovog pomaka.
              style={{ marginLeft: 2 }}
            />
          )}
        </Pressable>

        <View className="flex-1">
          <View className="flex-row items-baseline justify-between">
            <Text className="font-grotesk-bold text-[17px] text-paper">
              {step ? (step.isNow ? t.map.nowLabel : step.label) : "–"}
            </Text>
            {step?.note && (
              <Text
                className="font-grotesk-bold text-[13px]"
                style={{ color: isFuture ? ACCENT_CORAL : "#FAFAF8B3" }}
              >
                {step.note}
              </Text>
            )}
          </View>

          <View className="justify-center" style={{ height: 26 }}>
            {/* Šina + sidro "Sada" leže ISPOD klizača, kroz njegovu os. */}
            <View
              className="absolute left-0 right-0 rounded-full bg-paper/20"
              style={{ height: 3 }}
            />
            {nowPct !== undefined && (
              <View
                className="absolute rounded-full bg-paper/70"
                style={{ width: 2, height: 11, left: `${nowPct}%`, marginLeft: -1 }}
              />
            )}
            <Slider
              style={{ width: "100%", height: 26 }}
              minimumValue={0}
              maximumValue={Math.max(0, steps.length - 1)}
              step={1}
              value={index}
              disabled={disabled}
              onValueChange={(v) => onScrub(Math.round(v))}
              minimumTrackTintColor="transparent"
              maximumTrackTintColor="transparent"
              thumbTintColor={ACCENT_CORAL}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
