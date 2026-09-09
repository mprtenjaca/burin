import { router } from "expo-router";
import { Camera } from "lucide-react-native";
import { Image, Linking, Pressable, Text, View } from "react-native";

import type { Webcam } from "@/api/windyWebcams";
import { t } from "@/i18n";

import { Card } from "./Section";

/**
 * Starost slike kao kratak tekst („prije 3 min").
 *
 * Zaokruženo NA MINUTU i bez sekundi: Windy osvježava kamere svakih par
 * minuta, pa bi sekunde davale lažnu preciznost i mijenjale se na svakom
 * crtanju. Ispod minute je „sada" — točnije od „prije 0 min".
 */
function ageLabel(takenAtMs?: number, nowMs = Date.now()): string | undefined {
  if (takenAtMs === undefined) return undefined;
  const min = Math.floor((nowMs - takenAtMs) / 60000);
  if (min < 1) return t.home.camerasJustNow;
  if (min < 60) return t.home.camerasAge(`${min} min`);
  const h = Math.floor(min / 60);
  return t.home.camerasAge(`${h} h`);
}

/** Udaljenost: pod 10 km s decimalom, dalje cijeli broj („4.2 km", „18 km"). */
function distanceLabel(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/**
 * Kartica s NAJBLIŽOM kamerom — ispod karte na početnoj (Markov odabir
 * 9.9.2026.: „negdi da fino izgleda da se uklapa u dizajn, možda ispod
 * mapa").
 *
 * Slika, pa ispod nje mjesto + udaljenost lijevo i starost desno. Ista
 * visina i radijus kao pregled karte iznad, da se dvije kartice čitaju kao
 * par, a ne kao dvije različite ideje.
 *
 * Dodir na sliku otvara ekran sa svim kamerama u blizini; atribucija je
 * ZASEBAN dodir na Windy (obveza iz uvjeta — vidi `windyWebcams.ts`) i
 * stoji ispod kartice kao goli tekst, isti obrazac kao atribucija karte.
 */
export function WebcamCard({
  webcams,
  isOffline,
  lat,
  lon,
}: {
  webcams: Webcam[];
  /** Bez mreže se slika ne može obnoviti — token istječe za 10 min. */
  isOffline?: boolean;
  /** Pozicija ide ekranu kroz parametre; slike NE (token istječe). */
  lat: number;
  lon: number;
}) {
  const first = webcams[0];

  /*
   * Prazno stanje je TEKST u kartici, ne izostanak kartice: sekcija ima
   * naslov, pa bi prazan prostor pod naslovom izgledao kao greška. Dvije
   * različite poruke — „nema kamera ovdje" i „nema mreže" — jer korisnik u
   * prvom slučaju ne treba ništa raditi, a u drugom treba.
   */
  if (!first?.preview) {
    return (
      <Card className="items-center justify-center py-8">
        <Camera size={20} color="#9AA5B1" pointerEvents="none" />
        <Text className="mt-2 font-grotesk text-[13px] text-ink/50 dark:text-paper/50">
          {isOffline ? t.home.camerasOffline : t.home.camerasEmpty}
        </Text>
      </Card>
    );
  }

  const age = ageLabel(first.takenAtMs);
  const hasMore = webcams.length > 1;

  return (
    <View className="gap-1.5">
      <Card className="overflow-hidden">
        {/*
          Dodir otvara popis SAMO kad ima više od jedne kamere (Markov
          odabir 9.9.2026.: „pokaži mi samo najbližu bez posebnog screena
          ako može… ostavi jedino kad ima više slika grada").
          S jednom kamerom je ekran isti prizor drugi put — pa kartica tada
          nije ni dodirljiva, umjesto da vodi u prazan hod.
        */}
        <Pressable
          onPress={
            hasMore
              ? () =>
                  router.navigate({
                    pathname: "/cameras",
                    params: { lat: String(lat), lon: String(lon) },
                  })
              : undefined
          }
          disabled={!hasMore}
          accessibilityRole={hasMore ? "button" : "image"}
          accessibilityLabel={
            hasMore ? `${first.title}, ${t.home.camerasAll}` : first.title
          }
        >
          {/*
            16:9 kroz `aspect-video`, ne fiksna visina: kamere vraćaju
            različite formate, a fiksna visina bi ih razvlačila — što
            Windyjevi uvjeti izričito zabranjuju („only in their original
            size or in a smaller size"). `cover` reže, ne rasteže.
          */}
          <Image
            source={{ uri: first.preview }}
            className="aspect-video w-full bg-ink/5 dark:bg-paper/5"
            resizeMode="cover"
            accessible={false}
          />
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text
              className="flex-1 font-grotesk-bold text-[14px] text-ink dark:text-paper"
              numberOfLines={1}
            >
              {first.title}
              <Text className="font-grotesk text-ink/50 dark:text-paper/50">
                {`  ${distanceLabel(first.distanceKm)}`}
              </Text>
            </Text>
            {/*
              Brojač ostalih kamera stoji uz starost: bez njega ništa ne
              kaže da kartica vodi nekamo, pa se popis ne bi ni otkrio.
            */}
            {hasMore && (
              <Text className="ml-3 font-grotesk text-[12.5px] text-ink/45 dark:text-paper/45">
                {t.home.camerasMore(webcams.length - 1)}
              </Text>
            )}
            {age !== undefined && (
              <Text className="ml-3 font-grotesk text-[12.5px] text-ink/45 dark:text-paper/45">
                {age}
              </Text>
            )}
          </View>
        </Pressable>
      </Card>

      {/*
        Atribucija: goli tekst pod karticom, bez pilule — isti obrazac kao
        na karti (pilula je tamo ocijenjena kao mrlja). `hitSlop` 10 jer je
        tekst sitan, a obveza je da dodir stvarno otvori izvor.
      */}
      <Pressable
        onPress={() => void Linking.openURL("https://www.windy.com/webcams")}
        hitSlop={10}
        accessibilityRole="link"
        className="px-1"
      >
        <Text className="font-grotesk text-[11px] text-ink/40 dark:text-paper/40">
          {t.home.camerasAttribution}
        </Text>
      </Pressable>
    </View>
  );
}
