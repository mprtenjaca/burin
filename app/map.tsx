import {
  Camera,
  Layer,
  Map as MapLibreMap,
  Marker,
  RasterSource,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { LocateFixed } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";

import {
  MAP_BASE_ATTRIBUTION,
  MAP_LABELS_LAYER_ID,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  baseStyleFor,
  isLayerAvailable,
  mapLayerById,
  mapLayerTileUrl,
} from "@/api/mapLayers";
import type { Bounds } from "@/api/windGrid";
import { ErrorView } from "@/components/ErrorView";
import { LayerChips } from "@/components/LayerChips";
import { LayerLegend } from "@/components/LayerLegend";
import { MapTimeline } from "@/components/MapTimeline";
import { WindBarbs } from "@/components/WindBarbs";
import { useLocation } from "@/hooks/useLocation";
import { useRadarFrames } from "@/hooks/useRadarFrames";
import { nowIndex, useTimelineHours } from "@/hooks/useTimelineHours";
import { useWindGrid } from "@/hooks/useWindGrid";
import { useWindStyle } from "@/hooks/useWindStyle";
import { t } from "@/i18n";
import { useCities } from "@/store/cities";
import { useMapTimeline } from "@/store/mapTimeline";
import { colors } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";

const FRAME_INTERVAL_MS = 600;
/** Sati se listaju sporije od radarskih okvira — inače je nečitljivo. */
const HOUR_INTERVAL_MS = 900;

/**
 * "2026-08-05T14:00" -> Date u LOKALNOJ zoni. `new Date(iso)` bi taj oblik
 * protumačio kao UTC i pomaknuo sat za pomak zone.
 */
function parseLocalIso(iso: string): Date {
  const [date, time] = iso.split("T");
  const [y = 1970, m = 1, d = 1] = (date ?? "").split("-").map(Number);
  const [hh = 0, mm = 0] = (time ?? "").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/**
 * Zadani kadar: regionalni pogled — mjesto plus okolni gradovi i obala
 * (zadarska regija u kadru), kako je i u referenci. Ne ulica, ne Europa.
 * Zoom 8 ≈ latitudeDelta 1.2 sa stare karte.
 */
const REGION_ZOOM = 8;
/** Bez odabranog mjesta se pokazuje cijela Hrvatska (stara delta 3.6). */
const COUNTRY_ZOOM = 6.4;

/** Središte Hrvatske — kadar i rezervna točka za vremensku crtu. */
const FALLBACK_LAT = 45.1;
const FALLBACK_LON = 16.4;

/**
 * Jedna vremenska pločica na karti: aktivni korak je vidljiv, susjedni su
 * montirani s prozirnošću 0 da se predučitaju — GL inačica starog trika s
 * UrlTile na 0.01. `key`/`id` je stabilan po (sloj, vrijeme), pa React pri
 * koraku crte NIKAD ne remonta vidljivi izvor: samo mu se digne prozirnost
 * (izmjereno u knjižnici: `tiles` na živom izvoru se NE primjenjuje —
 * native ga čita samo pri stvaranju; `paint` se primjenjuje odmah).
 */
type WeatherTile = { key: string; url: string; active: boolean };

export default function MapScreen() {
  const cameraRef = useRef<CameraRef>(null);
  const { fg } = useThemeColors();
  const selected = useCities((s) => s.selected);
  const gps = useLocation(selected === null);
  const radar = useRadarFrames();

  const layerId = useMapTimeline((s) => s.layer);
  const step = useMapTimeline((s) => s.step);
  const playing = useMapTimeline((s) => s.playing);
  const setLayer = useMapTimeline((s) => s.setLayer);
  const setStep = useMapTimeline((s) => s.setStep);
  const resetStep = useMapTimeline((s) => s.resetStep);
  const togglePlay = useMapTimeline((s) => s.togglePlay);
  const stop = useMapTimeline((s) => s.stop);

  const layer = mapLayerById(layerId);

  // Karta se centrira na odabrano mjesto, a za "Moja lokacija" na GPS.
  const focus = selected ?? (gps.status === "granted" ? gps.place : null);

  /*
   * Centar karte hrani vremensku crtu na slojevima koji nisu radar.
   *
   * Rezerva NIKAD ne smije biti `null`: bez odabranog grada i bez GPS
   * dozvole je `focus` prazan, upit se ne pokrene (`enabled: false`), crta
   * ostane bez koraka i klizač/play problijede — trajno, jer se stanje samo
   * od sebe ne popravi. Zato se pada na centar početnog kadra (Hrvatska).
   */
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const activeCenter = center ??
    (focus ? { lat: focus.lat, lon: focus.lon } : { lat: FALLBACK_LAT, lon: FALLBACK_LON });

  // Kadar karte hrani mrežu strujnica vjetra (traži se samo za taj sloj).
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const isWind = layer.render === "barbs";
  const windQuery = useWindGrid(bounds, isWind);
  const windStyle = useWindStyle(isWind);

  /*
   * Vjetar dobiva plavu podlogu (bijele strujnice na njoj imaju najveći
   * kontrast, kao u referenci). Dok se stil dohvaća — ili ako padne —
   * ostaje obični stil sloja, pa karta nikad nije prazna.
   */
  const mapStyle = isWind && windStyle.data ? windStyle.data : baseStyleFor(layer);

  const hoursQuery = useTimelineHours(
    activeCenter?.lat,
    activeCenter?.lon,
    layer.timeline === "hours",
  );

  const frames = radar.data?.frames ?? [];
  const host = radar.data?.host;
  const hours = hoursQuery.data ?? [];

  /** Zadani korak: zadnji izmjereni okvir (radar) ili tekući sat (ostalo). */
  const defaultStep = useMemo(() => {
    if (layer.timeline === "frames") {
      const idx = frames.map((f) => f.isNowcast).lastIndexOf(false);
      return idx >= 0 ? idx : Math.max(0, frames.length - 1);
    }
    const idx = nowIndex(hours);
    return idx >= 0 ? idx : 0;
  }, [layer.timeline, frames, hours]);

  const stepCount = layer.timeline === "frames" ? frames.length : hours.length;
  // Indeks iz drugog izvora (npr. sat 40 na radaru s 11 okvira) se odbacuje.
  const index = step !== null && step < stepCount ? step : defaultStep;

  useEffect(() => {
    if (!playing || stepCount < 2) return;
    const ms = layer.timeline === "frames" ? FRAME_INTERVAL_MS : HOUR_INTERVAL_MS;
    const timer = setInterval(() => {
      setStep((index + 1) % stepCount);
    }, ms);
    return () => clearInterval(timer);
    // `index` je namjerno u ovisnostima: interval se resetira po koraku.
  }, [playing, stepCount, index, layer.timeline, setStep]);

  // Promjena odabranog mjesta (drugi grad u ladici) pomiče kartu.
  useEffect(() => {
    if (!focus) return;
    cameraRef.current?.easeTo({
      center: [focus.lon, focus.lat],
      zoom: REGION_ZOOM,
      duration: 600,
    });
    /*
     * Centar se postavlja ODMAH, ne čeka se `onRegionDidChange`: animacija
     * traje 600 ms, a bez ovoga bi vremenska crta i mreža vjetra to vrijeme
     * pokazivale vrijednosti za PRETHODNI grad. Karta kasnije javi isti
     * centar pa se ništa ne dohvaća dvaput (koordinate se zaokružuju).
     */
    setCenter({ lat: focus.lat, lon: focus.lon });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id]);

  const locateMe = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));
      // Isti regionalni zoom kao zadani — "locate me" ne mijenja razinu.
      cameraRef.current?.easeTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: REGION_ZOOM,
        duration: 600,
      });
    } catch {
      // bez lokacije nema centriranja — ništa kritično
    }
  }, []);

  /*
   * Aktivni korak + susjedi. Radar kruži (animacija se vraća na početak),
   * sati se stežu na rubove. `Set` uklanja duplikate na rubovima/malom broju
   * okvira. Bez okvira/sata: radar nema što crtati (crta ostaje vidljiva),
   * OWM pokazuje trenutno stanje bez `&date=`.
   */
  const weatherTiles = useMemo<WeatherTile[]>(() => {
    // Vjetar se crta kao symbol sloj (WindBarbs), nema pločica.
    if (layer.render !== "raster" || !isLayerAvailable(layer)) return [];

    if (layer.timeline === "frames") {
      if (!host || frames.length === 0) return [];
      const n = frames.length;
      const around = [...new Set([(index - 1 + n) % n, index, (index + 1) % n])];
      return around.flatMap((j) => {
        const frame = frames[j];
        const url = frame ? mapLayerTileUrl(layer, { host, frame }) : null;
        return frame && url
          ? [{ key: `${layer.id}-${frame.time}`, url, active: j === index }]
          : [];
      });
    }

    if (hours.length === 0) {
      const url = mapLayerTileUrl(layer);
      return url ? [{ key: `${layer.id}-current`, url, active: true }] : [];
    }
    const last = hours.length - 1;
    const around = [...new Set([Math.max(0, index - 1), index, Math.min(index + 1, last)])];
    return around.flatMap((j) => {
      const hour = hours[j];
      if (!hour) return [];
      const at = Math.floor(parseLocalIso(hour.time).getTime() / 1000);
      const url = mapLayerTileUrl(layer, undefined, at);
      return url ? [{ key: `${layer.id}-${at}`, url, active: j === index }] : [];
    });
  }, [layer, host, frames, hours, index]);

  const radarBusy = layer.id === "radar" && radar.isPending;
  const radarFailed = layer.id === "radar" && radar.isError;

  /*
   * Slojevi koji nisu radar žive od Open-Metea, koji ima SATNU kvotu i pri
   * prekoračenju vraća 429. Bez ove poruke korisnik vidi samo blijedi
   * klizač i play gumb i nema pojma zašto — izgleda kao da je aplikacija
   * pukla. Radar je pošteđen (RainViewer je drugi izvor), pa se tada
   * ponudi i prelazak na njega.
   */
  const hoursFailed =
    layer.timeline === "hours" && hoursQuery.isError && hours.length === 0;
  const windFailed = isWind && windQuery.isError && (windQuery.data ?? []).length === 0;
  const timelineFailed = hoursFailed || windFailed;

  return (
    <View className="flex-1 bg-paper dark:bg-night">
      {/*
        Jedna živa karta za sve slojeve — bez `key` remounta po sloju
        (react-native-maps zaobilaznica). Promjena čipa mijenja `mapStyle`
        (svijetli/tamni) i vremenske izvore; kamera i crta prežive same.
      */}
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={mapStyle}
        attribution={false}
        logo={false}
        compass={false}
        touchRotate={false}
        touchPitch={false}
        onRegionDidChange={(e) => {
          const [lon, lat] = e.nativeEvent.center;
          setCenter({ lat, lon });
          const [west, south, east, north] = e.nativeEvent.bounds;
          setBounds({ west, south, east, north });
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: [focus?.lon ?? FALLBACK_LON, focus?.lat ?? FALLBACK_LAT],
            zoom: focus ? REGION_ZOOM : COUNTRY_ZOOM,
          }}
          minZoom={MAP_MIN_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
        />

        {/*
          Vremenske pločice idu ISPRED sloja granica+imena u stilu podloge
          (`beforeId`), pa imena gradova ostaju čitljiva IZNAD boja — kao u
          referenci; s react-native-maps je to bilo nemoguće. Iznad
          `maxNativeZ` MapLibre rasteže roditeljsku pločicu: sloj više nikad
          ne nestaje pri približavanju i nema "zoom level not supported".
        */}
        {weatherTiles.map((tile) => (
          <RasterSource
            key={tile.key}
            id={tile.key}
            tiles={[tile.url]}
            tileSize={256}
            maxzoom={layer.maxNativeZ}
          >
            <Layer
              type="raster"
              id={`${tile.key}-layer`}
              beforeId={MAP_LABELS_LAYER_ID}
              paint={{
                "raster-opacity": tile.active ? layer.opacity : 0,
                // Vraća snagu boje izvoru koji je poluproziran u samoj
                // pločici (vidi `saturation`/`contrast` u MAP_LAYERS).
                "raster-saturation": layer.saturation ?? 0,
                "raster-contrast": layer.contrast ?? 0,
                // Bez ovoga MapLibre pri promjeni koraka radi 300 ms
                // prijelaz i animacija radara izgleda kao mutno miješanje.
                "raster-fade-duration": 0,
              }}
            />
          </RasterSource>
        ))}

        {/*
          Vjetar: vlastiti sloj crtica iz Open-Meteo mreže, ne OWM pločica.
          Besplatni `wind_new` je polje boja bez smjera — crtice pokazuju
          kamo vjetar puše i mijenjaju se s vremenskom crtom.
        */}
        {isWind && (
          <WindBarbs grid={windQuery.data ?? []} timeIso={hours[index]?.time} />
        )}

        {focus && (
          <Marker lngLat={[focus.lon, focus.lat]} anchor="center">
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: colors.mint,
                borderWidth: 3,
                borderColor: "#FFFFFF",
                elevation: 3,
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
              }}
            />
          </Marker>
        )}
      </MapLibreMap>

      <View className="absolute left-0 right-0 top-3">
        <LayerChips
          active={layer.id}
          onChange={(next) => {
            const from = mapLayerById(layer.id).timeline;
            const to = mapLayerById(next).timeline;
            // Indeks okvira i indeks sata ne znače isto — pri prijelazu
            // između vrsta crte se vraća na zadani korak.
            if (from !== to) resetStep();
            stop();
            setLayer(next);
          }}
        />
      </View>

      <Pressable
        onPress={locateMe}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t.map.locateMe}
        className="absolute right-4 top-16 h-11 w-11 items-center justify-center rounded-full border border-ink/[0.08] bg-paper/95 dark:border-paper/10 dark:bg-night/95"
      >
        <LocateFixed size={20} strokeWidth={1.5} color={fg} opacity={0.8} />
      </Pressable>

      <View className="absolute bottom-4 left-4 right-4 gap-2">
        <LayerLegend layer={layer.id} />

        {/*
          Atribucija je UVJET besplatnog korištenja (OSM je pod ODbL, a
          CARTO/RainViewer/Open-Meteo je traže u uvjetima) — zato se ne
          uklanja. Svedena je na jedan tanak red bez pozadinskih "pillova"
          da ne odvlači pogled s karte; dodir i dalje otvara izvor.
        */}
        <View className="flex-row items-center gap-1.5 pl-1">
          <Pressable hitSlop={10} onPress={() => Linking.openURL(layer.attribution.url)}>
            <Text className="text-[9px] text-ink/35 dark:text-paper/35">
              {layer.attribution.label}
            </Text>
          </Pressable>
          <Text className="text-[9px] text-ink/25 dark:text-paper/25">·</Text>
          <Pressable hitSlop={10} onPress={() => Linking.openURL(MAP_BASE_ATTRIBUTION.url)}>
            <Text className="text-[9px] text-ink/35 dark:text-paper/35">
              {MAP_BASE_ATTRIBUTION.label}
            </Text>
          </Pressable>
        </View>

        {/*
          Kad izvor sati padne (najčešće satna kvota Open-Metea), crta se ne
          skriva — samo se objasni zašto ne radi i ponudi pokušaj ponovno.
        */}
        {timelineFailed && (
          <Pressable
            onPress={() => {
              void hoursQuery.refetch();
              if (isWind) void windQuery.refetch();
            }}
            className="flex-row items-center justify-between rounded-2xl border border-ink/[0.08] bg-paper/95 px-4 py-2 dark:border-paper/10 dark:bg-night/95"
          >
            <Text className="flex-1 text-[11px] text-ink/60 dark:text-paper/60">
              {t.map.timelineUnavailable}
            </Text>
            <Text className="text-[11px] text-mint">{t.common.retry}</Text>
          </Pressable>
        )}

        {/* Crta je na SVAKOM sloju, uvijek na istom mjestu — nikad skrivena. */}
        <MapTimeline
          layer={layer}
          frames={frames}
          hours={hours}
          index={index}
          playing={playing}
          onTogglePlay={togglePlay}
          onScrub={(i) => {
            stop();
            setStep(i);
          }}
        />
      </View>

      {radarBusy && (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="small" color={colors.mint} />
        </View>
      )}
      {radarFailed && (
        <View className="absolute inset-0 items-center justify-center">
          <View className="rounded-2xl bg-paper/95 px-6 dark:bg-night/95">
            <ErrorView onRetry={() => void radar.refetch()} />
          </View>
        </View>
      )}
    </View>
  );
}
