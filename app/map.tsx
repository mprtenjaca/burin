import {
  Camera,
  Layer,
  Map as MapLibreMap,
  Marker,
  RasterSource,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { router } from "expo-router";
import { ArrowLeft, LocateFixed } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import { MapPin } from "@/components/MapPin";
import { MapTimeline } from "@/components/MapTimeline";
import { WindBarbs } from "@/components/WindBarbs";
import { useLocation } from "@/hooks/useLocation";
import { useRadarFrames } from "@/hooks/useRadarFrames";
import { nowIndex, useTimelineHours } from "@/hooks/useTimelineHours";
import { useWindGrid } from "@/hooks/useWindGrid";
import { useWindStyle } from "@/hooks/useWindStyle";
import { t } from "@/i18n";
import { useCities } from "@/store/cities";
import { useLastWeather } from "@/store/lastWeather";
import { useMapTimeline } from "@/store/mapTimeline";
import { useSettings } from "@/store/settings";
import { Wordmark } from "@/components/Wordmark";
import { colors } from "@/theme/colors";
import { convertTemp } from "@/utils/format";
import { ACCENT_CORAL, ACCENT_STEEL, weatherGradient } from "@/utils/weatherLook";

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
  const insets = useSafeAreaInsets();
  const selected = useCities((s) => s.selected);
  const tempUnit = useSettings((s) => s.tempUnit);
  const windUnit = useSettings((s) => s.windUnit);
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

  // Temperatura na pinu: zadnji dohvat za to mjesto (burin:last-weather) —
  // karta ne radi vlastiti upit prognoze. Bez pohrane pin je točka.
  const lastBundle = useLastWeather((s) =>
    focus ? s.byPlaceId[focus.id] : undefined,
  );
  /*
   * Pretvorba u odabranu jedinicu je OBAVEZNA (popravak 6.8.2026.): prije
   * je pin crtao sirove °C i uz odabrani °F pokazivao npr. 24 tamo gdje
   * cijela aplikacija piše 75. Ista greška je bila i na crti karte.
   */
  const pinTemp = lastBundle
    ? Math.round(convertTemp(lastBundle.current.temp, tempUnit))
    : undefined;
  /*
   * Značka nosi gradijent trenutnog vremena tog mjesta (dorada 6.8.2026.)
   * — s karte se odmah vidi KAKVO je vrijeme, ne samo koliko stupnjeva.
   * Uvijek svijetla paleta: značka stoji na karti, ne na temi aplikacije.
   */
  const pinStops = lastBundle
    ? weatherGradient(lastBundle.current.code, lastBundle.current.isDay, false)
    : undefined;

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

  /**
   * "Sada" na skali — odatle kreće play (dorada 6.8.2026.). Isto što i
   * `defaultStep`, ali izračunato posebno jer `defaultStep` služi i kao
   * rezerva kad koraka nema.
   */
  const nowStep = useMemo(() => {
    if (layer.timeline === "frames") return frames.map((f) => f.isNowcast).lastIndexOf(false);
    return nowIndex(hours);
  }, [layer.timeline, frames, hours]);

  const stepCount = layer.timeline === "frames" ? frames.length : hours.length;
  // Indeks iz drugog izvora (npr. sat 40 na radaru s 11 okvira) se odbacuje.
  const index = step !== null && step < stepCount ? step : defaultStep;

  /*
   * Smjer animacije ovisi o tome IMA li sloj budućnost (dorada 6.8.2026.):
   *
   * - Slojevi sa satima (temperatura/naoblaka/vjetar) je imaju — play
   *   kreće od "sada" prema naprijed i na kraju se vrati na "sada".
   *   Prije je kružio kroz cijeli niz pa je s kraja skakao 24 h unatrag.
   * - RADAR je nema: izmjereno 6.8.2026. da RainViewer vraća 13 prošlih
   *   okvira i NULA nowcasta. Ondje play vrti PROŠLOST — od najstarijeg
   *   okvira do sada pa ispočetka, kao klasična radarska animacija.
   *
   * Klizanje rukom uvijek ide po CIJELOJ crti, u oba smjera.
   */
  const hasFuture = nowStep >= 0 && nowStep < stepCount - 1;

  useEffect(() => {
    if (!playing || stepCount < 2) return;
    const ms = layer.timeline === "frames" ? FRAME_INTERVAL_MS : HOUR_INTERVAL_MS;
    const timer = setInterval(() => {
      const next = index + 1;
      if (hasFuture) {
        // Naprijed od "sada" do kraja, pa natrag na "sada".
        setStep(next >= stepCount || next < nowStep ? nowStep : next);
        return;
      }
      // Bez budućnosti: petlja kroz cijelu (prošlu) crtu.
      setStep(next >= stepCount ? 0 : next);
    }, ms);
    return () => clearInterval(timer);
    // `index` je namjerno u ovisnostima: interval se resetira po koraku.
  }, [playing, stepCount, index, nowStep, hasFuture, layer.timeline, setStep]);

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
          /*
           * Granica po SLOJU, ne jedna za sve (8.8.2026.): radar staje na
           * 9 jer mu podaci staju na 7, pa bi dalje bile samo rastegnute
           * kocke. Vjetar i temperatura idu do kraja — vidi `maxUserZoom`.
           */
          maxZoom={layer.maxUserZoom}
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
            // Iz sloja, ne fiksno (8.8.2026.): radar je 512, OWM 256.
            tileSize={layer.tileSize}
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
          <WindBarbs
            grid={windQuery.data ?? []}
            timeIso={hours[index]?.time}
            // Duljina strujnica prati kadar — fiksna je na jakom
            // približavanju prelazila 80 % širine ekrana.
            bounds={bounds}
          />
        )}

        {/*
          JEDAN pin: mjesto s heroja (odabrani grad ili "Moja lokacija") —
          bijela značka s temperaturom + repić (dizajn 6.8.2026.). Bez
          zasebne oznake trenutne GPS pozicije.
        */}
        {focus && (
          <Marker lngLat={[focus.lon, focus.lat]} anchor="bottom">
            <MapPin temp={pinTemp} stops={pinStops} />
          </Marker>
        )}
      </MapLibreMap>

      {/*
        Karta je fullscreen (bez headera), pa natrag crta sam ekran —
        gore lijevo, iznad karte, na istoj tamnoj plohi kao ostale
        kontrole (dorada 6.8.2026.).
      */}
      <Pressable
        onPress={() => router.navigate("/")}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t.common.weather}
        className="absolute left-4 h-11 w-11 items-center justify-center rounded-full bg-ink/85"
        style={{ top: insets.top + 8 }}
      >
        <ArrowLeft size={22} strokeWidth={2.5} color="#FFFFFF" />
      </Pressable>

      {/* Wordmark u sredini vrha — potpis na fullscreen karti. */}
      <View
        className="absolute left-0 right-0 items-center"
        style={{ top: insets.top + 8 }}
        pointerEvents="none"
      >
        <View className="flex-row items-center rounded-full bg-ink/85 px-4 py-2.5">
          {/*
            Zapuh je PLAV na karti (Markov odabir 8.8.2026.) — karta je
            jedini ekran gdje wordmark stoji nad tuđom grafikom, pa se
            koraljna ondje čitala kao još jedna oznaka na karti.

            Nijansa je SVJETLIJA plava (`ACCENT_STEEL`), ne `ACCENT_UI`:
            traka je tamna (#171717–#323231 nakon 85 % ink-a), a ondje
            `ACCENT_UI` pada na **2.55:1** — lošije nego koraljna koju
            mijenja. `ACCENT_STEEL` drži **3.85–5.38:1** i jednako je
            jasno plav.
          */}
          <Wordmark color={colors.paper} accent={ACCENT_STEEL} textSize={15} />
        </View>
      </View>

      <Pressable
        onPress={locateMe}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t.map.locateMe}
        className="absolute right-4 h-11 w-11 items-center justify-center rounded-full bg-ink/85"
        style={{ top: insets.top + 8 }}
      >
        <LocateFixed size={20} strokeWidth={2.5} color="#FFFFFF" />
      </Pressable>

      {/* Slojevi: okomiti stupac ikona uz desni rub, vertikalno centriran. */}
      <View className="absolute right-4" style={{ top: insets.top + 64 }}>
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

      <View
        className="absolute left-4 right-4 gap-2"
        style={{ bottom: insets.bottom + 12 }}
      >
        <LayerLegend layer={layer.id} />

        {/*
          Atribucija je UVJET besplatnog korištenja (OSM je pod ODbL, a
          CARTO/RainViewer/Open-Meteo je traže u uvjetima) — zato se ne
          uklanja. Svedena je na jedan tanak red bez pozadinskih "pillova"
          da ne odvlači pogled s karte; dodir i dalje otvara izvor.
        */}
        {/*
          Prigušeno na najmanju mjeru koja je još čitljiva (Markov odabir
          8.8.2026.): podloga s 70 % na 40 %, tekst sa 60 % na 42 %.
          Obveza ostaje ispunjena — natpis se vidi i dodir i dalje otvara
          izvor — ali više ne otima pogled karti. Dodirna meta se NE
          smanjuje (`hitSlop` ostaje 10), pa je i dalje lako pogoditi.
        */}
        <View className="flex-row items-center gap-1.5 self-start rounded-full bg-ink/40 px-2.5 py-1">
          <Pressable hitSlop={10} onPress={() => Linking.openURL(layer.attribution.url)}>
            <Text className="text-[9px] text-paper/[0.42]">{layer.attribution.label}</Text>
          </Pressable>
          <Text className="text-[9px] text-paper/25">·</Text>
          <Pressable hitSlop={10} onPress={() => Linking.openURL(MAP_BASE_ATTRIBUTION.url)}>
            <Text className="text-[9px] text-paper/[0.42]">
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
            className="flex-row items-center justify-between rounded-2xl bg-ink/90 px-4 py-2.5"
          >
            <Text className="flex-1 font-grotesk text-[11.5px] text-paper/70">
              {t.map.timelineUnavailable}
            </Text>
            <Text
              className="font-grotesk-bold text-[11.5px]"
              style={{ color: ACCENT_CORAL }}
            >
              {t.common.retry}
            </Text>
          </Pressable>
        )}

        {/* Crta je na SVAKOM sloju, uvijek na istom mjestu — nikad skrivena. */}
        <MapTimeline
          layer={layer}
          frames={frames}
          hours={hours}
          index={index}
          playing={playing}
          units={{ tempUnit, windUnit }}
          onTogglePlay={togglePlay}
          onScrub={(i) => {
            stop();
            setStep(i);
          }}
        />
      </View>

      {radarBusy && (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="small" color={ACCENT_CORAL} />
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
