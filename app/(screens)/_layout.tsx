import { router } from "expo-router";
import { Stack } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Platform, Pressable, View } from "react-native";

import { t } from "@/i18n";
import { colors } from "@/theme/colors";

/**
 * POČETNA + podekrani u jednom Stacku unutar ladice (dorada 6.8.2026.).
 *
 * Početna je KORIJEN stacka, a ladica prije otvaranja podekrana čisti
 * stack (`dismissAll`) — svaki podekran je tako uvijek točno jedan sloj
 * iznad početne. Prije je stack gomilao povijest podekrana, pa je swipe
 * natrag iz Postavki znao odvesti u Upozorenja (nađeno na uređaju):
 * povijest je bila [Upozorenja, Postavke] umjesto [Početna, Postavke].
 *
 * Karta ostaje IZVAN stacka (sestra u ladici): fullscreen s vlastitim
 * kontrolama.
 */
/**
 * Strelica natrag: CENTRIRANA u kvadratu 40×40, bez paddinga. iOS 26
 * oko header gumba sam crta stakleni krug — s ranijim `paddingRight: 16`
 * strelica je u tom krugu stajala ulijevo, pa je izgledalo kao dupli
 * gumb (nađeno na uređaju 6.8.2026.). Vrijedi za sve podekrane.
 */
function HeaderBack({ tint }: { tint: string }) {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
      hitSlop={10}
      accessibilityRole="button"
      style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
    >
      {/* SVG zna progutati dodir na Androidu — vidi tražilicu (8.8.2026.). */}
      <View pointerEvents="none">
        <ArrowLeft size={24} strokeWidth={2} color={tint} />
      </View>
    </Pressable>
  );
}

export default function ScreensLayout() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const tint = dark ? colors.paper : colors.ink;

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: dark ? colors.night : colors.mist },
        headerTintColor: tint,
        headerTitleStyle: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 17 },
        headerTitleAlign: "left",
        /*
         * Samo NAŠA strelica: uz custom headerLeft iOS zna nacrtati i
         * vlastiti back gumb, pa je oko strelice izgledalo kao dupli
         * krug (nađeno na uređaju 6.8.2026.).
         */
        headerBackVisible: false,
        headerLeft: () => <HeaderBack tint={tint} />,
        // Swipe s lijevog ruba — na iOS-u zadano, na Androidu treba reći.
        gestureEnabled: true,
        contentStyle: { backgroundColor: dark ? colors.night : colors.mist },
      }}
    >
      {/* Početna crta vlastito zaglavlje preko gradijenta. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: t.common.weather }} />
      <Stack.Screen name="search" options={{ title: t.search.title }} />
      <Stack.Screen name="warnings" options={{ title: t.common.warnings }} />
      <Stack.Screen name="pollen" options={{ title: t.pollen.title }} />
      <Stack.Screen name="cameras" options={{ title: t.home.camerasSection }} />
      {/*
        Detalji dana kao SHEET odozdo (7.9.2026.), ne kartica u stacku:
        lista od 14 dana ostaje vidljiva ispod, a naslov sheeta kaže koji
        dan gledaš — vidi `day.tsx`. Bez headera: sheet crta vlastiti
        naslov i „X". Detenti 3/4 i puni; na Androidu Material bottom
        sheet (RNS 4.26), grabber je iOS.

        RADIJUS: iOS SUSTAVSKI (-1), Android 28 (10.9.2026.).

        Markov nalaz u tri kruga: s 24 su donji kutevi "ulazili u ekran";
        s 34 je bilo "puno oblje, ima prostora, al nije ujednaceno ko
        ostali rubovi - dolje lijevo i dolje desno". Uzrok, procitan u
        RNSScreen.mm: RNS ne dira nijedan kut posebno (nema
        maskedCorners), samo UIModalPresentationFormSheet +
        preferredCornerRadius. Dakle sva cetiri kuta su bila 34 - ali
        DONJI kutevi jedini sjede uz FIZICKE kutove ekrana, pa se samo
        tamo vidi da luk kartice nije KONCENTRICAN s lukom ekrana
        (iPhone 13 = 47.3 pt). Gornji plutaju usred ekrana i nemaju s
        cim se usporediti - zato smetaju samo donja dva.

        Koncentricni radijus = radijus ekrana - odmak sheeta, i OVISI O
        UREDJAJU (iPhone 13 = 47, 16 Pro = 62). Tvrda brojka bi bila
        tocna samo na jednom mobitelu. Na iOS 26 (plutajuci sheet na
        manjem detentu - "novi flow") sustavski automatic radijus JEST
        koncentrican s ekranom, to je poanta tog dizajna. RNS -1 ->
        UISheetPresentationControllerAutomaticDimension
        (setCornerRadiusForSheet: "radius < 0 ? Automatic : radius").

        ANDROID NE SMIJE dobiti -1: Screen.kt (onSheetCornerRadiusChange)
        radi max(toDIP(radius), 0) -> 0 -> RAVNI gornji kutevi. Tamo je
        Material bottom sheet prilijepljen za rub, zaobljuje SAMO
        setTopLeftCorner/setTopRightCorner, i M3 standard je 28. Prop
        za margine sheeta ne postoji ni na jednoj platformi.
      */}
      <Stack.Screen
        name="day"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: [0.75, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetCornerRadius: Platform.select({ ios: -1, default: 28 }),
          gestureEnabled: true,
        }}
      />
      <Stack.Screen name="preview" options={{ title: t.preview.title }} />
      <Stack.Screen name="settings" options={{ title: t.settings.title }} />
      <Stack.Screen name="sources" options={{ title: t.sources.title }} />
    </Stack>
  );
}
