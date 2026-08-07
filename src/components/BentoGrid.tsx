import { router } from "expo-router";
import { ChevronRight, Waves } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";

import type { CurrentWeather } from "@/api/types";
import { SunCycle } from "@/components/SunCycle";
import { WindFlag } from "@/components/WindFlag";
import { t } from "@/i18n";
import { colors } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import type { TempUnit, WindUnit } from "@/utils/format";
import { convertTemp, convertWind, tempUnitLabel, windDirLabel, windUnitLabel } from "@/utils/format";
import type { PollenLevels, PollenSpecies } from "@/utils/weatherLook";
import { ACCENT_CORAL, ACCENT_STEEL, AQI_COLORS, POLLEN_COLORS, aqiInfo, dewPoint, pollenInfo, uvLabel, visibilityLabel } from "@/utils/weatherLook";

/** Visina polukartice — sve jednake (odluka s mockupa v4; dizano za čitljivost). */
const CARD_H = 160;

/** Boje WHO razreda UV indeksa: nizak → ekstreman, za skalu na kartici. */
const UV_COLORS = ["#7BC96F", "#F5E12E", "#F58A2E", "#E63946", "#9B59B6"] as const;

/** More je jedini "plavi" podatak na ekranu — dobiva vlastitu boju. */
const SEA_BLUE = "#2E9DF7";

/**
 * Marker na skali u bojama (UV, AQI, pelud) — tamna točka s BIJELIM
 * prstenom (dorada 6.8.2026.). Prije je svaka skala imala svoj marker
 * (bijeli krug s ink rubom, tanka crtica) pa je u tamnoj temi ili na
 * niskim vrijednostima znao nestati: ink rub na coal kartici se ne vidi,
 * a crtica na zelenom segmentu jedva. Ova kombinacija se čita svugdje —
 * na svijetloj kartici radi tamna točka, na tamnoj bijeli prsten, a na
 * samoj skali oboje odskače od segmenata u boji.
 */
export function ScaleMarker({ fraction }: { fraction: number }) {
  return (
    <View
      className="absolute rounded-full"
      style={{
        // 2–98 %: na 0/100 % bi pola markera visjelo izvan skale.
        left: `${2 + Math.min(1, Math.max(0, fraction)) * 96}%`,
        top: -4,
        width: 13,
        height: 13,
        marginLeft: -6.5,
        backgroundColor: colors.ink,
        borderWidth: 2.5,
        borderColor: "#FFFFFF",
      }}
    />
  );
}

/**
 * Jedna bento kartica: mali naslov (normalna slova — verzal s razmakom je
 * maknut 6.8.2026. kao generički), sadržaj, caption na dnu. `inverted` je
 * crna kartica (u tamnoj temi bijela) — rezervirana za UV.
 */
function Card({
  label,
  children,
  caption,
  wide = false,
  inverted = false,
  fixedHeight = true,
  onPress,
}: {
  label: string;
  children: ReactNode;
  caption?: string;
  wide?: boolean;
  inverted?: boolean;
  fixedHeight?: boolean;
  /** Kartica koja vodi dalje — dobiva ševron uz naslov da se zna da se ulazi. */
  onPress?: () => void;
}) {
  const { fg } = useThemeColors();
  const body = (
    <>
      {/* Veličine i kontrasti sitnih tekstova dignuti za starije korisnike. */}
      <View className="flex-row items-center justify-between">
        <Text className={`font-grotesk-bold text-[13.5px] ${inverted ? "text-paper/70" : "text-ink/60 dark:text-paper/60"}`}>{label}</Text>
        {onPress && <ChevronRight size={18} strokeWidth={2.5} color={fg} opacity={0.45} />}
      </View>
      <View className="flex-1 justify-center">{children}</View>
      {caption !== undefined && <Text className={`font-grotesk-medium text-[12.5px] ${inverted ? "text-paper/70" : "text-ink/65 dark:text-paper/65"}`}>{caption}</Text>}
    </>
  );

  /*
   * `inverted` SE NE OKREĆE U TAMNOJ TEMI (popravak 8.8.2026.).
   *
   * Bilo je `bg-ink dark:bg-paper`, dakle u tamnoj temi je kartica
   * postajala BIJELA. Izmjereno prema podlozi stranice (#141414): obična
   * kartica drži 1.06:1 (suptilno odvojena, kako i treba), a inverted
   * skače na **17.63:1** — UV i tlak su izgledali kao dvije svjetleće
   * mrlje među tamnim karticama.
   *
   * Sada je istaknutost izvedena kao STUPANJ, ne kao obrat: u svijetloj
   * temi ostaje tamna kartica (ondje je to radilo i lijepo izgledalo), a
   * u tamnoj kartica ostaje tamna, samo za nijansu svjetlija od ostalih
   * (#22252B naspram coala) uz tanki obrub. Razliku dalje nosi akcent
   * unutar kartice, ne sama ploha.
   */
  const invertedBg = inverted ? "bg-ink dark:bg-[#22252B] dark:border dark:border-paper/10" : "bg-white dark:bg-coal";
  const className = `rounded-2xl px-3.5 py-3 ${wide ? "basis-full" : "grow basis-[45%]"} ${invertedBg}`;
  const style = fixedHeight ? { height: CARD_H } : undefined;

  return onPress ? (
    <Pressable className={className} style={style} onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    <View className={className} style={style}>
      {body}
    </View>
  );
}

/** Velika vrijednost u kartici, s opcionalnom malom jedinicom. */
function Value({ children, unit, inverted = false }: { children: string; unit?: string; inverted?: boolean }) {
  /* `inverted` je u OBJE teme tamna kartica sa svijetlim tekstom — vidi Card. */
  const main = inverted ? "text-paper" : "text-ink dark:text-paper";
  return (
    <View className="flex-row items-baseline gap-1">
      <Text className={`font-grotesk-bold ${main}`} style={{ fontSize: 32, letterSpacing: -1 }}>
        {children}
      </Text>
      {unit !== undefined && <Text className={`font-grotesk-medium text-[14px] ${inverted ? "text-paper/70" : "text-ink/65 dark:text-paper/65"}`}>{unit}</Text>}
    </View>
  );
}

/**
 * Kompas (odabir "A" s mockupa, 6.8.2026.): velika strelica PREKO cijelog
 * kruga s repnim krilcima, kratica smjera u sredini, četiri strane
 * svijeta okolo — sve iz rječnika, pa krug prati jezik sučelja.
 *
 * Semantika (okrenuto po Markovoj provjeri na uređaju 6.8.2026.): glava
 * strelice pokazuje NA STRANU ČIJE IME PIŠE u sredini — "JI" i strelica
 * prema jugoistoku. Prvotno je glava pokazivala kamo vjetar teče
 * (meteorološki točnije), ali uz kraticu se to čitalo kao greška:
 * "JI" a strelica na sjeverozapad.
 */
function Compass({ windDir }: { windDir: number }) {
  const { dark } = useThemeColors();
  const faint = dark ? "rgba(250,250,248,.25)" : "rgba(20,20,20,.18)";
  const label = dark ? "rgba(250,250,248,.55)" : "rgba(20,20,20,.55)";
  const center = dark ? colors.coal : "#FFFFFF";

  return (
    <Svg width={128} height={128} viewBox="0 0 104 104">
      <Defs>
        {/*
          Gradijent duž strelice, od repa (žuta) prema glavi (tamnija
          narančasta) — isti jezik kao krivulja zalaska. userSpaceOnUse:
          koordinate su u sustavu rotirane grupe, pa gradijent prati iglu.
        */}
        {/* y2 prati novi vrh (11), inače gradijent ne stigne do glave. */}
        <LinearGradient id="needle" x1="52" y1="86" x2="52" y2="11" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#F5D547" />
          <Stop offset="1" stopColor="#EE6E3C" />
        </LinearGradient>
      </Defs>
      <Circle cx="52" cy="52" r="46" fill="none" stroke={faint} strokeWidth="1.5" />
      {[45, 135, 225, 315].map((a) => (
        <G key={a} rotation={a} origin="52,52">
          <Line x1="52" y1="6" x2="52" y2="11" stroke={faint} strokeWidth="1.5" />
        </G>
      ))}
      {/*
        Strane svijeta se ČITAJU IZ RJEČNIKA (popravak 8.8.2026.).

        Bile su tvrdo upisane kao "S"/"I"/"J"/"Z", pa je krug ostajao
        HRVATSKI i na engleskom — dok je kratica u sredini već bila
        prevedena. Time je engleski korisnik gledao "E" u sredini i "I" na
        rubu, dakle dva zapisa istog smjera.

        Opasnije od nesklada: hrvatsko "S" (sjever) je englesko "S"
        (south) — isto slovo, SUPROTAN smjer. Neprevedeni krug zato nije
        bio samo ružan nego i pogrešan.

        Indeksi su kut/45°: 0 = sjever, 2 = istok, 4 = jug, 6 = zapad.
      */}
      <SvgText x="52" y="21" fontSize="10" fontWeight="700" textAnchor="middle" fill={label}>
        {t.windDirs[0]}
      </SvgText>
      <SvgText x="86" y="55.5" fontSize="10" textAnchor="middle" fill={label}>
        {t.windDirs[2]}
      </SvgText>
      <SvgText x="52" y="90" fontSize="10" textAnchor="middle" fill={label}>
        {t.windDirs[4]}
      </SvgText>
      <SvgText x="18" y="55.5" fontSize="10" textAnchor="middle" fill={label}>
        {t.windDirs[6]}
      </SvgText>
      {/* Glava strelice na strani s koje vjetar puše — uz kraticu. */}
      <G rotation={windDir % 360} origin="52,52">
        {/*
          VRH SEŽE JEDNAKO DALEKO KAO REP (Markov ispravak 8.8.2026.).
          Izmjereno u ovom viewBoxu (centar 52,52, vanjski krug r=46):
          krilca repa sežu do y=93, dakle r=41, a vrh glave je stajao na
          y=15 — samo r=37. Igla je zato izgledala kao da je sprijeda
          podrezana. Vrh je spušten na y=11 (r=41) i trokut je za toliko
          produžen, pa oba kraja staju jednako blizu ruba.
        */}
        <Line x1="52" y1="86" x2="52" y2="22" stroke="url(#needle)" strokeWidth="3.5" strokeLinecap="round" />
        <Path d="M52 11 l-6.5 13 13 0 z" fill="#EE6E3C" />
        <Line x1="52" y1="86" x2="46" y2="93" stroke="#F5D547" strokeWidth="3" strokeLinecap="round" />
        <Line x1="52" y1="86" x2="58" y2="93" stroke="#F5D547" strokeWidth="3" strokeLinecap="round" />
      </G>
      <Circle cx="52" cy="52" r="14" fill={center} stroke={faint} strokeWidth="1.5" />
      <SvgText x="52" y="56" fontSize="11" fontWeight="700" textAnchor="middle" fill={dark ? colors.paper : colors.ink}>
        {windDirLabel(windDir)}
      </SvgText>
    </Svg>
  );
}

/** Raspon tipičnog prizemnog tlaka za skalu mjerača. */
const PRESSURE_MIN = 980;
const PRESSURE_MAX = 1040;
/** Mjerač pokriva 270°; praznina je na dnu (od 135° do 225°). */
const GAUGE_SWEEP = 270;
const GAUGE_TICKS = 40;

/** "1016" -> "1.016" — europski zapis kao na referenci. */
function fmtPressure(hpa: number): string {
  const v = Math.round(hpa);
  return v >= 1000 ? `${Math.floor(v / 1000)}.${String(v % 1000).padStart(3, "0")}` : `${v}`;
}

/**
 * Mjerač tlaka (po referentnoj fotografiji + dorada 6.8.2026.): crni disk
 * BEZ vlastite kartice — stoji sam na podlozi, promjera kao visina
 * kartica, i SVE je u njemu (naslov, crtice, vrijednost). Crtice do
 * trenutne vrijednosti su upaljene narančasto, ostale prigušene; praznina
 * je na dnu.
 */
function PressureGauge({ hpa, size }: { hpa: number; size: number }) {
  const { dark } = useThemeColors();
  const fraction = Math.min(1, Math.max(0, (hpa - PRESSURE_MIN) / (PRESSURE_MAX - PRESSURE_MIN)));
  const lit = Math.round(fraction * GAUGE_TICKS);
  /*
   * DISK OSTAJE TAMAN I U TAMNOJ TEMI (popravak 8.8.2026.).
   *
   * Bio je `dark ? paper : ink`, dakle u tamnoj temi bijeli krug — isti
   * kvar kao kod UV kartice: dvije svjetleće mrlje među tamnim
   * karticama. Sada je disk uvijek taman (u tamnoj temi nijansu
   * svjetliji od podloge, kao i `inverted` kartica), a tekst uvijek
   * svijetao.
   */
  const disc = dark ? "#22252B" : colors.ink;
  const dimTick = "rgba(250,250,248,.32)";
  const text = colors.paper;
  const subtext = "rgba(250,250,248,.55)";

  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <Circle cx="48" cy="48" r="48" fill={disc} />
      {Array.from({ length: GAUGE_TICKS }, (_, i) => {
        // Od -135° (dolje-lijevo) u smjeru kazaljke do +135°.
        const angle = -GAUGE_SWEEP / 2 + (i / (GAUGE_TICKS - 1)) * GAUGE_SWEEP;
        return (
          <G key={i} rotation={angle} origin="48,48">
            {/* Upaljene crtice nose akcent — koraljna je maknuta 8.8.2026. */}
            <Line x1="48" y1="5" x2="48" y2="12" stroke={i < lit ? ACCENT_STEEL : dimTick} strokeWidth="1.8" strokeLinecap="round" />
          </G>
        );
      })}
      <SvgText x="48" y="31" fontSize="8" fontWeight="700" textAnchor="middle" fill={subtext}>
        Tlak
      </SvgText>
      <SvgText x="48" y="54" fontSize="18" fontWeight="700" textAnchor="middle" fill={text}>
        {fmtPressure(hpa)}
      </SvgText>
      <SvgText x="48" y="67" fontSize="8.5" textAnchor="middle" fill={subtext}>
        hPa
      </SvgText>
    </Svg>
  );
}

/**
 * Bento mreža metrika (redizajn 6.8.2026., v7): sve dosadašnje metrike i
 * "Detalji" presloženi u kartice jednakih visina, bez rubova.
 */
export function BentoGrid({
  current,
  gusts,
  uv,
  uvMax,
  visibilityKm,
  precip24,
  aqi,
  pollen,
  seaTemp,
  sunrise,
  sunset,
  tempUnit,
  windUnit,
}: {
  current: CurrentWeather;
  gusts?: number;
  uv?: number;
  uvMax?: number;
  visibilityKm?: number;
  precip24: number;
  aqi?: number;
  /** Pelud (CAMS); kad su sve vrste na nuli, kartica se ne prikazuje. */
  pollen?: PollenLevels;
  /** Samo za obalna mjesta; drugdje Marine API ne vraća ništa. */
  seaTemp?: number;
  sunrise?: string;
  sunset?: string;
  tempUnit: TempUnit;
  windUnit: WindUnit;
}) {
  const { dark } = useThemeColors();
  const deg = (v: number) => `${Math.round(convertTemp(v, tempUnit))}°`;
  const feelsDiff = current.feelsLike - current.temp;
  const feelsCaption = Math.abs(feelsDiff) < 1 ? t.home.feelsSame : feelsDiff > 0 ? t.home.feelsWarmer : t.home.feelsColder;
  const dew = dewPoint(current.temp, current.humidity);
  const air = aqi !== undefined ? aqiInfo(aqi) : undefined;
  const pollenGradeLabels = [t.pollen.none, t.pollen.low, t.pollen.moderate, t.pollen.high, t.pollen.veryHigh] as const;
  const dust = pollen !== undefined ? pollenInfo(pollen) : undefined;
  const speciesLabel = (key: PollenSpecies) => t.pollen.species[key];

  return (
    <View className="flex-row flex-wrap gap-2.5">
      {/*
        Osjet + more u istoj kartici: more je za obalna mjesta bitan
        podatak, a kopnena ga uopće nemaju — tada kartica ostaje samo
        osjet, bez praznog mjesta (odluka 6.8.2026.).
      */}
      <Card label={t.home.feelsLike} caption={seaTemp === undefined ? feelsCaption : undefined}>
        <Value>{deg(current.feelsLike)}</Value>
        {seaTemp !== undefined && (
          <View className="mt-3 flex-row items-center justify-between border-t border-ink/[0.07] pt-2.5 dark:border-paper/10">
            <View className="flex-row items-center gap-1.5">
              <Waves size={19} strokeWidth={2} color={SEA_BLUE} />
              <Text className="font-grotesk-medium text-[15px] text-ink/75 dark:text-paper/75">{t.home.seaTemp}</Text>
            </View>
            <Text className="font-grotesk-bold text-[22px]" style={{ color: SEA_BLUE }}>
              {deg(seaTemp)}
            </Text>
          </View>
        )}
      </Card>

      <Card label={t.metrics.uv} inverted caption={uvMax !== undefined ? `${t.home.uvMaxToday} ${Math.round(uvMax)}` : undefined}>
        <Value inverted unit={uv !== undefined ? uvLabel(uv) : undefined}>
          {uv !== undefined ? `${Math.round(uv)}` : "–"}
        </Value>
        {/* Skala u bojama s markerom (referenca): WHO razredi 0–11+. */}
        {uv !== undefined && (
          <View className="mt-2.5 h-[5px] flex-row rounded-full">
            {UV_COLORS.map((c, i) => (
              <View key={c} className={`flex-1 ${i === 0 ? "rounded-l-full" : ""} ${i === UV_COLORS.length - 1 ? "rounded-r-full" : ""}`} style={{ backgroundColor: c }} />
            ))}
            <ScaleMarker fraction={uv / 12} />
          </View>
        )}
      </Card>

      {sunrise !== undefined && sunset !== undefined && (
        <Card label={t.home.sunCycle}>
          <SunCycle sunrise={sunrise} sunset={sunset} />
        </Card>
      )}

      <Card label={t.metrics.humidity} caption={`${t.home.dewPointNote} ${deg(dew)}`}>
        <Value>{`${Math.round(current.humidity)}%`}</Value>
      </Card>

      {/* Vjetar preko cijele širine: brojke lijevo, kompas desno. */}
      <Card label={t.metrics.wind} wide>
        <View className="flex-row items-center justify-between">
          <View className="gap-2">
            <Value unit={`${windUnitLabel(windUnit)} · ${windDirLabel(current.windDir)}`}>{`${Math.round(convertWind(current.windSpeed, windUnit))}`}</Value>
            {gusts !== undefined && (
              /*
                Vjetrulja stoji UZ UDARE (6.8.2026.), jer se značka po
                njima i ravna — bijela od 10 m/s, crvenih pruga od 17.
                Ispod praga je `WindFlag` prazan, pa red ostaje samo broj.
              */
              <View className="flex-row items-center gap-2">
                <Value unit={`${windUnitLabel(windUnit)} · ${t.home.gusts.toLowerCase()}`}>{`${Math.round(convertWind(gusts, windUnit))}`}</Value>
                {/* Kartica je bijela/coal — ton kartice, ne bijela na bijelom. */}
                <WindFlag speedKmh={gusts} size={20} tone={dark ? "dark" : "card"} />
              </View>
            )}
          </View>
          {/* Negativna margina: kompas koristi punu visinu kartice. */}
          <View style={{ marginVertical: -13 }}>
            <Compass windDir={current.windDir} />
          </View>
        </View>
      </Card>

      {/* Tlak: goli disk bez kartice, promjera kao visina kartica. */}
      <View className="grow basis-[45%] items-center justify-center" style={{ height: CARD_H }}>
        <PressureGauge hpa={current.pressure} size={CARD_H} />
      </View>

      <Card label={t.metrics.visibility} caption={visibilityKm !== undefined ? visibilityLabel(visibilityKm) : undefined}>
        <Value unit="km">{visibilityKm !== undefined ? `${visibilityKm}` : "–"}</Value>
      </Card>

      <Card label={t.metrics.cloudCover} caption={" "}>
        <Value>{`${Math.round(current.cloudCover)}%`}</Value>
      </Card>

      <Card label={t.home.precip24} caption={precip24 >= 0.5 ? t.home.precipSome : t.home.precipNone}>
        <Value unit="mm">{`${precip24}`}</Value>
      </Card>

      {/*
        Pelud (CAMS preko Open-Metea, isti upit kao AQI): ukupna ocjena +
        do 3 najjače vrste s trakicama. Alergičaru je bitno KOJA pelud —
        ambrozija i trave nisu ista stvar. Sve na nuli = kartice nema
        (zimi ekran ne nosi praznu karticu).
      */}
      {dust !== undefined && dust.grade > 0 && (
        <Card
          label={t.pollen.title}
          wide
          fixedHeight={false}
          // Dodir otvara punu listu svih vrsta (dorada 6.8.2026.).
          onPress={() => router.navigate("/pollen")}
        >
          <View className="gap-3 py-1">
            <View className="flex-row items-baseline justify-between">
              <Text className="font-grotesk-bold text-[20px]" style={{ color: dust.color }}>
                {pollenGradeLabels[dust.grade]}
              </Text>
              <Text className="font-grotesk-medium text-[12.5px] text-ink/65 dark:text-paper/65">{speciesLabel(dust.species[0]!.key)}</Text>
            </View>

            {/*
              Svaka vrsta na SVOJOJ skali u bojama s markerom — isti jezik
              kao AQI i UV (dorada 6.8.2026.). Skala pokazuje gdje je vrsta
              u rasponu zeleno→crveno, pa se odmah vidi je li "malo žute"
              ili "duboko u crvenom", što gola trakica nije govorila.
            */}
            {dust.species.slice(0, 3).map((s) => (
              <View key={s.key} className="gap-1.5">
                <View className="flex-row items-baseline justify-between">
                  <Text className="font-grotesk-medium text-[13.5px] text-ink/75 dark:text-paper/75">{speciesLabel(s.key)}</Text>
                  <Text className="font-grotesk-bold text-[12px]" style={{ color: POLLEN_COLORS[s.grade - 1] }}>
                    {pollenGradeLabels[s.grade]}
                  </Text>
                </View>
                <View className="h-[5px] flex-row rounded-full">
                  {POLLEN_COLORS.map((c, i) => (
                    <View key={c} className={`flex-1 ${i === 0 ? "rounded-l-full" : ""} ${i === POLLEN_COLORS.length - 1 ? "rounded-r-full" : ""}`} style={{ backgroundColor: c }} />
                  ))}
                  <ScaleMarker fraction={s.fraction} />
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Kvaliteta zraka: ocjena u boji + skala s markerom (stari AqiRow). */}
      {air !== undefined && aqi !== undefined && (
        <Card label={t.home.airQuality} wide fixedHeight={false}>
          <View className="gap-2.5 py-1">
            <View className="flex-row items-baseline justify-between">
              <Text className="font-grotesk-bold text-[20px]" style={{ color: air.color }}>
                {air.label}
              </Text>
              <Text className="font-grotesk-medium text-[12.5px] text-ink/65 dark:text-paper/65">AQI {Math.round(aqi)}</Text>
            </View>
            <View className="h-[5px] flex-row rounded-full">
              {AQI_COLORS.map((c, i) => (
                <View key={c} className={`flex-1 ${i === 0 ? "rounded-l-full" : ""} ${i === AQI_COLORS.length - 1 ? "rounded-r-full" : ""}`} style={{ backgroundColor: c }} />
              ))}
              <ScaleMarker fraction={air.fraction} />
            </View>
          </View>
        </Card>
      )}
    </View>
  );
}
