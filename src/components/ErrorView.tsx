import { Pressable, Text, View } from "react-native";

import { t } from "@/i18n";

/** Stanje greške s akcijom "Pokušaj ponovno". */
export function ErrorView({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <View className="items-center gap-3 py-10">
      <Text className="text-base text-ink/60 dark:text-paper/60">
        {message ?? t.common.noData}
      </Text>
      <Pressable onPress={onRetry} hitSlop={12}>
        <Text className="text-base font-medium text-mint">{t.common.retry}</Text>
      </Pressable>
    </View>
  );
}
