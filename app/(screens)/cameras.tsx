import { useLocalSearchParams } from "expo-router";
import { Camera } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Image, Linking, Pressable, ScrollView, Text, View } from "react-native";

import { Card } from "@/components/Section";
import { useBottomInset } from "@/hooks/useBottomInset";
import { useWebcams } from "@/hooks/useWebcams";
import { t } from "@/i18n";

/**
 * Sve kamere u blizini — otvara se s kartice na početnoj.
 *
 * IZNIMKA od pravila „ekran prima gotove podatke kroz parametre" (pelud,
 * `widgetData`): ovaj ekran MORA imati vlastiti upit. URL-ovi slika nose
 * token koji istječe za 10 minuta, pa proslijeđene adrese ne bi preživjele
 * ni jedno duže gledanje — a upit je jeftin (jedan poziv, desetak brojki i
 * adresa). Kroz parametre ide samo pozicija.
 *
 * Kamere su tuđe slike, pa je ekran namjerno tih: jedna po jedna, puna
 * širina, ime i udaljenost. Dodir na sliku otvara Windyjevu stranicu te
 * kamere — obveza iz njihovih uvjeta („link every image with our webcam
 * page"), i istodobno jedini put do njihovog timelapsea i live playera.
 */
export default function CamerasScreen() {
  const params = useLocalSearchParams<{ lat?: string; lon?: string }>();
  const lat = params.lat === undefined ? undefined : Number(params.lat);
  const lon = params.lon === undefined ? undefined : Number(params.lon);

  const { data, isPending, isError } = useWebcams(
    Number.isFinite(lat) ? lat : undefined,
    Number.isFinite(lon) ? lon : undefined,
  );
  const bottomInset = useBottomInset();

  /*
   * Lista se montira KADAR POSLIJE ekrana — isti obrazac kao pelud i
   * tražilica. Desetak `Image` komponenti unutar prijelaza zamrzne
   * animaciju otvaranja; prazan okvir jedan kadar se ne vidi.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const webcams = data ?? [];

  return (
    <ScrollView
      className="flex-1 bg-mist dark:bg-night"
      contentContainerStyle={{ padding: 20, paddingBottom: 20 + bottomInset, gap: 14 }}
    >
      {!ready || isPending ? null : webcams.length === 0 ? (
        <Card className="items-center justify-center py-10">
          <Camera size={22} color="#9AA5B1" pointerEvents="none" />
          <Text className="mt-2 font-grotesk text-[13px] text-ink/50 dark:text-paper/50">
            {isError ? t.home.camerasOffline : t.home.camerasEmpty}
          </Text>
        </Card>
      ) : (
        <>
          {webcams.map((w) => (
            <View key={w.id} className="gap-1.5">
              <Card className="overflow-hidden">
                <Pressable
                  onPress={() => {
                    if (w.pageUrl) void Linking.openURL(w.pageUrl);
                  }}
                  accessibilityRole="link"
                  accessibilityLabel={w.title}
                >
                  <Image
                    source={{ uri: w.full ?? w.preview }}
                    className="aspect-video w-full bg-ink/5 dark:bg-paper/5"
                    resizeMode="cover"
                    accessible={false}
                  />
                  <View className="flex-row items-center justify-between px-4 py-3">
                    <Text
                      className="flex-1 font-grotesk-bold text-[14px] text-ink dark:text-paper"
                      numberOfLines={1}
                    >
                      {w.title}
                    </Text>
                    <Text className="ml-3 font-grotesk text-[12.5px] text-ink/45 dark:text-paper/45">
                      {w.distanceKm < 10
                        ? `${w.distanceKm.toFixed(1)} km`
                        : `${Math.round(w.distanceKm)} km`}
                    </Text>
                  </View>
                </Pressable>
              </Card>
            </View>
          ))}

          {/* Atribucija JEDNOM na dnu liste, ne pod svakom slikom. */}
          <Pressable
            onPress={() => void Linking.openURL("https://www.windy.com/webcams")}
            hitSlop={10}
            accessibilityRole="link"
            className="px-1 pt-1"
          >
            <Text className="font-grotesk text-[11px] text-ink/40 dark:text-paper/40">
              {t.home.camerasAttribution}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
