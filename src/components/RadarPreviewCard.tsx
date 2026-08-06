import {
  Camera,
  Layer,
  Map as MapLibreMap,
  Marker,
  RasterSource,
} from "@maplibre/maplibre-react-native";
import { router } from "expo-router";
import { Linking, Pressable, Text, View } from "react-native";

import {
  MAP_BASE_ATTRIBUTION,
  MAP_BASE_STYLE_URL,
  MAP_LABELS_LAYER_ID,
  mapLayerById,
  mapLayerTileUrl,
} from "@/api/mapLayers";
import { useRadarFrames } from "@/hooks/useRadarFrames";
import { t } from "@/i18n";
import { weatherGradient } from "@/utils/weatherLook";

import { MapPin } from "./MapPin";
import { Card } from "./Section";

/** Stara latitudeDelta 2.4 ≈ jedan stupanj šire od regionalnog zooma 8. */
const PREVIEW_ZOOM = 7;

/**
 * Statični pregled zadnjeg radarskog okvira oko lokacije; dodir otvara
 * puni ekran karte. Radarske pločice i granice rastezanja dolaze iz istog
 * `MAP_LAYERS` unosa kao na punoj karti — jedan izvor istine.
 */
export function RadarPreviewCard({
  lat,
  lon,
  temp,
  code,
  isDay,
}: {
  lat: number;
  lon: number;
  /** Temperatura odabranog mjesta — značka je pokazuje bez ulaska u kartu. */
  temp?: number;
  code?: number;
  isDay?: boolean;
}) {
  const { data } = useRadarFrames();
  const lastPast = data?.frames.filter((f) => !f.isNowcast).at(-1);
  const radar = mapLayerById("radar");
  const tileUrl =
    data && lastPast
      ? mapLayerTileUrl(radar, { host: data.host, frame: lastPast })
      : null;

  // Ista značka kao na punoj karti — mjesto se vidi bez ulaska u nju.
  const pinStops =
    code === undefined ? undefined : weatherGradient(code, isDay ?? true, false);

  return (
    <Pressable onPress={() => router.navigate("/map")}>
      <Card className="overflow-hidden">
        <View style={{ height: 160 }} pointerEvents="none">
          {/*
            `androidView="texture"`: kartica je u scroll listi početne, a
            GLSurfaceView unutar ScrollViewa na Androidu ima poznate z-order
            artefakte; TextureView ih nema. Puni ekran karte ostaje na bržem
            zadanom (surface).
          */}
          <MapLibreMap
            style={{ flex: 1 }}
            mapStyle={MAP_BASE_STYLE_URL}
            androidView="texture"
            attribution={false}
            logo={false}
            compass={false}
            dragPan={false}
            touchZoom={false}
            doubleTapZoom={false}
            doubleTapHoldZoom={false}
            touchRotate={false}
            touchPitch={false}
          >
            <Camera initialViewState={{ center: [lon, lat], zoom: PREVIEW_ZOOM }} />
            {tileUrl && (
              <RasterSource
                id="radar-preview"
                tiles={[tileUrl]}
                tileSize={256}
                maxzoom={radar.maxNativeZ}
              >
                <Layer
                  type="raster"
                  id="radar-preview-layer"
                  beforeId={MAP_LABELS_LAYER_ID}
                  paint={{ "raster-opacity": radar.opacity }}
                />
              </RasterSource>
            )}
            {/* Značka odabranog mjesta — vidi se bez ulaska u kartu. */}
            <Marker lngLat={[lon, lat]} anchor="bottom">
              <MapPin
                temp={temp === undefined ? undefined : Math.round(temp)}
                stops={pinStops}
              />
            </Marker>
          </MapLibreMap>
        </View>
        <View className="flex-row items-center justify-between px-4 py-2.5">
          <Text className="text-sm text-ink/70 dark:text-paper/70">
            {t.home.radarPreview}
          </Text>
          {/* Atribucija je uvjet licence (OSM/ODbL, CARTO, RainViewer). */}
          <View className="flex-row items-center gap-1.5">
            <Pressable
              hitSlop={10}
              onPress={() => Linking.openURL("https://www.rainviewer.com")}
            >
              <Text className="text-[9px] text-ink/35 dark:text-paper/35">
                {t.map.radarAttribution}
              </Text>
            </Pressable>
            <Text className="text-[9px] text-ink/25 dark:text-paper/25">·</Text>
            <Pressable
              hitSlop={10}
              onPress={() => Linking.openURL(MAP_BASE_ATTRIBUTION.url)}
            >
              <Text className="text-[9px] text-ink/35 dark:text-paper/35">
                {MAP_BASE_ATTRIBUTION.label}
              </Text>
            </Pressable>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
