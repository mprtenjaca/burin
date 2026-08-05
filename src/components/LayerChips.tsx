import { Pressable, ScrollView, Text, View } from "react-native";

import type { MapLayerId } from "@/api/mapLayers";
import { MAP_LAYERS, isLayerAvailable } from "@/api/mapLayers";
import { t } from "@/i18n";

/**
 * Preklopnici slojeva. Slojevi koji traže OWM ključ ostaju **vidljivi ali
 * onemogućeni** kad ključa nema (sivo + napomena) — prije su se skrivali, pa
 * se nije vidjelo da postoje. Radar je uvijek dostupan.
 */
export function LayerChips({
  active,
  onChange,
}: {
  active: MapLayerId;
  onChange: (layer: MapLayerId) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4"
    >
      {MAP_LAYERS.map((layer) => {
        const isActive = layer.id === active;
        const available = isLayerAvailable(layer);
        return (
          <Pressable
            key={layer.id}
            onPress={() => available && onChange(layer.id)}
            disabled={!available}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled: !available }}
            className={`rounded-full border px-4 py-1.5 ${
              isActive
                ? "border-mint bg-paper dark:bg-night"
                : "border-ink/15 bg-paper/90 dark:border-paper/20 dark:bg-night/90"
            } ${available ? "" : "opacity-50"}`}
          >
            <View className="items-center">
              <Text
                className={`text-sm ${
                  isActive ? "text-mint" : "text-ink/70 dark:text-paper/70"
                }`}
              >
                {layer.label}
              </Text>
              {!available && (
                <Text className="text-[10px] text-ink/50 dark:text-paper/50">
                  {t.map.needsOwmKey}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
