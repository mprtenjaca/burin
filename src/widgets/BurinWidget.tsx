import {
  Circle,
  Gauge,
  HStack,
  Image,
  Rectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  aspectRatio,
  blur,
  clipped,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  ignoreSafeArea,
  offset,
  opacity,
  padding,
  resizable,
  rotationEffect,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

import type { AmbientKind } from "./iconNames";
import type { WidgetProps } from "./props";

/**
 * BURIN WIDGET — vrijeme na početnom zaslonu (7.8.2026.).
 *
 * Sve što widget zna dolazi PROPOVIMA (`WidgetProps`), koje aplikacija
 * upiše preko `updateTimeline`. Widget je zaseban proces u drugom
 * kontejneru: ne vidi AsyncStorage, ne može na mrežu i **ne izvršava
 * naš ostali JS**. Zato ovdje NEMA uvoza iz `@/utils` ni `@/store` —
 * sve se izračuna u aplikaciji i pošalje gotovo.
 *
 * SVE JE UNUTAR JEDNE FUNKCIJE (popravak 7.8.2026., nađen na uređaju:
 * "ReferenceError: Can't find variable: Backdrop").
 *
 * Direktiva `'widget'` ne označava samo funkciju — ona njeno TIJELO
 * izdvaja u ZASEBAN PAKET koji se izvršava u WidgetKit procesu, uz
 * vlastite stubove za react i react-native (vidi `expo-widgets/bundle/`).
 * Sve što stoji u dosegu MODULA ostaje u paketu aplikacije i widgetu je
 * nedostupno — pa su pomoćne komponente i konstante morale unutra.
 *
 * Zbog istog razloga se pomoćne komponente zovu kao FUNKCIJE
 * (`Backdrop({...})`), ne kao JSX elementi: stub za jsx-runtime zna
 * složiti stablo od poznatih komponenti `@expo/ui`, ali ne i montirati
 * našu vlastitu funkcijsku komponentu.
 */
function BurinWidgetLayout(props: WidgetProps, environment: WidgetEnvironment) {
  "widget";

  /**
   * Podnožje ("14:20 · 24/11") stoji na 70 % prozirnosti, kao prigušeni
   * tekst u heroju. Isti odnos, ne ista vrijednost — widget je manji, pa
   * bi 75 % ovdje bilo pretiho.
   */
  const MUTED = 0.7;

  /**
   * Gradijent ide kao `Rectangle` s `foregroundStyle`, NE kao
   * `containerBackground` (izmjereno u tipovima 7.8.2026.).
   *
   * `containerBackground`, `background` i `backgroundOverlay` primaju samo
   * `Color` — jednu boju, bez gradijenta. Jedini modifikator koji prima
   * `linearGradient` je `foregroundStyle`, a on boji SADRŽAJ. Zato se
   * podloga crta kao pravokutnik ispod svega u `ZStacku`.
   *
   * Smjer (0,0) → (0.6,1) je isti dijagonalni kao u heroju
   * (`HeroBackdrop`), da widget i ekran izgledaju kao ista aplikacija.
   */
  function Backdrop({ stops }: { stops: [string, string, string] }) {
  return (
    <Rectangle
      modifiers={[
        foregroundStyle({
          type: "linearGradient",
          colors: stops,
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 0.6, y: 1 },
        }),
        /*
         * `ignoreSafeArea` je OBAVEZAN: bez njega iOS ostavi widgetove
         * margine oko pravokutnika, pa se vidi bijeli/crni okvir oko
         * gradijenta umjesto da boja ide do samog ruba pločice.
         */
        ignoreSafeArea(),
      ]}
    />
  );
  }

  /**
   * AMBIJENT — suptilni sloj preko gradijenta (7.8.2026.).
   *
   * Aplikacija ovdje crta prave animirane slojeve (`HeroBackdrop`), ali
   * widget nema ni `Path` ni `Canvas`, pa se koristi ono što postoji:
   * `Rectangle` zarotiran u kosu crtu i `Circle` za točke i mrlje.
   *
   * Pravila su ista kao u aplikaciji:
   *  - kose crte idu pod **29°** (`SLOPE = 0.55` u `backdrop/shared.ts`),
   *    da se poklapaju s kišom i zrakama na ekranu
   *  - sunčane zrake se NE kližu i ovdje su mirne — mirna geometrija je
   *    ono što razlikuje vedro vrijeme od oborine
   *  - sve stoji na vrlo niskoj prozirnosti: ambijent se NE smije natjecati
   *    s temperaturom, koja je jedini razlog zašto widget postoji
   */
  const AMBIENT = 0.1;

  /**
   * GORNJA GRANICA prozirnosti bilo kojeg ambijentalnog elementa.
   *
   * Postoji da se suptilnost ne može slučajno probiti (Markov naglasak
   * 7.8.2026.: "al suptilno sve"). Prva izvedba je zvijezde vodila na 0.8 —
   * to više nije ambijent nego uzorak koji se natječe s temperaturom.
   *
   * Widget je malen i gleda se u prolazu: ambijent smije samo NAGOVIJESTITI
   * vrijeme, a brojka mora ostati jedino što se čita s udaljenosti.
   */
  const AMBIENT_MAX = 0.28;

  /** Prozirnost uz zaštitu od probijanja granice. */
  const dim = (a: number) => Math.min(a, AMBIENT_MAX);

  /** Kut kosih elemenata — isti kao `SLOPE` u ambijentalnim slojevima. */
  const SLOPE_DEG = 29;

  /**
   * Duljina trake koja presijeca CIJELU pločicu, od vrha do dna.
   *
   * Izračunato, ne pogođeno: pri nagibu od 29° treba 158 / cos(29°) =
   * 181 px da se prijeđe visina pločice (obje veličine su visoke 158 pt).
   * 226 je to plus 25 % rezerve, da krajevi ostanu izvan kadra i da se
   * rez ne vidi kao ravna linija.
   */
  const FULL_LEN = 226;

  /**
   * OKVIR AMBIJENTA — pločica, ne sadržaj (popravak 8.8.2026.).
   *
   * Nađeno na uređaju: na VEDROM danu je nestajalo sve osim velike
   * brojke — ni mjesto, ni opis, ni min/max. Kiša i oblačno su bili
   * uredni, pa je izgledalo kao greška u tekstu; nije bila.
   *
   * Uzrok je VISINA: `ZStack` u SwiftUI-u poprimi veličinu svog NAJVEĆEG
   * djeteta. Zrake su duge `FULL_LEN` (226 px) jer moraju prijeći pločicu
   * pod nagibom i završiti izvan kadra — pa je ambijentalni stack ispao
   * 226 px visok u pločici od 158 px, a s njim i korijenski stack.
   * Sadržaj je time bio gurnut izvan vidljivog dijela.
   *
   * Kiša toga nije imala jer su joj crte kratke (do 32 px), a oblaci su
   * krugovi do 64 px — oboje stane, pa se kvar vidio SAMO na suncu.
   *
   * `frame` veže ambijent na veličinu pločice, a `clipped` reže ono što
   * viri. Zrake i dalje idu od ruba do ruba — samo više ne rastežu
   * roditelja. Vrijedi za obje veličine: 4×2 je širi, ali `frame` uzima
   * veću širinu, a višak se odreže isto kao na 2×2.
   */
  const TILE_W = 360;
  const TILE_H = 158;

  /** Jedna kosa crta (kiša, zrake): tanki pravokutnik pod nagibom. */
  function Streak({
  x,
  y,
  len,
  w,
  tint,
  alpha,
  }: {
  x: number;
  y: number;
  len: number;
  w: number;
  tint: string;
  alpha: number;
  }) {
  return (
    <Rectangle
      modifiers={[
        frame({ width: w, height: len }),
        foregroundStyle(tint),
        opacity(dim(alpha)),
        rotationEffect(SLOPE_DEG),
        offset({ x, y }),
      ]}
    />
  );
  }

  /** Jedna točka (zvijezda, pahulja) ili meka mrlja (oblak) uz `soft`. */
  function Dot({
  x,
  y,
  r,
  tint,
  alpha,
  soft = 0,
  }: {
  x: number;
  y: number;
  r: number;
  tint: string;
  alpha: number;
  soft?: number;
  }) {
  const mods = [
    frame({ width: r * 2, height: r * 2 }),
    foregroundStyle(tint),
    opacity(dim(alpha)),
    offset({ x, y }),
  ];
  // `blur` pretvara krug u mekanu mrlju — tako se crtaju oblaci.
  return <Circle modifiers={soft ? [...mods, blur(soft)] : mods} />;
  }

  /**
   * Ambijent po vremenu. Vraća `null` za vremena koja nemaju svoj sloj —
   * bolje čist gradijent nego nasumičan ukras.
   *
   * Položaji su FIKSNI, ne slučajni: widget se crta iznova pri svakom
   * osvježenju, pa bi `Math.random` premještao crte i pri svakom buđenju
   * davao drugu sliku (isti razlog zašto `StarsLayer` koristi `rnd`).
   */
  function Ambient({ kind, tint }: { kind: AmbientKind; tint: string }) {
  if (kind === "none") return null;

  if (kind === "rays") {
    /*
     * SUNCE: snop zraka gurnut U DESNO (Markov ispravak 7.8.2026.).
     *
     * Prije su bile razvučene po sredini i preblage. Sada su svjetlije,
     * pomaknute prema desnom rubu — odakle "pada" svjetlo — i **različitih
     * debljina** (10 → 3 px), pa snop ima dubinu umjesto da izgleda kao
     * ravnomjeran uzorak.
     *
     * Prozirnost je iznad ostalih slojeva jer su zrake SVJETLO: na
     * svijetlom gradijentu se blaga bijela jedva vidi.
     */
    /*
     * Trake idu OD VRHA DO DNA (Markov ispravak 7.8.2026., drugi krug):
     * prije su stale na sredini i izgledale kao odsječeni komadi.
     *
     * `FULL_LEN` (226) je izračunat: pri nagibu od 29° treba
     * 158 / cos(29°) = 181 px da se prijeđe visina pločice, plus rezerva
     * da krajevi ostanu IZVAN kadra i da se rez ne vidi.
     *
     * `y = 0` ih centrira, pa vire jednako gore i dolje.
     */
    /*
     * VEDAR DAN: sve je na DESNOJ strani (Markov ispravak 7.8.2026.).
     *
     * Sjaj IZVIRE IZ DESNOG RUBA — središte mu je izvan pločice (x = 190),
     * pa se u kadru vidi samo njegov lijevi rub. To ga čita kao izvor
     * svjetla koji je iza ruba, a ne kao mrlju nalijepljenu na sredinu.
     *
     * Zrake su lijevo od njega i izlaze iz njega prema dolje. Ono što je
     * bilo na lijevoj strani pločice je maknuto — svjetlo dolazi s jedne
     * strane, pa zrake s druge nemaju izvor.
     */
    return (
      <ZStack modifiers={[frame({ width: TILE_W, height: TILE_H }), clipped()]}>
        {Dot({ x: 190, y: -30, r: 72, tint: "#FFFFFF", alpha: 0.2, soft: 34 })}
        {Dot({ x: 168, y: -24, r: 40, tint: "#FFFFFF", alpha: 0.14, soft: 20 })}
        {Streak({ x: 74, y: 0, len: FULL_LEN, w: 11, tint: tint, alpha: 0.24 })}
        {Streak({ x: 98, y: 0, len: FULL_LEN, w: 6, tint: tint, alpha: 0.19 })}
        {Streak({ x: 118, y: 0, len: FULL_LEN, w: 9, tint: tint, alpha: 0.22 })}
        {Streak({ x: 140, y: 0, len: FULL_LEN, w: 4, tint: tint, alpha: 0.16 })}
        {Streak({ x: 156, y: 0, len: FULL_LEN, w: 3, tint: tint, alpha: 0.14 })}
      </ZStack>
    );
  }

  if (kind === "rain") {
    /*
     * KIŠA: gušći snop, sav NA DESNOJ strani (Markov ispravak 7.8.2026.).
     *
     * Prije je bila razvučena preko cijele širine, pa je izgledala kao
     * ravnomjeran uzorak. Kiša koja pada u jednom pojasu čita se kao
     * naleti vjetra — a to je i istina na buri.
     */
    /*
     * KIŠA: snop na DESNOJ strani (Markov odabir 7.8.2026.) — kiša u
     * jednom pojasu čita se kao nalet vjetra, što na buri i jest istina.
     *
     * Kratke kapi, ne pune trake: kiša se sastoji od kapi, pa duga crta
     * od vrha do dna izgleda kao zraka svjetla, ne kao oborina.
     *
     * Snop seže dovoljno LIJEVO (do x = 8) da mala pločica — koja vidi
     * pojas ±79 px od sredine — uhvati četiri kapi umjesto jedne.
     */
    return (
      <ZStack modifiers={[frame({ width: TILE_W, height: TILE_H }), clipped()]}>
        {Streak({ x: 8, y: -34, len: 30, w: 2.4, tint: tint, alpha: 0.22 })}
        {Streak({ x: 24, y: 6, len: 24, w: 2.2, tint: tint, alpha: 0.18 })}
        {Streak({ x: 40, y: -48, len: 32, w: 2.4, tint: tint, alpha: 0.23 })}
        {Streak({ x: 54, y: -12, len: 26, w: 2.2, tint: tint, alpha: 0.19 })}
        {Streak({ x: 70, y: 26, len: 22, w: 2, tint: tint, alpha: 0.17 })}
        {Streak({ x: 84, y: -38, len: 30, w: 2.4, tint: tint, alpha: 0.23 })}
        {Streak({ x: 100, y: 2, len: 26, w: 2.2, tint: tint, alpha: 0.19 })}
        {Streak({ x: 116, y: -24, len: 28, w: 2.4, tint: tint, alpha: 0.22 })}
        {Streak({ x: 132, y: 22, len: 22, w: 2, tint: tint, alpha: 0.17 })}
        {Streak({ x: 148, y: -44, len: 30, w: 2.2, tint: tint, alpha: 0.21 })}
        {Streak({ x: 164, y: -8, len: 24, w: 2.2, tint: tint, alpha: 0.19 })}
      </ZStack>
    );
  }

  if (kind === "stars") {
    /*
     * VEDRA NOĆ: sitne točke razasute po gornjoj polovici, uz nekoliko
     * krupnijih. Ne trepere — widget se ne animira, a mirno nebo je i
     * inače pravilo (vidi `StarsLayer`).
     *
     * Krupnije i bliže sredini (dorada 7.8.2026.): MALA pločica vidi samo
     * pojas ±79 px od sredine, pa je sve izvan toga na njoj otpadalo —
     * zvjezdano nebo se vidjelo samo na srednjem widgetu.
     */
    return (
      <ZStack modifiers={[frame({ width: TILE_W, height: TILE_H }), clipped()]}>
        {Dot({ x: -58, y: -48, r: 1.9, tint: tint, alpha: 0.28 })}
        {Dot({ x: -34, y: -18, r: 1.3, tint: tint, alpha: 0.18 })}
        {Dot({ x: -8, y: -54, r: 1.7, tint: tint, alpha: 0.25 })}
        {Dot({ x: 16, y: -30, r: 1.2, tint: tint, alpha: 0.16 })}
        {Dot({ x: 44, y: -50, r: 2, tint: tint, alpha: 0.28 })}
        {Dot({ x: 64, y: -22, r: 1.3, tint: tint, alpha: 0.18 })}
        {Dot({ x: -48, y: 12, r: 1.2, tint: tint, alpha: 0.15 })}
        {Dot({ x: 30, y: 8, r: 1.4, tint: tint, alpha: 0.17 })}
        {Dot({ x: 96, y: -44, r: 1.5, tint: tint, alpha: 0.22 })}
        {Dot({ x: 126, y: -16, r: 1.2, tint: tint, alpha: 0.15 })}
      </ZStack>
    );
  }

  if (kind === "snow") {
    /*
     * SNIJEG: pahulje su POVEĆANE i posvijetljene (Markov ispravak
     * 7.8.2026.) — na maloj pločici su prije bile jedva vidljive.
     *
     * Raspoređene su i BLIŽE SREDINI (x od -62 do 72), jer mala pločica
     * vidi samo srednji pojas: sve što je izvan ±79 px na njoj otpada.
     */
    return (
      <ZStack modifiers={[frame({ width: TILE_W, height: TILE_H }), clipped()]}>
        {Dot({ x: -62, y: -42, r: 4, tint: tint, alpha: 0.28, soft: 0.5 })}
        {Dot({ x: -30, y: -2, r: 3.2, tint: tint, alpha: 0.22, soft: 0.5 })}
        {Dot({ x: -4, y: -48, r: 4.4, tint: tint, alpha: 0.28, soft: 0.5 })}
        {Dot({ x: 26, y: 18, r: 3.4, tint: tint, alpha: 0.21, soft: 0.5 })}
        {Dot({ x: 54, y: -30, r: 3.8, tint: tint, alpha: 0.26, soft: 0.5 })}
        {Dot({ x: 20, y: -16, r: 2.6, tint: tint, alpha: 0.19, soft: 0.5 })}
        {Dot({ x: -44, y: 26, r: 2.8, tint: tint, alpha: 0.2, soft: 0.5 })}
        {Dot({ x: 92, y: 2, r: 3.4, tint: tint, alpha: 0.23, soft: 0.5 })}
        {Dot({ x: 124, y: -36, r: 3, tint: tint, alpha: 0.21, soft: 0.5 })}
      </ZStack>
    );
  }

  if (kind === "partly") {
    /*
     * DJELOMIČNO OBLAČNO: jedan IZRAŽENIJI oblak desno (Markov ispravak
     * 7.8.2026. — "malo potamni da dobijemo taj feel i dodaj oblačić").
     *
     * Mrlje su TAMNE, ne svijetle: `#000` na 6–9 % daje dojam sjene
     * oblaka na vedrom nebu. Bijela bi ovdje samo isprala gradijent.
     * Uz njih ide i par blagih zraka lijevo, jer sunce je i dalje glavno.
     */
    /*
     * DJELOMIČNO OBLAČNO: OBLAK, ne sjaj (Markov ispravak 7.8.2026.).
     *
     * Sjaj je maknut jer se pločica s njim čitala kao sunčan dan — a
     * ovdje je poanta da se vidi NAOBLAKA. Sada je desno pravi oblak,
     * složen od tri preklopljene BIJELE mrlje: bijela je jer je oblak
     * osvijetljen odozgo, a tri kruga različitih polumjera daju obris
     * kumulusa (dva vrha i šire podnožje).
     *
     * Ispod njega ide tamna mrlja — sjena koju oblak baca na nebo. Bez
     * nje oblak lebdi kao naljepnica.
     */
    return (
      <ZStack modifiers={[frame({ width: TILE_W, height: TILE_H }), clipped()]}>
        {/* Sjena ispod oblaka — prvo, da bude ispod njega. */}
        {Dot({ x: 104, y: 2, r: 38, tint: "#000000", alpha: 0.1, soft: 20 })}
        {/* Tijelo oblaka: podnožje pa dva vrha. */}
        {Dot({ x: 96, y: -18, r: 30, tint: "#FFFFFF", alpha: 0.17, soft: 12 })}
        {Dot({ x: 128, y: -30, r: 24, tint: "#FFFFFF", alpha: 0.16, soft: 11 })}
        {Dot({ x: 70, y: -28, r: 20, tint: "#FFFFFF", alpha: 0.14, soft: 10 })}
        {/* Drugi, manji i blijeđi oblak gore desno — dubina. */}
        {Dot({ x: 166, y: -52, r: 18, tint: "#FFFFFF", alpha: 0.1, soft: 9 })}
      </ZStack>
    );
  }

  /*
   * OBLACI / MAGLA: široke meke mrlje pri vrhu.
   *
   * I ovdje TAMNE (dorada 7.8.2026.): svijetle su na sivoj paleti samo
   * isprale boju, umjesto da daju dojam naoblake.
   */
  return (
    <ZStack modifiers={[frame({ width: TILE_W, height: TILE_H }), clipped()]}>
      {Dot({ x: -70, y: -40, r: 28, tint: "#000000", alpha: 0.07, soft: 15 })}
      {Dot({ x: -24, y: -52, r: 21, tint: "#000000", alpha: 0.055, soft: 12 })}
      {Dot({ x: 56, y: -38, r: 32, tint: "#000000", alpha: 0.065, soft: 16 })}
      {Dot({ x: 116, y: -48, r: 23, tint: "#000000", alpha: 0.05, soft: 12 })}
    </ZStack>
  );
  }

  /**
   * Ikona vremena. Crta se samo kad putanja postoji — dok se PNG-ovi ne
   * prepišu u dijeljeni folder (prvi kadar nakon instalacije) ostaje prazno,
   * a raspored se ne mijenja jer ikona stoji u svojem stupcu.
   *
   * `uiImage` čita datoteku SINKRONO, ali ikone su ~1.5 kB i widget se crta
   * rijetko, pa je to prihvatljivo.
   */
  function Icon({ path, size, tint }: { path: string; size: number; tint: string }) {
  if (!path) return null;
  /*
   * `resizable` JE OBAVEZAN za slike iz datoteke (nađeno na uređaju
   * 8.8.2026.: ikona je bila golema i odrezana rubom pločice).
   *
   * Prop `size` vrijedi samo za SF Symbole ("fixed size of the system
   * image" u tipovima), a naši PNG-ovi su datoteke — one se crtaju u
   * SVOJOJ punoj veličini dok im se izričito ne kaže da se smiju
   * skalirati. Sam `frame` tu ne pomaže: on odredi PROSTOR, ali sliku
   * koja je veća od njega samo OBREŽE.
   *
   * Redoslijed je važan i prati SwiftUI: prvo `resizable` (smije se
   * skalirati), pa `aspectRatio` (bez izobličenja), pa tek `frame`
   * (na koliko). Obrnuto bi opet dalo obrezanu sliku.
   */
  return (
    <Image
      uiImage={path}
      color={tint}
      modifiers={[
        resizable(),
        aspectRatio({ contentMode: "fit" }),
        frame({ width: size, height: size }),
      ]}
    />
  );
  }

  /**
   * MALI WIDGET (2×2) — mjesto, velika brojka, opis, pa min/max.
   *
   * Vjetar se OVDJE NE PRIKAZUJE ni kad puše: kvadrat od 2×2 nosi četiri
   * reda i peti bi ih sve stisnuo. Udari idu samo na srednji widget, gdje
   * ima mjesta uz brojku.
   */
  function SmallLayout(props: WidgetProps) {
  return (
    <VStack alignment="leading" spacing={0}>
      {/* Mjesto lijevo, ikona vremena desno — kao V&R u malom widgetu. */}
      <HStack spacing={0}>
        <Text
          modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(props.fg)]}
        >
          {props.place}
        </Text>
        <Spacer />
        {Icon({ path: props.icon, size: 20, tint: props.fg })}
      </HStack>

      <Spacer />

      <Text modifiers={[font({ size: 44, weight: "bold" }), foregroundStyle(props.fg)]}>
        {`${props.temp}${props.unit}`}
      </Text>

      <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle(props.fg)]}>
        {props.condition}
      </Text>

      <Spacer />

      <Text
        modifiers={[
          font({ size: 12, weight: "medium" }),
          foregroundStyle(props.fg),
          opacity(MUTED),
        ]}
      >
        {`${props.tMax}${props.unit} / ${props.tMin}${props.unit}`}
      </Text>
    </VStack>
  );
  }

  /**
   * SREDNJI WIDGET (4×2) — isto plus udari vjetra desno.
   *
   * Podjela je lijevo/desno, a ne dva stupca ravnopravno: brojka mora
   * ostati glavna. `Spacer` između njih tjera desni stupac na rub.
   */
  function MediumLayout(props: WidgetProps) {
  return (
    <HStack spacing={0}>
      <VStack alignment="leading" spacing={0}>
        <HStack spacing={6}>
          {Icon({ path: props.icon, size: 18, tint: props.fg })}
          <Text
            modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(props.fg)]}
          >
            {props.place}
          </Text>
        </HStack>

        <Spacer />

        <Text modifiers={[font({ size: 52, weight: "bold" }), foregroundStyle(props.fg)]}>
          {`${props.temp}${props.unit}`}
        </Text>

        <Text
          modifiers={[font({ size: 14, weight: "medium" }), foregroundStyle(props.fg)]}
        >
          {props.condition}
        </Text>
      </VStack>

      <Spacer />

      <VStack alignment="trailing" spacing={0}>
        <Text
          modifiers={[
            font({ size: 13, weight: "medium" }),
            foregroundStyle(props.fg),
            opacity(MUTED),
          ]}
        >
          {`${props.tMax}${props.unit} / ${props.tMin}${props.unit}`}
        </Text>

        <Spacer />

        {/*
          Udari se prikazuju SAMO iznad praga (10 m/s) — značka koja stoji
          uvijek prestane nositi informaciju; isto pravilo kao `WindFlag`
          u aplikaciji.

          Odsutnost nosi `hasGusts`, a NE `gusts === null` (popravak
          8.8.2026.): `null` preko granice procesa puca u nativnoj
          konverziji, pa je cijela crta ostajala neupisana.
        */}
        {props.hasGusts && (
          <HStack spacing={4}>
            {Icon({ path: props.windIcon, size: 16, tint: props.fg })}
            <Text
              modifiers={[font({ size: 15, weight: "bold" }), foregroundStyle(props.fg)]}
            >
              {`${props.gusts} ${props.windUnit}`}
            </Text>
          </HStack>
        )}

        <Text
          modifiers={[
            font({ size: 11, weight: "medium" }),
            foregroundStyle(props.fg),
            opacity(MUTED),
          ]}
        >
          {props.fetchedAt}
        </Text>
      </VStack>
    </HStack>
  );
  }

  /**
   * ZAKLJUČANI ZASLON (`accessoryRectangular`) — JEDNOBOJAN.
   *
   * iOS ovdje crta u `vibrant` načinu: sve se svede na jedan ton, pa
   * gradijent i boje NEMAJU efekta. Zato ovaj raspored ne dobiva podlogu
   * niti `foregroundStyle` — boja bi bila ignorirana, a eksplicitna siva
   * bi se borila sa sustavskim tonom.
   */
  function AccessoryLayout(props: WidgetProps) {
  return (
    <VStack alignment="leading" spacing={1}>
      {/*
        Ikona je PUNA (`iconFill`): `vibrant` način svede sve na jedan ton
        i masku, pa bi obrisna ikona ostala gotovo prazna. Isti razlog
        zašto Apple ondje koristi `*.fill` simbole.
      */}
      <HStack spacing={4}>
        {Icon({ path: props.iconFill, size: 14, tint: "#FFFFFF" })}
        <Text modifiers={[font({ size: 15, weight: "semibold" })]}>
          {`${props.temp}${props.unit}`}
        </Text>
      </HStack>
      <Text modifiers={[font({ size: 13, weight: "medium" })]}>{props.condition}</Text>
      {/*
        H/L kao kod Applea — kraće od "30° / 18°" i odmah se prepozna što
        je što, bez da red naraste.
      */}
      <Text modifiers={[font({ size: 12, weight: "medium" }), opacity(0.75)]}>
        {`H:${props.tMax}${props.unit} L:${props.tMin}${props.unit}`}
      </Text>
    </VStack>
  );
  }

  /**
   * KRUŽNI ZASLON (`accessoryCircular`) — LUK s trenutnom temperaturom na
   * dnevnom rasponu (Markov odabir 7.8.2026., po Appleovom widgetu).
   *
   * `Gauge` u stilu `circular` daje točno taj oblik: vrijednost kao položaj
   * na luku, minimum i maksimum na krajevima. Time jedan mali krug nosi TRI
   * broja — trenutno, min i max — i odmah se vidi gdje je dan.
   *
   * Ovdje također NEMA boje: `vibrant` način svede sve na jedan ton.
   */
  function CircularLayout(props: WidgetProps) {
  return (
    <Gauge
      value={props.temp}
      min={props.gaugeMin}
      max={props.gaugeMax}
      currentValueLabel={
        <Text modifiers={[font({ size: 15, weight: "semibold" })]}>{`${props.temp}`}</Text>
      }
      minimumValueLabel={
        <Text modifiers={[font({ size: 10, weight: "medium" })]}>{`${props.gaugeMin}`}</Text>
      }
      maximumValueLabel={
        <Text modifiers={[font({ size: 10, weight: "medium" })]}>{`${props.tMax}`}</Text>
      }
      modifiers={[gaugeStyle("circular")]}
    />
  );
  }

  // Widget se crta prema `widgetFamily` — iOS istu komponentu zove za
  // svaku veličinu, pa raspored MORA granati sam.
  const family = environment.widgetFamily;

  /*
   * TINTANI WIDGET (iOS 18) — sustav ga radi SAM (7.8.2026.).
   *
   * Ne postoji zasebna "tinted verzija" koju bismo crtali: iOS uzme isti
   * raspored i pretvori ga u jednobojnu masku (`widgetRenderingMode ===
   * "accented"`). Zato treba samo IZOSTAVITI ono što u tom načinu nema
   * smisla — gradijent postaje ravna ploha, pa ambijentalne trake i mrlje
   * ostanu kao nasumične sive crte preko ničega.
   *
   * (To je druga stvar od `icon-tinted.png`, koji je ikona APLIKACIJE na
   * početnom zaslonu i već postoji.)
   */
  const flat =
    environment.widgetRenderingMode === "accented" ||
    environment.widgetRenderingMode === "vibrant";

  /*
   * Zaključani zaslon prvi, jer je jedini bez podloge — `vibrant` način
   * svede sve na jedan ton, pa gradijent tu nema efekta.
   *
   * Kružni dobiva LUK (`Gauge`), a pravokutni i inline tekst.
   * `accessoryInline` nije prijavljen u configu, ali grana ovamo ako se
   * ikad doda — bolje jednobojan tekst nego prazna pločica.
   */
  if (family === "accessoryCircular") {
    return CircularLayout(props);
  }
  if (family.startsWith("accessory")) {
    return AccessoryLayout(props);
  }

  /*
   * `Backdrop` je PRVI u ZStacku, dakle najdublji sloj — gradijent ide
   * pod sadržaj. Pravokutnik se sam rastegne na cijeli ZStack, pa mu ne
   * treba `frame` (SwiftUI oblici popune ponuđeni prostor).
   */
  return (
    <ZStack>
      {!flat && Backdrop({ stops: props.stops })}
      {/*
        Ambijent stoji IZMEĐU gradijenta i sadržaja: iznad boje da se vidi,
        ispod teksta da mu ne smeta. U tintanom načinu izostaje zajedno s
        gradijentom — bez podloge bi to bile nasumične crte preko ničega.

        Trake su UVIJEK BIJELE (`#FFFFFF`), ne u boji teksta (Markov
        ispravak 7.8.2026.): na suncu je tekst taman, pa su i trake
        ispadale sive i izgledale kao prljavština umjesto kao svjetlo.
      */}
      {!flat && Ambient({ kind: props.ambient as AmbientKind, tint: "#FFFFFF" })}
      <VStack modifiers={[padding({ all: 14 })]}>
        {family === "systemSmall" ? SmallLayout(props) : MediumLayout(props)}
      </VStack>
    </ZStack>
  );
  }

  /**
   * Ime "BurinWeather" MORA biti identično `name` u `app.config.ts` —
   * po njemu iOS spaja nativni target s ovim rasporedom.
 */
export const BurinWidget = createWidget<WidgetProps>("BurinWeather", BurinWidgetLayout);
