import { Text, View } from "react-native";

import type { OwmLayer } from "@/api/types";
import { t } from "@/i18n";

type LayerId = "radar" | OwmLayer;

/** Skala boja po sloju — bez ovoga korisnik ne zna što crveno/zeleno znači. */
const SCALES: Record<LayerId, { colors: string[]; from: string; to: string }> = {
  radar: {
    colors: ["#8CD1F5", "#2E9DF7", "#2EE68A", "#F5E12E", "#F58A2E", "#E63946"],
    from: t.map.legendWeak,
    to: t.map.legendStrong,
  },
  temp_new: {
    colors: ["#8E44AD", "#2E86DE", "#2EE6A8", "#F5E12E", "#F58A2E", "#E63946"],
    from: "-40 °C",
    to: "+40 °C",
  },
  clouds_new: {
    colors: ["#FFFFFF00", "#FFFFFF55", "#FFFFFF99", "#FFFFFFDD", "#FFFFFF"],
    from: "0 %",
    to: "100 %",
  },
  wind_new: {
    colors: ["#E8F8F0", "#A8E6C9", "#2EE6A8", "#2E9DF7", "#8E44AD"],
    from: "0 m/s",
    to: "50+ m/s",
  },
  precipitation_new: {
    colors: ["#C9E9F5", "#8CD1F5", "#2E9DF7", "#2E5BF7", "#8E44AD"],
    from: t.map.legendWeak,
    to: t.map.legendStrong,
  },
};

export function LayerLegend({ layer }: { layer: LayerId }) {
  const scale = SCALES[layer];

  return (
    <View className="gap-1.5 rounded-2xl border border-ink/[0.08] bg-paper/95 px-3 py-2 dark:border-paper/10 dark:bg-night/95">
      {layer === "wind_new" && (
        <Text className="text-[10px] text-ink/50 dark:text-paper/50">
          {t.map.legendWindArrows}
        </Text>
      )}
      <View className="h-1.5 flex-row overflow-hidden rounded-full">
        {scale.colors.map((color) => (
          <View key={color} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </View>
      <View className="flex-row justify-between">
        <Text className="text-[10px] text-ink/50 dark:text-paper/50">
          {scale.from}
        </Text>
        <Text className="text-[10px] text-ink/50 dark:text-paper/50">
          {scale.to}
        </Text>
      </View>
    </View>
  );
}
