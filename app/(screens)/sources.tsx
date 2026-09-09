import { ExternalLink } from "lucide-react-native";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { Hairline } from "@/components/Section";
import { useBottomInset } from "@/hooks/useBottomInset";
import { t } from "@/i18n";
import { useThemeColors } from "@/theme/useThemeColors";

const SOURCES = [
  { name: t.sources.dhmzName, desc: t.sources.dhmzDesc, url: "https://meteo.hr" },
  {
    name: t.sources.meteoalarmName,
    desc: t.sources.meteoalarmDesc,
    url: "https://meteoalarm.org",
  },
  {
    name: t.sources.openMeteoName,
    desc: t.sources.openMeteoDesc,
    url: "https://open-meteo.com",
  },
  /*
   * LibreWXR umjesto RainViewera od 9.9.2026. — RainViewer je ukinuo
   * nowcast 1.1.2026. i zakomentiran je u `MAP_LAYERS`. Podaci CC-BY-4.0,
   * pa je navođenje izvora obveza, ne uljudnost.
   */
  {
    name: t.sources.librewxrName,
    desc: t.sources.librewxrDesc,
    url: "https://librewxr.net",
  },
  {
    name: t.sources.windyName,
    desc: t.sources.windyDesc,
    url: "https://www.windy.com/webcams",
  },
  {
    name: t.sources.owmName,
    desc: t.sources.owmDesc,
    url: "https://openweathermap.org",
  },
];

/** Izvori podataka u jeziku redizajna (6.8.2026.): kartica na mist podlozi. */
export default function SourcesScreen() {
  const { fg } = useThemeColors();

  // Androidova navigacijska traka leži preko dna (edge-to-edge) — vidi hook.
  const bottomInset = useBottomInset();

  return (
    <ScrollView
      className="flex-1 bg-mist dark:bg-night"
      contentContainerClassName="px-4 pt-4"
      contentContainerStyle={{ paddingBottom: 16 + bottomInset }}
    >
      <View className="rounded-2xl bg-white py-0.5 dark:bg-coal">
        {SOURCES.map((source, i) => (
          <View key={source.url}>
            {i > 0 && <Hairline />}
            <Pressable
              onPress={() => Linking.openURL(source.url)}
              className="flex-row items-center gap-3 px-4 py-4"
            >
              <View className="flex-1 gap-1">
                <Text className="font-grotesk-medium text-[16px] text-ink dark:text-paper">
                  {source.name}
                </Text>
                <Text className="font-grotesk text-[13px] text-ink/65 dark:text-paper/65">
                  {source.desc}
                </Text>
              </View>
              <ExternalLink size={18} strokeWidth={2} color={fg} opacity={0.45} />
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
