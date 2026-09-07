import Slider from "@react-native-community/slider";
import { Pause, Play } from "lucide-react-native";
import { useState } from "react";
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
export function dayJumps(hours: TimelineHour[], nowIdx: number, now: Date = new Date()): DayJump[] {
  if (hours.length === 0) return [];

  const byDate = new Map<string, number[]>();
  hours.forEach((h, i) => {
    const date = h.time.slice(0, 10);
    const list = byDate.get(date);
    if (list) list.push(i);
    else byDate.set(date, [i]);
  });

  /*
   * "Danas" se određuje iz SATA UREĐAJA, a ne samo iz `isNow` zastavice
   * (popravak 6.9.2026., Markov nalaz: "za sutra da stoji Sutra, a ne
   * datum").
   *
   * `isNow` traži TOČNO poklapanje niza ("2026-09-07T14:00") s tekućim
   * satom. Kad se ne poklopi — a ne poklopi se čim niz počne na pola sata,
   * kad uređaj i `timezone=auto` nisu u istoj zoni, ili naprosto dok upit
   * stoji preko punog sata — `nowIdx` je -1, "danas" je nepoznat i SVI
   * dani ispadnu kao datum, uključujući sutra.
   *
   * Zato je datum uređaja rezerva: oznake tada i dalje rade, a `isNow`
   * ostaje za sidro na skali (ono stvarno treba točan sat).
   */
  const todayDate =
    (nowIdx >= 0 ? hours[nowIdx]?.time.slice(0, 10) : undefined) ?? localDateKey(now);

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

/** "2026-09-07" iz `Date`, u LOKALNOJ zoni (`toISOString` bi dao UTC). */
function localDateKey(at: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}`;
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
 * Dugme dana u traci iznad klizača.
 *
 * Zašto zasebna komponenta: treba mu `pressed` stanje, a `pressed` kroz
 * `style`-funkciju na Pressableu NE RADI uz NativeWind — `className` se
 * prevede u `style` i PREPIŠE funkciju (odluka iz Recent Decisions; 7.9.
 * 2026. ponovno dokazano na ovom dugmetu: s funkcijom je nestala i
 * pozadina, "nema backgrounda uopće"). Zato `onPressIn/Out` + `useState`,
 * a `style` ostaje običan objekt.
 *
 * Pritisak se vidi ODMAH (Markov nalaz 7.9.2026.: "daj korisniku feeling
 * da je odma otisao na taj dan"): sat i odabir se mijenjaju u istom kadru
 * kao dodir, kasni samo SLIKA PLOČICE s mreže — bez odziva to izgleda kao
 * da dodir nije primljen, pa korisnik pritisne opet.
 *
 * Neaktivno dugme mora IZGLEDATI kao dugme ("da se vidi da su
 * klikabilni"): 12 % bijele se na `ink/90` gubi u goli tekst; 22 % ispune
 * + tanki rub od 30 % daju obris, a aktivno (puna `ACCENT_STEEL`) i dalje
 * jasno vodi. Rub ide i na aktivno, u boji ispune, da oba stanja ostanu
 * iste veličine i ne poskakuju pri prebacivanju.
 */
function DayButton({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="rounded-full px-3 py-1.5"
      style={{
        backgroundColor: active ? ACCENT_STEEL : "#FAFAF838",
        borderWidth: 1,
        borderColor: active ? ACCENT_STEEL : "#FAFAF84D",
        opacity: pressed ? 0.6 : 1,
      }}
    >
      <Text
        className="font-grotesk-bold text-[11.5px]"
        style={{ color: active ? "#FFFFFF" : "#FAFAF8B3" }}
      >
        {label}
      </Text>
    </Pressable>
  );
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

  /**
   * KLIZAČ POKRIVA SAMO ODABRANI DAN (Markov odabir 6.9.2026.: "želim da
   * svaki dan ima novu ovu liniju vremena, ne da sva 4 dana budu na toj
   * jednoj liniji").
   *
   * Prije je jedna šina nosila svih 120 sati, pa je jedan dan bio petina
   * širine ekrana — pomak od jednog piksela preskakao je nekoliko sati i
   * fino biranje sata je bilo nemoguće. Sada dan bira dugme, a klizač daje
   * punu širinu TOM danu: 24 koraka preko cijele šine.
   *
   * Bez dana (radar) raspon je cijela crta, kao i prije.
   */
  const activeDay = jumps.find((d) => index >= d.from && index <= d.to);
  const range = activeDay ?? { from: 0, to: Math.max(0, steps.length - 1) };

  /*
   * Sidro "Sada" se crta samo kad pada U VIDLJIVI raspon — inače bi na
   * sutrašnjem danu stajala crtica koja ne označava ništa.
   */
  const span = Math.max(1, range.to - range.from);
  const nowPct =
    nowIdx >= range.from && nowIdx <= range.to
      ? ((nowIdx - range.from) / span) * 100
      : undefined;
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
      {jumps.length > 0 && (
        <View className="flex-row gap-1.5">
          {jumps.map((d) => (
            <DayButton
              key={d.label + d.from}
              label={d.label}
              active={index >= d.from && index <= d.to}
              disabled={disabled}
              onPress={() => onScrub(d.index)}
            />
          ))}
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
            {/*
              KLIZAČ RADI U NORMALIZIRANOM RASPONU 0..span, a ne u indeksima
              crte (popravak 7.9.2026., Markov nalaz na iOS-u: "stisnem
              sutra, kugla je skroz na kraju; stisnem play i onda tek skokne
              na 12").

              Uzrok je u nativnom iOS Slideru (`RNCSliderComponentView.mm`
              `updateProps`, pročitano u node_modules): `value` se upisuje
              PRIJE `minimumValue`/`maximumValue`, a `setValue:` ga kroz
              `discreteValue:` STEGNE NA STARI raspon i taj stegnuti broj
              spremi kao `_unclippedValue`. Kad zatim stignu nove granice,
              one vraćaju upravo taj krivi broj — pa je za "-24 h" podne
              (12) postalo 38 (današnji sat), pa 23 (kraj jučerašnjeg dana).
              Stanje je cijelo vrijeme bilo ispravno (sat je pisao 12:00);
              samo palac nije. Android radi `updateAll()` iz spremljenih
              vrijednosti pa ondje nema kvara.

              Kad su `min`/`max` STALNI (0..23 za svaki puni dan), promjena
              dana mijenja samo `value` i ništa se ne steže. `key` je drugi
              pojas SAMO za promjenu `span`-a (radar s drugim brojem
              okvira): tada se Slider ponovno montira, a na svježem je
              `step` još 0 dok se `value` upisuje, pa `discreteValue:`
              propušta broj netaknut. Ključ NAMJERNO nije po danu — svježi
              UISlider jedan kadar stoji na 0 prije nego primi `value`, pa
              je remount pri svakoj promjeni dana davao "flick" palca na
              početak (Markov nalaz 7.9.2026.).
            */}
            <Slider
              key={span}
              style={{ width: "100%", height: 26 }}
              minimumValue={0}
              maximumValue={span}
              step={1}
              value={index - range.from}
              disabled={disabled}
              onValueChange={(v) => onScrub(range.from + Math.round(v))}
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
