import { router, usePathname } from "expo-router";
import {
  Info,
  MapPin,
  Search,
  Settings,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Place } from "@/api/types";
import { t } from "@/i18n";
import { useCities } from "@/store/cities";
import { useThemeColors } from "@/theme/useThemeColors";
import { colors } from "@/theme/colors";

import { Hairline } from "./Section";

type DrawerNav = { closeDrawer: () => void };

function Item({
  label,
  Icon,
  active,
  onPress,
}: {
  label: string;
  Icon?: LucideIcon;
  active?: boolean;
  onPress: () => void;
}) {
  const { fg } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-5 py-3.5 active:bg-ink/5 dark:active:bg-paper/5"
    >
      {Icon && (
        <Icon
          size={18}
          strokeWidth={1.5}
          color={active ? colors.mint : fg}
          opacity={active ? 1 : 0.6}
        />
      )}
      <Text
        className={`text-[15px] ${
          active ? "text-mint" : "text-ink dark:text-paper"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Sadržaj ladice: Moja lokacija, spremljeni gradovi, Postavke, Izvori. */
export function DrawerContent({ navigation }: { navigation: DrawerNav }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const saved = useCities((s) => s.saved);
  const selected = useCities((s) => s.selected);
  const select = useCities((s) => s.select);

  const goHome = (place: Place | null) => {
    select(place);
    navigation.closeDrawer();
    router.navigate("/");
  };

  const go = (path: "/search" | "/settings" | "/sources") => {
    navigation.closeDrawer();
    router.navigate(path);
  };

  const onHome = pathname === "/";

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-night"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 24 }}
    >
      <Text className="px-5 pb-4 text-lg font-light tracking-[3px] text-ink dark:text-paper">
        {t.common.appName}
      </Text>
      <Hairline />
      <View className="py-2">
        <Item
          label={t.drawer.myLocation}
          Icon={MapPin}
          active={onHome && selected === null}
          onPress={() => goHome(null)}
        />
        {saved.map((city) => (
          <Item
            key={city.id}
            label={city.name}
            active={onHome && selected?.id === city.id}
            onPress={() => goHome(city)}
          />
        ))}
        <Item
          label={t.search.placeholder}
          Icon={Search}
          active={pathname === "/search"}
          onPress={() => go("/search")}
        />
      </View>
      <Hairline />
      <View className="py-2">
        <Item
          label={t.settings.title}
          Icon={Settings}
          active={pathname === "/settings"}
          onPress={() => go("/settings")}
        />
        <Item
          label={t.sources.title}
          Icon={Info}
          active={pathname === "/sources"}
          onPress={() => go("/sources")}
        />
      </View>
    </ScrollView>
  );
}
