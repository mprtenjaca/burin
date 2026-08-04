import { Pressable, ScrollView, Text } from "react-native";

import { OWM_LAYERS, hasOwmKey, owmLayerLabel } from "@/api/owm";
import type { OwmLayer } from "@/api/types";
import { t } from "@/i18n";

export type LayerId = "radar" | OwmLayer;

/**
 * Preklopnici slojeva. "Radar" je uvijek dostupan; OWM slojevi samo
 * uz EXPO_PUBLIC_OWM_API_KEY.
 */
export function LayerChips({
  active,
  onChange,
}: {
  active: LayerId;
  onChange: (layer: LayerId) => void;
}) {
  const chips: { id: LayerId; label: string }[] = [
    { id: "radar", label: t.map.layerRadar },
    ...(hasOwmKey()
      ? OWM_LAYERS.map((l) => ({ id: l as LayerId, label: owmLayerLabel(l) }))
      : []),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4"
    >
      {chips.map((chip) => {
        const isActive = chip.id === active;
        return (
          <Pressable
            key={chip.id}
            onPress={() => onChange(chip.id)}
            className={`rounded-full border px-4 py-1.5 ${
              isActive
                ? "border-mint bg-paper dark:bg-night"
                : "border-ink/15 bg-paper/90 dark:border-paper/20 dark:bg-night/90"
            }`}
          >
            <Text
              className={`text-sm ${
                isActive ? "text-mint" : "text-ink/70 dark:text-paper/70"
              }`}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
