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

import { OWM_MAX_NATIVE_Z, owmTileSource } from "@/api/owm";
import { rainviewerTileSource } from "@/api/rainviewer";
import { ErrorView } from "@/components/ErrorView";
import type { LayerId } from "@/components/LayerChips";
import { LayerChips } from "@/components/LayerChips";
import { LayerLegend } from "@/components/LayerLegend";
import { TimelinePlayer } from "@/components/TimelinePlayer";
import { useLocation } from "@/hooks/useLocation";
import { useRadarFrames } from "@/hooks/useRadarFrames";
import { useCities } from "@/store/cities";
import { colors } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";

const FRAME_INTERVAL_MS = 600;

/** RainViewer besplatne pločice postoje do zoom razine 10. */
const RADAR_MAX_NATIVE_Z = 10;

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { fg } = useThemeColors();
  const selected = useCities((s) => s.selected);
  const gps = useLocation(selected === null);
  const radar = useRadarFrames();

  // Karta se centrira na odabrano mjesto, a za "Moja lokacija" na GPS.
  const focus = selected ?? (gps.status === "granted" ? gps.place : null);

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

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = setInterval(() => {
      setScrubIndex((i) => ((i ?? lastPastIdx) + 1) % frames.length);
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, frames.length, lastPastIdx]);

  // Kad se odabrano mjesto promijeni (drugi grad u ladici), pomakni kartu.
  useEffect(() => {
    if (!focus) return;
    mapRef.current?.animateToRegion(
      {
        latitude: focus.lat,
        longitude: focus.lon,
        latitudeDelta: 1.2,
        longitudeDelta: 1.2,
      },
      600,
    );
  }, [focus?.id]);

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
  const owmSource = layer !== "radar" ? owmTileSource(layer) : null;
  const attribution =
    layer === "radar"
      ? { label: "Radar: RainViewer", url: "https://www.rainviewer.com" }
      : { label: "© OpenWeatherMap", url: "https://openweathermap.org" };

  return (
    <View className="flex-1 bg-paper dark:bg-night">
      {/*
        `key` po sloju: prebacivanje Radar <-> OWM inače odmontira jedan
        UrlTile i montira drugi unutar iste karte, što na Androidu ruši
        nativni view (crash na "Temperatura"). Ovako se karta čisto
        rekreira po sloju.
      */}
      <MapView
        key={`map-${layer}`}
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: focus?.lat ?? 45.1,
          longitude: focus?.lon ?? 16.4,
          latitudeDelta: focus ? 1.2 : 3.6,
          longitudeDelta: focus ? 1.2 : 3.6,
        }}
        toolbarEnabled={false}
        minZoomLevel={4}
        maxZoomLevel={10}
      >
        {layer === "radar" && host && activeFrame && (
          <UrlTile
            urlTemplate={rainviewerTileSource(host, activeFrame).urlTemplate}
            opacity={0.7}
            maximumNativeZ={RADAR_MAX_NATIVE_Z}
            maximumZ={RADAR_MAX_NATIVE_Z}
            zIndex={2}
          />
        )}
        {owmSource && (
          <UrlTile
            urlTemplate={owmSource.urlTemplate}
            opacity={owmSource.opacity}
            maximumNativeZ={OWM_MAX_NATIVE_Z}
            maximumZ={OWM_MAX_NATIVE_Z}
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
        <LayerLegend layer={layer} />
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
