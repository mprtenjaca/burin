import { Text, View } from "react-native";

import { t } from "@/i18n";

export default function SearchScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-paper dark:bg-night">
      <Text className="text-ink dark:text-paper">{t.search.title}</Text>
    </View>
  );
}
