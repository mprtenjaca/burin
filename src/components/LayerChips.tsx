import { Cloudy, Radar, Thermometer, Wind } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import type { MapLayerId } from "@/api/mapLayers";
import { MAP_LAYERS, isLayerAvailable } from "@/api/mapLayers";
import { t } from "@/i18n";
import { ACCENT_CORAL } from "@/utils/weatherLook";

/** Ikona po sloju — ista kao u ladici, da se izbornici poklapaju. */
const LAYER_ICONS: Record<MapLayerId, LucideIcon> = {
  radar: Radar,
  temp_new: Thermometer,
  clouds_new: Cloudy,
  wind_new: Wind,
};

/**
 * Preklopnici slojeva kao OKOMITI STUPAC IKONA uz desni rub (dorada
 * 6.8.2026.) — vodoravni "pillovi" su jeli gornju trećinu karte, a
 * karta je sada fullscreen pa svaki piksel vrijedi.
 *
 * Stupac je jedna tamna ploha (kao vremenska crta): na karti koja je čas
 * svijetla, čas tamna, čas plava, tamna podloga jedina svugdje drži
 * kontrast. Aktivni sloj nosi koraljni krug — akcent aplikacije.
 *
 * Slojevi koji traže OWM ključ ostaju VIDLJIVI ali prigušeni (bez ključa
 * bi se inače činilo da ne postoje).
 */
export function LayerChips({
  active,
  onChange,
}: {
  active: MapLayerId;
  onChange: (layer: MapLayerId) => void;
}) {
  return (
    <View className="items-center gap-1 rounded-2xl bg-ink/85 px-1.5 py-2">
      {MAP_LAYERS.map((layer) => {
        const isActive = layer.id === active;
        const available = isLayerAvailable(layer);
        const Icon = LAYER_ICONS[layer.id];
        return (
          <Pressable
            key={layer.id}
            onPress={() => available && onChange(layer.id)}
            disabled={!available}
            accessibilityRole="button"
            accessibilityLabel={layer.label}
            accessibilityState={{ selected: isActive, disabled: !available }}
            className={`w-[54px] items-center gap-1 rounded-xl px-1 py-2 ${
              available ? "" : "opacity-40"
            }`}
            style={isActive ? { backgroundColor: ACCENT_CORAL } : undefined}
          >
            <Icon
              size={20}
              strokeWidth={2}
              color="#FFFFFF"
              opacity={isActive ? 1 : 0.75}
            />
            {/*
              Natpis ostaje ispod ikone: same ikone (radar vs naoblaka)
              se ne razlikuju dovoljno, a pravilo je da ništa bitno ne
              ide ispod 11px ni ispod 65 % kontrasta.
            */}
            <Text
              className="font-grotesk-bold text-[11px] text-white"
              style={{ opacity: isActive ? 1 : 0.7 }}
              numberOfLines={1}
            >
              {layer.label}
            </Text>
            {!available && (
              <Text className="font-grotesk text-[8.5px] text-white/60" numberOfLines={1}>
                {t.map.needsOwmKey}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
