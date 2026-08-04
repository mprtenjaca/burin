import { Bookmark, BookmarkCheck, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { geocode } from "@/api/openMeteo";
import type { Place } from "@/api/types";
import { ErrorView } from "@/components/ErrorView";
import { Hairline } from "@/components/Section";
import { t } from "@/i18n";
import { useCities } from "@/store/cities";
import { useThemeColors } from "@/theme/useThemeColors";
import { colors } from "@/theme/colors";
import { router } from "expo-router";

const DEBOUNCE_MS = 350;

export default function SearchScreen() {
  const { fg, dark } = useThemeColors();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const saved = useCities((s) => s.saved);
  const selected = useCities((s) => s.selected);
  const addCity = useCities((s) => s.addCity);
  const removeCity = useCities((s) => s.removeCity);
  const select = useCities((s) => s.select);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setFailed(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setFailed(false);
      try {
        setResults(await geocode(q));
      } catch {
        setFailed(true);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, attempt]);

  const open = (place: Place) => {
    select(place);
    router.navigate("/");
  };

  const isSaved = (id: string) => saved.some((p) => p.id === id);

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-night"
      contentContainerClassName="gap-6 px-5 py-5"
      keyboardShouldPersistTaps="handled"
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t.search.placeholder}
        placeholderTextColor={dark ? "#FAFAF866" : "#14141466"}
        autoFocus
        autoCorrect={false}
        className="rounded-2xl border border-ink/[0.08] px-4 py-3 text-base text-ink dark:border-paper/10 dark:text-paper"
      />

      {selected === null && saved.length === 0 && query.length === 0 && (
        <Text className="text-center text-sm text-ink/50 dark:text-paper/50">
          {t.search.pickCityToStart}
        </Text>
      )}

      {searching && <ActivityIndicator size="small" color={colors.mint} />}

      {failed && (
        <ErrorView onRetry={() => setAttempt((n) => n + 1)} />
      )}

      {!failed && query.trim().length >= 2 && !searching && results.length === 0 && (
        <Text className="text-center text-sm text-ink/50 dark:text-paper/50">
          {t.search.noResults}
        </Text>
      )}

      {results.length > 0 && (
        <View>
          {results.map((place, i) => (
            <View key={`${place.id}-${i}`}>
              {i > 0 && <Hairline />}
              <View className="flex-row items-center">
                <Pressable className="flex-1 py-3" onPress={() => open(place)}>
                  <Text className="text-[15px] text-ink dark:text-paper">
                    {place.name}
                  </Text>
                  {place.country && (
                    <Text className="text-xs text-ink/50 dark:text-paper/50">
                      {place.country}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  hitSlop={10}
                  onPress={() =>
                    isSaved(place.id) ? removeCity(place.id) : addCity(place)
                  }
                >
                  {isSaved(place.id) ? (
                    <BookmarkCheck size={20} strokeWidth={1.5} color={colors.mint} />
                  ) : (
                    <Bookmark size={20} strokeWidth={1.5} color={fg} opacity={0.5} />
                  )}
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {saved.length > 0 && (
        <View className="gap-3">
          <Text className="text-xs uppercase tracking-[2px] text-ink/50 dark:text-paper/50">
            {t.search.savedCities}
          </Text>
          <View>
            {saved.map((place, i) => (
              <View key={place.id}>
                {i > 0 && <Hairline />}
                <View className="flex-row items-center">
                  <Pressable className="flex-1 py-3" onPress={() => open(place)}>
                    <Text className="text-[15px] text-ink dark:text-paper">
                      {place.name}
                    </Text>
                    {place.country && (
                      <Text className="text-xs text-ink/50 dark:text-paper/50">
                        {place.country}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => removeCity(place.id)}>
                    <X size={18} strokeWidth={1.5} color={fg} opacity={0.4} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
