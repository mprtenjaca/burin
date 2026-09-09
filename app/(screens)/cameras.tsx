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
  const params = useLocalSearchParams<{ lat?: string; lon?: string; place?: string }>();
  const lat = params.lat === undefined ? undefined : Number(params.lat);
  const lon = params.lon === undefined ? undefined : Number(params.lon);

  /*
   * Ime mjesta MORA doći isto kao na kartici: po njemu se bira čije se
   * kamere prikazuju (`pickWebcams`), pa bi bez njega ekran pokazao drugi
   * popis od one kartice s koje se otvorio.
   */
  const { data, isPending, isError } = useWebcams(
    Number.isFinite(lat) ? lat : undefined,
    Number.isFinite(lon) ? lon : undefined,
    params.place,
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
            /*
              Slika NIJE dodirljiva (Markov odabir 9.9.2026.: „kad kliknem
              na njih ne želim da mi ode na Windy stranicu"). Izlazak iz
              aplikacije u preglednik prekida ono što je korisnik radio, a
              na Windyju ionako vidi istu sliku.
              Obveza navođenja izvora ostaje ispunjena kroz atribuciju na
              dnu popisa, koja i dalje vodi na Windy — ali svojevoljno,
              jednim jasnim dodirom, ne slučajno preko slike.
            */
            <Card key={w.id} className="overflow-hidden">
              <Image
                source={{ uri: w.full ?? w.preview }}
                className="aspect-video w-full bg-ink/5 dark:bg-paper/5"
                resizeMode="cover"
                accessibilityLabel={w.title}
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
            </Card>
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
