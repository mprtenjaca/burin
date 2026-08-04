import { router } from "expo-router";
import { useEffect } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { AqiRow } from "@/components/AqiRow";
import { DailyList } from "@/components/DailyList";
import { DhmzCard } from "@/components/DhmzCard";
import { ErrorView } from "@/components/ErrorView";
import { Hero } from "@/components/Hero";
import { HourlyStrip } from "@/components/HourlyStrip";
import { MetricsRow } from "@/components/MetricsRow";
import { RadarPreviewCard } from "@/components/RadarPreviewCard";
import { Hairline, Section } from "@/components/Section";
import { HomeSkeleton } from "@/components/Skeleton";
import { SunCycle } from "@/components/SunCycle";
import { useLocation } from "@/hooks/useLocation";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import { t } from "@/i18n";
import { useCities } from "@/store/cities";
import { useSettings } from "@/store/settings";
import { colors } from "@/theme/colors";
import { clockTime } from "@/utils/format";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-1">
      <Text className="text-[15px] text-ink dark:text-paper">{value}</Text>
      <Text className="text-xs text-ink/50 dark:text-paper/50">{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const selected = useCities((s) => s.selected);
  const gps = useLocation(selected === null);
  const place =
    selected ?? (gps.status === "granted" ? gps.place : null);

  const { bundle, isLoading, isError, isStale, isRefreshing, refetch } =
    useWeatherBundle(place);
  const tempUnit = useSettings((s) => s.tempUnit);
  const windUnit = useSettings((s) => s.windUnit);

  // Bez odabranog grada i bez dozvole za lokaciju -> odabir grada.
  useEffect(() => {
    if (selected === null && gps.status === "denied") {
      router.replace("/search");
    }
  }, [selected, gps.status]);

  if (selected === null && gps.status === "loading") {
    return (
      <View className="flex-1 bg-paper dark:bg-night">
        <HomeSkeleton />
        <Text className="px-8 pb-10 text-center text-xs text-ink/40 dark:text-paper/40">
          {t.location.rationale}
        </Text>
      </View>
    );
  }
  if (selected === null && gps.status === "denied") {
    return <View className="flex-1 bg-paper dark:bg-night" />;
  }
  if (isLoading) return <HomeSkeleton />;
  if (isError || !bundle) {
    return (
      <View className="flex-1 justify-center bg-paper dark:bg-night">
        <ErrorView onRetry={refetch} />
      </View>
    );
  }

  const today = bundle.daily[0];
  const uvNow = bundle.hourly[0]?.uv;
  const visibilityKm = bundle.hourly[0]
    ? Math.round(bundle.hourly[0].visibility / 1000)
    : undefined;
  const precipNext24 =
    Math.round(bundle.hourly.reduce((sum, h) => sum + h.precip, 0) * 10) / 10;

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-night"
      contentContainerClassName="gap-7 px-5 pb-12"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refetch}
          tintColor={colors.mint}
          colors={[colors.mint]}
        />
      }
    >
      <Hero
        placeName={bundle.place.name}
        current={bundle.current}
        nightMin={today?.tMin}
        tempUnit={tempUnit}
      />
      {isStale && (
        <Text className="text-center text-xs text-ink/40 dark:text-paper/40">
          {t.common.dataFrom} {clockTime(bundle.fetchedAt)}
        </Text>
      )}
      <MetricsRow current={bundle.current} uv={uvNow} windUnit={windUnit} />
      <Section title={t.home.hourly}>
        <HourlyStrip hours={bundle.hourly} tempUnit={tempUnit} />
      </Section>
      {today && <SunCycle sunrise={today.sunrise} sunset={today.sunset} />}
      <Section title={t.home.daily}>
        <DailyList days={bundle.daily.slice(0, 14)} tempUnit={tempUnit} />
      </Section>
      <RadarPreviewCard lat={bundle.place.lat} lon={bundle.place.lon} />
      {bundle.dhmz && (
        <Section title={t.home.nearbyMeasurements}>
          <DhmzCard obs={bundle.dhmz} windUnit={windUnit} />
        </Section>
      )}
      <Section title={t.home.details}>
        <View className="flex-row py-1">
          <Detail
            label={t.metrics.visibility}
            value={visibilityKm !== undefined ? `${visibilityKm} km` : "–"}
          />
          <Detail
            label={t.metrics.cloudCover}
            value={`${Math.round(bundle.current.cloudCover)} %`}
          />
          <Detail label={t.metrics.precipitation} value={`${precipNext24} mm`} />
        </View>
        {bundle.aqi !== undefined && (
          <>
            <Hairline />
            <AqiRow aqi={bundle.aqi} />
          </>
        )}
      </Section>
    </ScrollView>
  );
}
