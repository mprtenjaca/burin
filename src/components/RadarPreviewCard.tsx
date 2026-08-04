import { router } from "expo-router";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, UrlTile } from "react-native-maps";

import { rainviewerTileSource } from "@/api/rainviewer";
import { t } from "@/i18n";
import { useRadarFrames } from "@/hooks/useRadarFrames";

import { Card } from "./Section";

/**
 * Statični pregled zadnjeg radarskog okvira oko lokacije; dodir otvara
 * puni ekran karte. Namjerno NIJE liteMode — Google lite mode ne
 * podržava tile overlaye.
 */
export function RadarPreviewCard({ lat, lon }: { lat: number; lon: number }) {
  const { data } = useRadarFrames();
  const lastPast = data?.frames.filter((f) => !f.isNowcast).at(-1);

  return (
    <Pressable onPress={() => router.navigate("/map")}>
      <Card className="overflow-hidden">
        <View style={{ height: 160 }} pointerEvents="none">
          <MapView
            style={{ flex: 1 }}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: lat,
              longitude: lon,
              latitudeDelta: 2.4,
              longitudeDelta: 2.4,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            showsCompass={false}
          >
            {data && lastPast && (
              <UrlTile
                urlTemplate={rainviewerTileSource(data.host, lastPast).urlTemplate}
                opacity={0.7}
                maximumNativeZ={10}
              />
            )}
          </MapView>
        </View>
        <View className="flex-row items-center justify-between px-4 py-2.5">
          <Text className="text-sm text-ink/70 dark:text-paper/70">
            {t.home.radarPreview}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() => Linking.openURL("https://www.rainviewer.com")}
          >
            <Text className="text-[11px] text-ink/40 dark:text-paper/40">
              {t.map.radarAttribution}
            </Text>
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
}
