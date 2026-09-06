import Slider from "@react-native-community/slider";
import { Pause, Play } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import type { MapLayer } from "@/api/mapLayers";
import type { RadarFrame } from "@/api/types";
import type { TimelineHour } from "@/hooks/useTimelineHours";
import { t } from "@/i18n";
import { useThemeColors } from "@/theme/useThemeColors";
import type { TempUnit, WindUnit } from "@/utils/format";
import {
  clockTime,
  convertTemp,
  convertWind,
  tempUnitSuffix,
  windUnitLabel,
} from "@/utils/format";
import { ACCENT_STEEL } from "@/utils/weatherLook";

/** Jedan korak crte, sveden na ono što se prikazuje. */
type Step = {
  label: string;
  /** Desna oznaka: "prognoza" za nowcast, vrijednost za centar na OWM slojevima. */
  note?: string;
  isNow: boolean;
};

function hourLabel(iso: string): string {
  return `${iso.slice(11, 13)}:00`;
}

/**
 * Vrijednost za centar karte, ovisno o sloju (bez nje je klizač mrtav).
 *
 * Jedinice su OBAVEZNE (popravak 6.8.2026.): prije su ovdje išli sirovi
 * °C i tvrdo upisan "km/h", pa je crta uz odabrani °F/m-s pokazivala
 * druge brojeve od cijele ostale aplikacije.
 */
function valueNote(
  layer: MapLayer,
  hour: TimelineHour,
  units: Units,
): string | undefined {
  switch (layer.id) {
    case "temp_new":
      return hour.temp === undefined
        ? undefined
        : `${Math.round(convertTemp(hour.temp, units.tempUnit))}${tempUnitSuffix(units.tempUnit)}`;
    case "clouds_new":
      return hour.cloudCover === undefined ? undefined : `${Math.round(hour.cloudCover)} %`;
    case "wind_new":
      return hour.windSpeed === undefined
        ? undefined
        : `${Math.round(convertWind(hour.windSpeed, units.windUnit))} ${windUnitLabel(units.windUnit)}`;
    default:
      return undefined;
  }
}

/** Jedinice iz postavki — prosljeđuju se da `timelineSteps` ostane čist. */
export type Units = { tempUnit: TempUnit; windUnit: WindUnit };

/** Izvezeno radi testova: koraci crte za dani sloj. */
export function timelineSteps(
  layer: MapLayer,
  frames: RadarFrame[],
  hours: TimelineHour[],
  units: Units = { tempUnit: "C", windUnit: "ms" },
): Step[] {
  if (layer.timeline === "frames") {
    return frames.map((f, i) => ({
      label: clockTime(f.time * 1000),
      note: f.isNowcast ? t.map.forecastLabel : undefined,
      // Zadnji izmjereni okvir je "sada"; nowcast je budućnost.
      isNow: !f.isNowcast && frames.map((x) => x.isNowcast).lastIndexOf(false) === i,
    }));
  }
  return hours.map((h) => ({
    label: hourLabel(h.time),
    note: valueNote(layer, h, units),
    isNow: h.isNow,
  }));
}

/**
 * Indeks koraka "sada" — sidro crte. Kad ga nema (npr. radar bez ijednog
 * izmjerenog okvira), vraća -1 i crta se ponaša kao prije.
 */
export function nowStepIndex(steps: Step[]): number {
  return steps.findIndex((s) => s.isNow);
}

/** Jedan dan u traci dugmadi iznad klizača. */
export type DayJump = {
  /** "danas", "sub", "ned"… */
  label: string;
  /** Korak na koji dugme skače. */
  index: number;
  /** Prvi i zadnji korak tog dana — dugme je aktivno dok je klizač unutra. */
  from: number;
  to: number;
};

/**
 * DUGMAD ZA DANE (Markov odabir 6.9.2026.: "sljedeća 3 dana želim da budu
 * dugmad pa da prebaci na tu točku na liniji ispod").
 *
 * Klizač preko 96 sati je precizan, ali za "pokaži mi sutra" traži pogađanje
 * — korisnik povlači i gleda mijenja li se datum. Dugmad daju krupnu metu za
 * ono što se najčešće traži, a klizač ostaje za fino štimanje.
 *
 * Dugme skače na PODNE tog dana, ne na ponoć: podne je sat po kojem se dan
 * prepoznaje (ponoć izgleda isto svaki dan). Iznimka je današnji dan, koji
 * skače na "sada" — tamo je korisnik i inače krenuo.
 *
 * Radi SAMO na satnoj crti. Radarski okviri pokrivaju dva sata unatrag, pa
 * ondje nema dana za preskakanje i traka se ne prikazuje.
 *
 * Izvezeno radi testova.
 */
export function dayJumps(hours: TimelineHour[], nowIdx: number): DayJump[] {
  if (hours.length === 0) return [];

  const byDate = new Map<string, number[]>();
  hours.forEach((h, i) => {
    const date = h.time.slice(0, 10);
    const list = byDate.get(date);
    if (list) list.push(i);
    else byDate.set(date, [i]);
  });

  const todayDate = nowIdx >= 0 ? hours[nowIdx]?.time.slice(0, 10) : undefined;

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, idx]) => {
      const from = idx[0]!;
      const to = idx[idx.length - 1]!;
      const offset = todayDate ? dayOffset(todayDate, date) : undefined;
      const isToday = offset === 0;
      /*
       * Podne se traži MEĐU KORACIMA TOG DANA, a ne računa kao `from + 12`:
       * prvi dan crte počinje u ponoć samo kad je `past_days` cijeli dan, a
       * zadnji zna biti odrezan. Bez toga bi dugme znalo pasti u drugi dan.
       */
      const noon = idx.find((i) => hours[i]!.time.slice(11, 13) === "12");
      return {
        label: dayLabel(date, offset),
        index: isToday && nowIdx >= 0 ? nowIdx : (noon ?? from),
        from,
        to,
      };
    });
}

/** Razlika u DANIMA između dva `YYYY-MM-DD` (pozitivno = u budućnosti). */
function dayOffset(from: string, to: string): number {
  const at = (s: string) => {
    const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/**
 * Oznaka dugmeta (Markov odabir 6.9.2026.).
 *
 * Jučer je "-24 h", a ne ime dana: ime dana u prošlosti se pomiješa s istim
 * danom sljedećeg tjedna, dok "-24 h" odmah kaže koliko unatrag. Sutra ima
 * svoju riječ jer je najčešća meta. Dalji dani nose DATUM ("8.9."), jer se
 * "pon"/"uto" pri kraju tjedna ne razlikuju od prošlih dana.
 *
 * Bez poznatog "danas" (radar bez izmjerenog okvira) sve pada na datum —
 * relativne oznake tada nemaju u odnosu na što biti relativne.
 */
function dayLabel(date: string, offset: number | undefined): string {
  if (offset === 0) return t.map.nowLabel;
  if (offset === -1) return t.map.dayYesterday;
  if (offset === 1) return t.map.dayTomorrow;
  const [, m = "1", d = "1"] = date.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

/**
 * Vremenska crta karte — **ista komponenta na svim slojevima**, uvijek na
 * istom mjestu na dnu. Play/pauza lijevo od klizača, oznaka vremena ispod.
 *
 * Na radaru koraci su RainViewer okviri i animacija mijenja sliku. Na OWM
 * slojevima besplatne pločice nose samo trenutno stanje, pa klizanje mijenja
 * sat i **vrijednost za centar karte** (temperatura / naoblaka / vjetar) —
 * kontrola ostaje smislena i nikad se ne skriva.
 */
export function MapTimeline({
  layer,
  frames,
  hours,
  index,
  playing,
  onTogglePlay,
  onScrub,
  units,
}: {
  layer: MapLayer;
  frames: RadarFrame[];
  hours: TimelineHour[];
  index: number;
  playing: boolean;
  onTogglePlay: () => void;
  onScrub: (index: number) => void;
  /**
   * Jedinice DOLAZE IZ EKRANA, ne iz storea (6.8.2026.): `useSettings`
   * ovdje bi uvukao AsyncStorage u modul, a njegovi testovi su čista
   * logika bez nativnih modula — suite se odmah prestao pokretati.
   */
  units: Units;
}) {
  const { dark } = useThemeColors();
  const steps = timelineSteps(layer, frames, hours, units);
  const step = steps[index];

  // Bez koraka (izvor još učitava) crta ostaje vidljiva, ali neaktivna —
  // nikad se ne odmontira, da ne poskakuje pri prebacivanju sloja.
  const disabled = steps.length === 0;

  /*
   * Sidro "Sada" na skali (dorada 6.8.2026.): crta ide OD prošlosti
   * PREKO sada U BUDUĆNOST, pa se mora vidjeti gdje je ta granica.
   * Oznaka stoji na svom stvarnom mjestu, a ne uvijek na kraju.
   *
   * Na radaru je "sada" pri kraju jer RainViewer nowcast zna biti prazan
   * (izmjereno 6.8.2026.: 13 prošlih okvira, 0 nowcasta). Na Open-Meteo
   * slojevima je otprilike u sredini (past_days=1, forecast_days=3).
   */
  const nowIdx = nowStepIndex(steps);
  /*
   * Dugmad dana samo na SATNOJ crti: radarski okviri pokrivaju dva sata
   * unatrag, pa ondje nema dana za preskakanje.
   */
  const jumps = layer.timeline === "hours" ? dayJumps(hours, nowIdx) : [];
  const lastIdx = Math.max(1, steps.length - 1);
  const nowPct = nowIdx >= 0 ? (nowIdx / lastIdx) * 100 : undefined;
  const isFuture = nowIdx >= 0 && index > nowIdx;

  return (
    /*
     * Tamna kartica preko karte (referentna slika, 6.8.2026.): naziv
     * sloja gore, ispod veliki sat + vrijednost, pa tanki klizač. Uvijek
     * tamna — na karti (koja je čas svijetla, čas tamna, čas plava) je
     * tamna ploha jedina podloga koja svugdje drži kontrast.
     */
    <View className="gap-2 rounded-2xl bg-ink/90 px-4 py-3">
      <Text className="font-grotesk-bold text-[12.5px] text-paper/60">
        {layer.label}
      </Text>

      {/*
        Traka dana — krupna meta za "pokaži mi sutra", dok klizač ostaje za
        fino štimanje. Aktivno je ono dugme unutar čijeg raspona klizač
        trenutno stoji, pa se odmah vidi GDJE si na crti.

        Boja aktivnog je `ACCENT_STEEL`, ista kao klizač i čipovi slojeva na
        tamnoj traci (`ACCENT_UI` ondje pada na 2.55:1 — vidi odluku o
        akcentima).
      */}
      {jumps.length > 1 && (
        <View className="flex-row gap-1.5">
          {jumps.map((d) => {
            const active = index >= d.from && index <= d.to;
            return (
              <Pressable
                key={d.label + d.from}
                onPress={() => onScrub(d.index)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                // p-2/-m-2 pravilo za dodirne mete: glif ostaje na mjestu,
                // a meta naraste preko 44 px (vidi odluku od 8.8.2026.).
                className="rounded-full px-3 py-1.5"
                style={{ backgroundColor: active ? ACCENT_STEEL : "#FAFAF81F" }}
              >
                <Text
                  className="font-grotesk-bold text-[11.5px]"
                  style={{ color: active ? "#FFFFFF" : "#FAFAF8B3" }}
                >
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onTogglePlay}
          hitSlop={10}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={playing ? t.map.pause : t.map.play}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: disabled ? "#FAFAF81F" : ACCENT_STEEL }}
        >
          {playing ? (
            <Pause size={17} strokeWidth={2.5} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play
              size={17}
              strokeWidth={2.5}
              color="#FFFFFF"
              fill="#FFFFFF"
              opacity={disabled ? 0.4 : 1}
              // Trokut je optički lijevo od sredine kruga bez ovog pomaka.
              style={{ marginLeft: 2 }}
            />
          )}
        </Pressable>

        <View className="flex-1">
          <View className="flex-row items-baseline justify-between">
            <Text className="font-grotesk-bold text-[17px] text-paper">
              {step ? (step.isNow ? t.map.nowLabel : step.label) : "–"}
            </Text>
            {step?.note && (
              <Text
                className="font-grotesk-bold text-[13px]"
                style={{ color: isFuture ? ACCENT_STEEL : "#FAFAF8B3" }}
              >
                {step.note}
              </Text>
            )}
          </View>

          <View className="justify-center" style={{ height: 26 }}>
            {/* Šina + sidro "Sada" leže ISPOD klizača, kroz njegovu os. */}
            <View
              className="absolute left-0 right-0 rounded-full bg-paper/20"
              style={{ height: 3 }}
            />
            {nowPct !== undefined && (
              <View
                className="absolute rounded-full bg-paper/70"
                style={{ width: 2, height: 11, left: `${nowPct}%`, marginLeft: -1 }}
              />
            )}
            <Slider
              style={{ width: "100%", height: 26 }}
              minimumValue={0}
              maximumValue={Math.max(0, steps.length - 1)}
              step={1}
              value={index}
              disabled={disabled}
              onValueChange={(v) => onScrub(Math.round(v))}
              minimumTrackTintColor="transparent"
              maximumTrackTintColor="transparent"
              thumbTintColor={ACCENT_STEEL}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
