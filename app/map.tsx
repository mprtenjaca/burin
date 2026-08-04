import * as Location from "expo-location";
import { LocateFixed } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, UrlTile } from "react-native-maps";

import { owmTileSource } from "@/api/owm";
import { rainviewerTileSource } from "@/api/rainviewer";
import { ErrorView } from "@/components/ErrorView";
import type { LayerId } from "@/components/LayerChips";
import { LayerChips } from "@/components/LayerChips";
import { TimelinePlayer } from "@/components/TimelinePlayer";
import { useRadarFrames } from "@/hooks/useRadarFrames";
import { useCities } from "@/store/cities";
import { colors } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";

const FRAME_INTERVAL_MS = 600;

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { fg } = useThemeColors();
  const selected = useCities((s) => s.selected);
  const radar = useRadarFrames();

  const [layer, setLayer] = useState<LayerId>("radar");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const frames = radar.data?.frames ?? [];
  const host = radar.data?.host;

  // Zadani okvir: zadnji izmjereni (ne-nowcast).
  const lastPastIdx = useMemo(() => {
    const idx = frames.map((f) => f.isNowcast).lastIndexOf(false);
    return idx >= 0 ? idx : Math.max(0, frames.length - 1);
  }, [frames]);

  const index = scrubIndex ?? lastPastIdx;
  const nextIndex = frames.length > 0 ? (index + 1) % frames.length : 0;

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = setInterval(() => {
      setScrubIndex((i) => ((i ?? lastPastIdx) + 1) % frames.length);
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, frames.length, lastPastIdx]);

  const locateMe = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));
      mapRef.current?.animateToRegion(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 1.6,
          longitudeDelta: 1.6,
        },
        600,
      );
    } catch {
      // bez lokacije nema centriranja — ništa kritično
    }
  };

  const activeFrame = frames[index];
  const preloadFrame = frames[nextIndex];
  const owmSource = layer !== "radar" ? owmTileSource(layer) : null;
  const attribution =
    layer === "radar"
      ? { label: "Radar: RainViewer", url: "https://www.rainviewer.com" }
      : { label: "© OpenWeatherMap", url: "https://openweathermap.org" };

  return (
    <View className="flex-1 bg-paper dark:bg-night">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: selected?.lat ?? 45.1,
          longitude: selected?.lon ?? 16.4,
          latitudeDelta: 3.6,
          longitudeDelta: 3.6,
        }}
        toolbarEnabled={false}
      >
        {layer === "radar" && host && activeFrame && (
          <UrlTile
            key={activeFrame.path}
            urlTemplate={rainviewerTileSource(host, activeFrame).urlTemplate}
            opacity={0.7}
            maximumNativeZ={10}
            zIndex={2}
          />
        )}
        {layer === "radar" && host && preloadFrame && preloadFrame !== activeFrame && (
          <UrlTile
            key={preloadFrame.path}
            urlTemplate={rainviewerTileSource(host, preloadFrame).urlTemplate}
            opacity={0.01}
            maximumNativeZ={10}
            zIndex={1}
          />
        )}
        {owmSource && (
          <UrlTile
            key={owmSource.id}
            urlTemplate={owmSource.urlTemplate}
            opacity={owmSource.opacity}
            zIndex={2}
          />
        )}
      </MapView>

      <View className="absolute left-0 right-0 top-3">
        <LayerChips
          active={layer}
          onChange={(l) => {
            setLayer(l);
            setPlaying(false);
          }}
        />
      </View>

      <Pressable
        onPress={locateMe}
        hitSlop={8}
        className="absolute right-4 top-16 h-11 w-11 items-center justify-center rounded-full border border-ink/[0.08] bg-paper/95 dark:border-paper/10 dark:bg-night/95"
      >
        <LocateFixed size={20} strokeWidth={1.5} color={fg} opacity={0.8} />
      </Pressable>

      <View className="absolute bottom-4 left-4 right-4 gap-2">
        <Pressable
          hitSlop={8}
          onPress={() => Linking.openURL(attribution.url)}
          className="self-start rounded-full bg-paper/90 px-3 py-1 dark:bg-night/90"
        >
          <Text className="text-[11px] text-ink/60 dark:text-paper/60">
            {attribution.label}
          </Text>
        </Pressable>

        {layer === "radar" && frames.length > 0 && (
          <TimelinePlayer
            frames={frames}
            index={index}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
            onScrub={(i) => {
              setPlaying(false);
              setScrubIndex(i);
            }}
          />
        )}
      </View>

      {layer === "radar" && radar.isPending && (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="small" color={colors.mint} />
        </View>
      )}
      {layer === "radar" && radar.isError && (
        <View className="absolute inset-0 items-center justify-center">
          <View className="rounded-2xl bg-paper/95 px-6 dark:bg-night/95">
            <ErrorView onRetry={() => void radar.refetch()} />
          </View>
        </View>
      )}
    </View>
  );
}
