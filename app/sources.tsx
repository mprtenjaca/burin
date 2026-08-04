import { ExternalLink } from "lucide-react-native";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { Hairline } from "@/components/Section";
import { t } from "@/i18n";
import { useThemeColors } from "@/theme/useThemeColors";

const SOURCES = [
  { name: t.sources.dhmzName, desc: t.sources.dhmzDesc, url: "https://meteo.hr" },
  {
    name: t.sources.openMeteoName,
    desc: t.sources.openMeteoDesc,
    url: "https://open-meteo.com",
  },
  {
    name: t.sources.rainviewerName,
    desc: t.sources.rainviewerDesc,
    url: "https://www.rainviewer.com",
  },
  {
    name: t.sources.owmName,
    desc: t.sources.owmDesc,
    url: "https://openweathermap.org",
  },
];

export default function SourcesScreen() {
  const { fg } = useThemeColors();

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-night"
      contentContainerClassName="px-5 py-4"
    >
      {SOURCES.map((source, i) => (
        <View key={source.url}>
          {i > 0 && <Hairline />}
          <Pressable
            onPress={() => Linking.openURL(source.url)}
            className="flex-row items-center gap-3 py-4"
          >
            <View className="flex-1 gap-0.5">
              <Text className="text-[15px] text-ink dark:text-paper">
                {source.name}
              </Text>
              <Text className="text-xs text-ink/50 dark:text-paper/50">
                {source.desc}
              </Text>
            </View>
            <ExternalLink size={16} strokeWidth={1.5} color={fg} opacity={0.4} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}
