import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";

import type { MeteoWarning } from "@/api/meteoalarm";
import type { CurrentWeather, HourlyPoint } from "@/api/types";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { HourlyStrip } from "@/components/HourlyStrip";
import { WarningBar } from "@/components/WarningBar";
import { WindFlag } from "@/components/WindFlag";
import { useNow } from "@/hooks/useNow";
import { t } from "@/i18n";
import { useThemeColors } from "@/theme/useThemeColors";
import type { TempUnit, WindUnit } from "@/utils/format";
import { clockTime, convertTemp, convertWind, windUnitLabel } from "@/utils/format";
import { backdropEffects, heroAccent, precipIntensity, readableOn, stripAccent, windStrength, type GradientStops } from "@/utils/weatherLook";
import { codeToCondition } from "@/utils/weatherCodes";

/** "čet 6.8." — red datuma gore lijevo. */
function dateLabel(d: Date): string {
  const day = t.dayNamesShort[d.getDay()] ?? "";
  return `${day} ${d.getDate()}.${d.getMonth() + 1}.`;
}

/**
 * Duga tanka strelica (kao na referenci) — lucide ArrowUp je prekratak,
 * referenca ima izduženu liniju s malom glavom.
 */
function LongArrow({ up, color }: { up: boolean; color: string }) {
  const H = 38;
  const tipY = up ? 5 : H - 5;
  const headDy = up ? 7 : -7;
  return (
    <Svg width={16} height={H} style={{ marginVertical: 2 }}>
      <Line x1={8} y1={5} x2={8} y2={H - 5} stroke={color} strokeWidth={1.8} strokeLinecap="round" opacity={0.85} />
      <Line x1={8} y1={tipY} x2={3.5} y2={tipY + headDy} stroke={color} strokeWidth={1.8} strokeLinecap="round" opacity={0.85} />
      <Line x1={8} y1={tipY} x2={12.5} y2={tipY + headDy} stroke={color} strokeWidth={1.8} strokeLinecap="round" opacity={0.85} />
    </Svg>
  );
}

/**
 * Prvi ekran aplikacije (redizajn 6.8.2026., v7 mockup): gradijent po
 * vremenu s dijagonalnim prugama, datum + hamburger na vrhu, tipografska
 * sredina, traka po satima na dnu.
 *
 * Raspored je APSOLUTAN (vrh/sredina/dno pribijeni na rubove), ne flex
 * lanac: na uređaju se flex stupac znao stisnuti na prirodnu visinu pa je
 * "cijeli ekran" završavao na pola. Visina dolazi izmjerena iz viewporta
 * (onLayout na ScrollViewu), ne iz useWindowDimensions.
 */
export function Hero({
  height,
  width,
  placeName,
  current,
  tMax,
  nightMin,
  tempUnit,
  windUnit,
  hours,
  warnings,
  fetchedAt,
  isStale,
  stops,
  pageBg,
  scrollY,
}: {
  height: number;
  width: number;
  placeName: string;
  current: CurrentWeather;
  tMax?: number;
  nightMin?: number;
  tempUnit: TempUnit;
  /** Za brzinu udara uz vjetrulju — ista jedinica kao u karticama. */
  windUnit: WindUnit;
  hours: HourlyPoint[];
  /** Meteoalarm upozorenja za mjesto; prazno = nema trake. */
  warnings: MeteoWarning[];
  fetchedAt: number;
  isStale: boolean;
  stops: GradientStops;
  pageBg: string;
  /** Pomak skrola — pruge pozadine klize (paralaksa). */
  scrollY?: Animated.Value;
}) {
  const insets = useSafeAreaInsets();
  const { dark } = useThemeColors();

  /*
   * BOJA TEKSTA PRATI PODLOGU, NE TEMU (Markov ispravak 6.8.2026.).
   *
   * Dosad je svugdje stajalo `text-ink dark:text-paper`, dakle tekst je
   * ovisio o TEMI aplikacije. To je vrijedilo dok su svijetli gradijenti
   * bili svijetli — ali otkad je noć tamna i u svijetloj temi, crni je
   * tekst pao na tamnoplavu podlogu i gotovo se izgubio (nađeno na
   * uređaju).
   *
   * `readableOn` odlučuje po stvarnoj luminanciji SREDNJEG stopa
   * gradijenta: taj pokriva pojas u kojem stoji sav tekst heroja (datum,
   * grad, velika brojka, opis, minimum). Ista funkcija koju već koristi
   * značka na karti, iz istog razloga.
   */
  const heroFg = readableOn(stops[1]);
  /** Prigušene varijante — nekad `text-ink/75`, sada po istoj podlozi. */
  const heroFg75 = { color: heroFg, opacity: 0.75 };
  const heroFg70 = { color: heroFg, opacity: 0.7 };
  /** Strelice i ikone dijele boju s tekstom. */
  const fg = heroFg;
  // Živ sat: bez ovoga je datum/vrijeme stajao na trenutku renderiranja.
  const now = useNow();

  const condition = codeToCondition(current.code, current.isDay);
  const deg = (v: number) => `${Math.round(convertTemp(v, tempUnit))}`;
  /*
   * Brzina uz vjetrulju se pokazuje po ISTOM pragu po kojem se crta i
   * značka (`windStrength`), pa se ne mogu razići — inače bi broj stajao
   * sam bez ikone ili obrnuto.
   */
  const gustFlag = windStrength(current.windGusts) !== "calm";

  return (
    <View style={{ height, width }}>
      <HeroBackdrop
        stops={stops}
        pageBg={pageBg}
        width={width}
        height={height}
        // Ambijent prati vrijeme: zrake / kiša / pahulje / magla.
        effects={backdropEffects(current.code, current.isDay)}
        // Rosulja jedva klizi, pljusak juri.
        intensity={precipIntensity(current.code)}
        scrollY={scrollY}
      />

      {/* Sredina: centrirana na CIJELI hero, neovisno o vrhu i dnu. */}
      <View className="items-center justify-center" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}>
        {/*
          Meteoalarm iznad SVEGA u sredini (dorada 6.8.2026.): upozorenje
          se čita prije temperature, pa stoji nad dnevnim maksimumom, a ne
          stisnuto uz veliku brojku.
        */}
        <WarningBar warnings={warnings} />

        {tMax !== undefined && (
          <>
            <Text className="mt-3 font-grotesk-bold text-[16px]" style={{ color: heroFg }}>
              {deg(tMax)}°
            </Text>
            <LongArrow up color={fg} />
          </>
        )}

        {/*
          Razmaci oko velike brojke (dorada 6.8.2026.): okvir teksta nosi
          ~38 px praznine iznad glifa i ~36 ispod, pa je razmak do imena
          mjesta izgledao znatno veći od onog do opisa vremena.

          Izmjereno: praznina okvira je 38.8 px gore i 36.3 dolje.
          Vrijednosti su naštimane NA UREĐAJU (Markov odabir): ime mjesta
          stoji odmaknutije od brojke nego opis vremena ispod nje.
          Stezanje `lineHeight`-a bi bilo čišće, ali odsiječe donju
          polovicu znamenki (provjereno).
        */}
        <Text className="font-grotesk-bold text-[17px]" style={[{ color: heroFg }, { marginBottom: 25 }]}>
          {placeName}
        </Text>

        {/*
          Velika brojka je OPTIČKI CENTRIRANA, a ° visi izvan nje.
          (dorada 6.8.2026. po mockupu):

          Prije su brojka i ° bili u istom flex redu, pa je širina °
          gurala znamenke ULIJEVO — brojka nije stajala na sredini
          ekrana, nego je par cijelih znamenki bilo pomaknuto. Sada je
          ° `position: absolute` uz lijevi rub svog praznog stupca:
          izlazi iz protoka, ne mjeri se, i ne pomiče znamenke.
        */}
        <View className="flex-row items-start">
          <Text
            className="font-grotesk-bold"
            style={{
              color: heroFg,
              fontSize: 128,
              /*
               * `lineHeight` MORA biti veći od fontSize — stezanje na
               * visinu znamenki (97) odsjeklo je donju polovicu brojke
               * na uređaju (6.8.2026.). Okvir zato ostaje prostran, a
               * nejednaki razmaci se poravnavaju marginama ispod.
               */
              lineHeight: 134,
              /*
               * `letterSpacing` NULA (dorada 6.8.2026.): negativan razmak
               * (-6) stezao je glifove uz lijevi rub okvira teksta, pa je
               * prva znamenka bila ODREZANA slijeva ("18" bez lijevog
               * brida jedinice — nađeno na uređaju).
               *
               * Malen vodoravni padding je rezerva za glifove koji vire
               * izvan svoje širine (kurziv nagib, zaobljenja).
               */
              letterSpacing: 0,
              paddingHorizontal: 4,
            }}
          >
            {deg(current.temp)}
          </Text>
          {/* Prazan stupac širine 0 — nosač za ° koji ne zauzima prostor. */}
          <View style={{ width: 0 }}>
            <Text
              className="font-grotesk-medium"
              style={{
                color: heroFg,
                position: "absolute",
                left: 7,
                top: 4,
                fontSize: 52,
                lineHeight: 54,
              }}
            >
              °
            </Text>
            {/*
              "F" samo u Fahrenheitima (Markov odabir 6.8.2026.): sivkasto,
              ISPOD kružića — poravnat s njim po lijevom rubu, a spušten do
              DNA velike brojke. Celzijus ga ne dobiva; ° je dovoljan.

              Mjere: brojka ima lineHeight 134 i glif joj završi na ~116 px
              (okvir nosi ~36 px praznine ispod — izmjereno 6.8.2026.).
              F visine 30 zato ide na top 84 da mu dno padne na istu
              liniju kao dno znamenki. `left: 7` je ISTI kao na kružiću, pa
              stoje u stupcu jedan pod drugim.
            */}
            {tempUnit === "F" && (
              <Text
                className="font-grotesk-medium"
                style={{
                  position: "absolute",
                  left: 7,
                  top: 73,
                  fontSize: 28,
                  lineHeight: 30,
                  color: fg,
                  opacity: 0.3,
                }}
              >
                F
              </Text>
            )}
          </View>
        </View>

        {/* Malo primaknuto brojci u odnosu na prijašnjih −10. */}
        <Text className="font-grotesk-bold text-[17px]" style={[{ color: heroFg }, { marginTop: -10 }]}>
          {condition.label}
        </Text>

        {/* Stvarni osjet odmah uz opis vremena. */}
        <Text className="mt-0.5 font-grotesk-medium text-[15px]" style={heroFg75}>
          {t.home.feelsLike} {deg(current.feelsLike)}°
        </Text>

        {nightMin !== undefined && (
          <>
            <View style={{ marginTop: 4 }}>
              <LongArrow up={false} color={fg} />
            </View>
            <Text className="font-grotesk-bold text-[16px]" style={{ color: heroFg }}>
              {deg(nightMin)}°
            </Text>
          </>
        )}
      </View>

      {/*
        Vrh: SAMO datum, centriran (dorada 6.8.2026.). Pretraga i izbornik
        su otišli u fiksnu traku ekrana (ostaju vidljivi pri skrolanju), pa
        se datum spustio ispod njih i dobio sredinu.
      */}
      <View className="items-center" style={{ position: "absolute", top: insets.top + 58, left: 0, right: 0 }}>
        <Text className="font-grotesk-bold text-[16px]" style={{ color: heroFg }}>
          {dateLabel(now)}
        </Text>
        <Text className="font-grotesk-medium text-[14px]" style={heroFg75}>
          {isStale ? `${t.common.dataFrom} ` : ""}
          {clockTime(fetchedAt)}
        </Text>

        {/*
          VJETRULJA NA HEROJU (6.8.2026.) — ispod datuma, uz brzinu udara.
          Stoji ovdje, a ne u kutu: kut gore lijevo drži tražilicu, desni
          hamburger, a sredina je jedina os koja je već centrirana.

          Značka se pojavljuje SAMO kad udari prijeđu 10 m/s (`WindFlag`
          inače vrati null), pa je u mirnom vremenu ovdje nema — a kad je
          bura, vidi se prije nego se dođe do bento kartica.
        */}
        {gustFlag && (
          <View className="mt-2 flex-row items-center gap-1.5">
            {/*
              Heroj ima SVOJ ton (`hero`), svjetliji od kartica: podloga mu
              je obojeni gradijent, ne bijela kartica, pa mu ne treba
              toliko tamnog za odvajanje — s tonom kartice je izgledao
              pretežak (Markov ispravak 6.8.2026.).
            */}
            <WindFlag speedKmh={current.windGusts} size={20} tone={dark ? "dark" : "hero"} />
            <Text className="font-grotesk-bold text-[15px]" style={{ color: heroFg }}>
              {Math.round(convertWind(current.windGusts, windUnit))}
            </Text>
            <Text className="font-grotesk-medium text-[13px]" style={heroFg70}>
              {windUnitLabel(windUnit)} · {t.home.gusts.toLowerCase()}
            </Text>
          </View>
        )}
      </View>

      {/*
        Dno: sati preko PUNE širine (left i right su 0) — s `left: 20`
        traka je imala padding samo slijeva, a zdesna curila izvan ekrana.
        Uvlaku sada radi contentContainer unutar ScrollViewa, pa je
        simetrična i skrol ide od ruba do ruba.
      */}
      <View
        style={{
          position: "absolute",
          bottom: insets.bottom + 10,
          left: 0,
          right: 0,
        }}
      >
        {/*
          Traka dobiva `stripAccent`, NE `heroAccent` (8.8.2026.): stoji
          na svijetlom dnu gradijenta, gdje zlatna s vedrog neba pada na
          1.56:1 i nestane.
        */}
        <HourlyStrip hours={hours} tempUnit={tempUnit} accent={stripAccent()} />
      </View>
    </View>
  );
}
