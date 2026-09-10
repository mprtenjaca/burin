import { router, useLocalSearchParams } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { DailyPoint } from "@/api/types";
import { DayDetails } from "@/components/DayDetails";
import { useBottomInset } from "@/hooks/useBottomInset";
import { t } from "@/i18n";
import { useDayDetails } from "@/store/dayDetails";
import { useSettings } from "@/store/settings";
import { useThemeColors } from "@/theme/useThemeColors";
import { convertTemp } from "@/utils/format";
import { codeToCondition } from "@/utils/weatherCodes";
import { ACCENT_UI } from "@/utils/weatherLook";

/**
 * DETALJI DANA KAO SHEET ODOZDO (redizajn 7.9.2026.).
 *
 * Zašto ne više harmonika u 14-dnevnoj listi: Marko je dobio pritužbe
 * „otvori mi se podsekcija i skroz se izgubim". Uzrok su bila tri
 * svojstva harmonike zajedno — otvoreni red se nije razlikovao od
 * susjeda (samo ševron od 14 px), panel od ~300 px se otvarao ISPOD
 * pregiba pa korisnik nije vidio što je otvorio, a jedini dopušteni
 * otvoreni dan značio je da dodir na dan 9 ZATVORI dan 4 iznad i cijela
 * lista odskoči prema gore bez animacije. Model je bio problem, ne
 * poliranje.
 *
 * Sheet to rješava strukturno: lista se NIKAD ne miče, a naslov sheeta
 * kaže koji dan gledaš. Traka čipova omogućuje prebacivanje dana bez
 * zatvaranja, pa „a kakav je četvrtak" ne traži povratak na listu.
 *
 * PODACI IZ MEMORIJSKOG STOREA (`useDayDetails`), ne kroz parametre:
 * treba `hourlyAll` (~69 kB), što kroz URL parametre znači serijalizaciju
 * u kadru prijelaza. Početna prije `push` samo pokaže na podatke koje već
 * drži. Kroz parametar ide jedino `date` (koji dan otvoriti). Isto pravilo
 * kao pelud: ekran je čisti prikaz — nema upita, nema GPS-a.
 *
 * `formSheet`: na iOS-u UIKit sheet s grabberom, na Androidu Material
 * BottomSheetBehaviour (react-native-screens 4.26, tipovi pročitani u
 * node_modules — Expova kopija native-stacka nosi ZASTARJELI komentar
 * „fallback na modal na Androidu"). Detenti `[0.75, 1]`: sheet se otvara
 * na tri četvrtine da se ispod vidi da je lista još tu, a povlačenjem
 * ide do vrha.
 */

/** Širina čipa dana + razmak — dijele ih crtanje i auto-skrol. */
const CHIP_W = 58;
const CHIP_GAP = 8;

/** Pomak dana od danas po SATU UREĐAJA (0 = danas, 1 = sutra…). */
function dayOffset(date: string, now: Date = new Date()): number {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  const today = at(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return Math.round((at(y, m, d) - today) / 86_400_000);
}

/** "srijeda" → "Srijeda" — naslov sheeta počinje velikim slovom. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function weekdayOf(date: string, short = false): string {
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return short ? t.dayNamesShort[dow]! : t.dayNames[dow]!;
}

/** "10.9." bez vodećih nula, kao u ostatku aplikacije. */
function shortDate(date: string): string {
  const [, m = "1", d = "1"] = date.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

export default function DayScreen() {
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const days = useDayDetails((s) => s.days);
  const hourly = useDayDetails((s) => s.hourly);
  const place = useDayDetails((s) => s.place);
  const tempUnit = useSettings((s) => s.tempUnit);
  const windUnit = useSettings((s) => s.windUnit);
  const { fg } = useThemeColors();
  const bottomInset = useBottomInset();

  /*
   * Odabrani dan je LOKALNO stanje, ne parametar: prebacivanje čipom ne
   * smije gurati novi ekran na stack ni mijenjati URL — sheet ostaje isti,
   * mijenja se samo sadržaj.
   */
  const [date, setDate] = useState<string>(dateParam ?? days[0]?.date ?? "");
  const day: DailyPoint | undefined = useMemo(
    () => days.find((d) => d.date === date),
    [days, date],
  );
  const selectedIdx = days.findIndex((d) => d.date === date);

  /*
   * Detalji dolaze KADAR NAKON EKRANA — isti obrazac kao pelud i tražilica:
   * četiri stupca razdoblja + tablica unutar prijelaza sheeta bi štucali.
   * Naslov i čipovi su jeftini pa idu odmah; u istom kadru se traka čipova
   * doskrola do odabranog dana (dan 12 od 14 je inače izvan kadra).
   */
  const [detailsReady, setDetailsReady] = useState(false);
  const chipsRef = useRef<ScrollView>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setDetailsReady(true);
      if (selectedIdx > 2) {
        chipsRef.current?.scrollTo({
          x: (selectedIdx - 2) * (CHIP_W + CHIP_GAP),
          animated: false,
        });
      }
    });
    return () => cancelAnimationFrame(id);
    // Samo pri montiranju — kasniji odabir čipom je već u kadru.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deg = (v: number) => `${Math.round(convertTemp(v, tempUnit))}°`;

  const offset = day ? dayOffset(day.date) : NaN;
  const title = !day
    ? t.common.noData
    : offset === 0
      ? t.common.today
      : offset === 1
        ? t.common.tomorrow
        : capitalize(weekdayOf(day.date));
  /*
   * Podnaslov nosi ono što naslov ne kaže: kod „Danas"/„Sutra" i ime dana
   * s datumom, kod imenovanog dana samo datum — pa uvijek stoji i mjesto.
   */
  const subtitle = day
    ? `${offset === 0 || offset === 1 ? `${weekdayOf(day.date)}, ` : ""}${shortDate(day.date)}${place ? ` · ${place}` : ""}`
    : place;

  const condition = day ? codeToCondition(day.code, true) : undefined;

  return (
    <View collapsable={false} className="flex-1 bg-mist dark:bg-night">
      {/*
        OBLIK SADRŽAJA JE UGOVOR S react-native-screens, ne stil: nativni
        iOS kod za formSheet (RNSScreen.mm) SAM traži ScrollView — kroz
        direktnu djecu omotača i niz lanac prvih podviewova — i rukom mu
        postavi frame na veličinu sheeta, mimo Yoga layouta. Podržano je
        NAJVIŠE dvoje djece: header (collapsable={false}, da ga Fabric ne
        splošti) + JEDAN ScrollView. S tri brata (zaglavlje + čipovi +
        sadržaj) korekcija zgrabi krivi ScrollView i razvuče ga preko
        naslova na y=0 — zato su naslov+X+čipovi u JEDNOM bloku, a ispod
        stoji jedini ScrollView. collapsable={false} i na korijenu, da
        omotač nikad ne vidi ScrollView kao izravno dijete.
      */}
      <View collapsable={false}>
      {/*
        Zaglavlje — vlastito, jer sheet nema navigacijski header.

        pt-7 (28 px), ne pt-4 (10.9.2026., Markov nalaz nakon koncentricnog
        radijusa: "odmakni ime dana i X od gore, preblizu je"). Sheet na
        iOS 26 nosi sustavski radijus koncentrican s ekranom (~40 pt na
        iPhoneu 13), pa gornji luk ulazi dublje u karticu nego s 24; uz to
        grabber sjedi u prvih ~15 pt. Naslov i X su s 16 px paddinga
        sjedali u taj luk. 28 ih spusta ispod grabbera i izvan zakrivljenog
        pojasa; Android (radijus 28, bez grabbera) dobiva isti razmak da
        sheet na obje platforme pocinje istom visinom.
      */}
      <View className="flex-row items-start justify-between px-5 pb-1 pt-7">
        <View className="flex-1 gap-0.5">
          <Text className="font-grotesk-bold text-[26px] leading-8 text-ink dark:text-paper">
            {title}
          </Text>
          {!!subtitle && (
            <Text className="font-grotesk-medium text-[13.5px] text-ink/55 dark:text-paper/55">
              {subtitle}
            </Text>
          )}
        </View>
        {/*
          Gumb za zatvaranje uz grabber: na Androidu grabbera nema, a i na
          iOS-u je za starije korisnike izričit „X" jasniji od povlačenja.
          Pravilo ikonskih gumba: prava meta + ikona bez dodira.
        */}
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t.common.close}
          className="h-9 w-9 items-center justify-center rounded-full bg-ink/[0.06] dark:bg-paper/[0.08]"
        >
          <View pointerEvents="none">
            <X size={18} strokeWidth={2.25} color={fg} opacity={0.75} />
          </View>
        </Pressable>
      </View>

      {/*
        Traka dana — 14 čipova, vodoravno. Aktivni je ispunjen `ACCENT_UI`
        kao ostali „odabrano" elementi (postavke, čipovi, dugmad dana na
        karti). Danas i sutra su riječi, ostali kratica dana; datum ispod.
      */}
      {days.length > 0 && (
        <ScrollView
          ref={chipsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          /*
            flexGrow: 0 je OBAVEZAN: RN ScrollView ima ugrađen flexGrow: 1
            (i vodoravni!), a ovo je jedini horizontalni ScrollView u OMEĐENOM
            stupcu (sheet je flex-1) — bez ovoga proguta slobodnu visinu
            sheeta i čipovi se rastegnu do dna (alignItems: stretch), preko
            naslova. HourlyStrip to ne treba jer živi u neomeđenom
            scroll-sadržaju koji samo omata visinu djece.
          */
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: CHIP_GAP, paddingVertical: 10 }}
        >
          {days.map((d) => {
            const isActive = d.date === date;
            const off = dayOffset(d.date);
            const label =
              off === 0
                ? t.common.today
                : off === 1
                  ? t.common.tomorrow
                  : capitalize(weekdayOf(d.date, true));
            const { Icon } = codeToCondition(d.code, true);
            return (
              <Pressable
                key={d.date}
                onPress={() => setDate(d.date)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                className={`items-center gap-1 rounded-2xl py-2.5 ${
                  isActive ? "" : "bg-white dark:bg-coal"
                }`}
                style={[{ width: CHIP_W }, isActive ? { backgroundColor: ACCENT_UI } : null]}
              >
                <Text
                  numberOfLines={1}
                  className={`font-grotesk-bold text-[12px] ${
                    isActive ? "text-white" : "text-ink/75 dark:text-paper/75"
                  }`}
                >
                  {label}
                </Text>
                <Icon
                  size={18}
                  strokeWidth={2}
                  color={isActive ? "#FFFFFF" : fg}
                  opacity={isActive ? 0.95 : 0.65}
                />
                {/* Datum ispod, isti oblik kao u listi („10.9.") — po njemu se dan prepoznaje. */}
                <Text
                  className={`font-grotesk-medium text-[11px] ${
                    isActive ? "text-white/80" : "text-ink/45 dark:text-paper/45"
                  }`}
                >
                  {shortDate(d.date)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-4 pt-1"
        contentContainerStyle={{ paddingBottom: 20 + bottomInset }}
      >
        {!day && (
          <View className="items-center rounded-2xl bg-white px-4 py-10 dark:bg-coal">
            <Text className="font-grotesk-medium text-[15px] text-ink/65 dark:text-paper/65">
              {t.common.noData}
            </Text>
          </View>
        )}

        {day && condition && (
          <>
            {/*
              Sažetak dana iznad razdoblja: što je bilo u retku liste (stanje,
              min–max, oborine) ostaje na oku i kad se dan mijenja čipom.
            */}
            <View className="flex-row items-center gap-3.5 rounded-2xl bg-white px-4 py-3.5 dark:bg-coal">
              <condition.Icon size={30} strokeWidth={1.75} color={fg} opacity={0.8} />
              <View className="flex-1 gap-0.5">
                <Text className="font-grotesk-bold text-[16px] text-ink dark:text-paper">
                  {condition.label}
                </Text>
                <Text className="font-grotesk-medium text-[13px] text-ink/60 dark:text-paper/60">
                  {t.home.maxShort} {deg(day.tMax)} · {t.home.minShort} {deg(day.tMin)}
                  {day.precipProbMax >= 1
                    ? ` · ${t.metrics.precipitation} ${Math.round(day.precipProbMax)} %`
                    : ""}
                </Text>
              </View>
            </View>

            {detailsReady && (
              <View className="rounded-2xl bg-white px-4 py-2 dark:bg-coal">
                {/* `key` po datumu: odabrano razdoblje se vraća na prvo kad se dan promijeni. */}
                <DayDetails
                  key={day.date}
                  day={day}
                  hourly={hourly}
                  tempUnit={tempUnit}
                  windUnit={windUnit}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
