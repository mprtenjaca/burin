import { router } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Hairline, Section } from "@/components/Section";
import { t } from "@/i18n";
import type { ThemeSetting } from "@/store/settings";
import { useSettings } from "@/store/settings";
import { colors } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";

function OptionRow({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between py-3"
    >
      <Text
        className={`text-[15px] ${active ? "text-mint" : "text-ink dark:text-paper"}`}
      >
        {label}
      </Text>
      {active && <Check size={18} strokeWidth={1.5} color={colors.mint} />}
    </Pressable>
  );
}

function UnitChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`rounded-full border px-4 py-1.5 ${
              active
                ? "border-mint"
                : "border-ink/15 dark:border-paper/20"
            }`}
          >
            <Text
              className={`text-sm ${
                active ? "text-mint" : "text-ink/70 dark:text-paper/70"
              }`}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { fg } = useThemeColors();
  const theme = useSettings((s) => s.theme);
  const tempUnit = useSettings((s) => s.tempUnit);
  const windUnit = useSettings((s) => s.windUnit);
  const setTheme = useSettings((s) => s.setTheme);
  const setTempUnit = useSettings((s) => s.setTempUnit);
  const setWindUnit = useSettings((s) => s.setWindUnit);

  const themes: { value: ThemeSetting; label: string }[] = [
    { value: "light", label: t.settings.themeLight },
    { value: "dark", label: t.settings.themeDark },
    { value: "system", label: t.settings.themeSystem },
  ];

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-night"
      contentContainerClassName="gap-8 px-5 py-6"
    >
      <Section title={t.settings.theme}>
        <View>
          {themes.map((option, i) => (
            <View key={option.value}>
              {i > 0 && <Hairline />}
              <OptionRow
                label={option.label}
                active={theme === option.value}
                onPress={() => setTheme(option.value)}
              />
            </View>
          ))}
        </View>
      </Section>

      <Section title={t.settings.units}>
        <View className="gap-4">
          <View className="gap-2">
            <Text className="text-sm text-ink/60 dark:text-paper/60">
              {t.settings.tempUnit}
            </Text>
            <UnitChips
              options={[
                { value: "C" as const, label: "°C" },
                { value: "F" as const, label: "°F" },
              ]}
              value={tempUnit}
              onChange={setTempUnit}
            />
          </View>
          <View className="gap-2">
            <Text className="text-sm text-ink/60 dark:text-paper/60">
              {t.settings.windUnit}
            </Text>
            <UnitChips
              options={[
                { value: "kmh" as const, label: "km/h" },
                { value: "ms" as const, label: "m/s" },
              ]}
              value={windUnit}
              onChange={setWindUnit}
            />
          </View>
        </View>
      </Section>

      <Pressable
        onPress={() => router.navigate("/sources")}
        className="flex-row items-center justify-between rounded-2xl border border-ink/[0.08] px-4 py-3.5 dark:border-paper/10"
      >
        <Text className="text-[15px] text-ink dark:text-paper">
          {t.settings.sources}
        </Text>
        <ChevronRight size={18} strokeWidth={1.5} color={fg} opacity={0.4} />
      </Pressable>
    </ScrollView>
  );
}
