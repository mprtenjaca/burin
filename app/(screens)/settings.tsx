import { router } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Hairline, Section } from "@/components/Section";
import { t } from "@/i18n";
import type { ThemeSetting } from "@/store/settings";
import { useSettings } from "@/store/settings";
import { useThemeColors } from "@/theme/useThemeColors";
import { ACCENT_CORAL } from "@/utils/weatherLook";

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
      className="flex-row items-center justify-between px-4 py-4"
    >
      <Text
        className={`font-grotesk-medium text-[16px] ${
          active ? "" : "text-ink dark:text-paper"
        }`}
        style={active ? { color: ACCENT_CORAL } : undefined}
      >
        {label}
      </Text>
      {active && <Check size={20} strokeWidth={2} color={ACCENT_CORAL} />}
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
    <View className="flex-row gap-2.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`rounded-full px-5 py-2.5 ${
              active ? "" : "bg-white dark:bg-coal"
            }`}
            style={active ? { backgroundColor: ACCENT_CORAL } : undefined}
          >
            <Text
              className={`font-grotesk-bold text-[15px] ${
                active ? "text-white" : "text-ink/70 dark:text-paper/70"
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

/** Postavke u jeziku redizajna (6.8.2026.): bijele kartice na mist podlozi. */
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
      className="flex-1 bg-mist dark:bg-night"
      contentContainerClassName="gap-6 px-4 py-4"
    >
      <Section title={t.settings.theme}>
        <View className="rounded-2xl bg-white py-0.5 dark:bg-coal">
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
        <View className="gap-4 rounded-2xl bg-white px-4 py-4 dark:bg-coal">
          <View className="gap-2.5">
            <Text className="font-grotesk-medium text-[14px] text-ink/70 dark:text-paper/70">
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
          <Hairline />
          <View className="gap-2.5">
            <Text className="font-grotesk-medium text-[14px] text-ink/70 dark:text-paper/70">
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
        className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-4 dark:bg-coal"
      >
        <Text className="font-grotesk-medium text-[16px] text-ink dark:text-paper">
          {t.settings.sources}
        </Text>
        <ChevronRight size={20} strokeWidth={2} color={fg} opacity={0.45} />
      </Pressable>

      {/*
        Pregled pozadina po vremenu: efekti se vežu uz WMO kodove koje u
        stvarnosti nemamo kad ih razvijamo (snijeg u kolovozu, magla po
        suncu). Ostaje u postavkama dok se izgled ne zaključa.
      */}
      <Pressable
        onPress={() => router.navigate("/preview")}
        className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-4 dark:bg-coal"
      >
        <Text className="font-grotesk-medium text-[16px] text-ink dark:text-paper">
          {t.settings.weatherPreview}
        </Text>
        <ChevronRight size={20} strokeWidth={2} color={fg} opacity={0.45} />
      </Pressable>
    </ScrollView>
  );
}
