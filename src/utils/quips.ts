import type { WeatherBundle } from "@/api/types";
import { currentLanguage } from "@/i18n";
import { WIND_FLAG_KMH, WIND_STORM_KMH } from "@/utils/weatherLook";

/**
 * Domaća rečenica o današnjem vremenu — ono ča bi susjed reka priko
 * ograde, a ne ono ča piše na termometru.
 *
 * Ovo je JEDINI izvor te rečenice. Prije je bio AI sažetak priko
 * vlastitog Cloudflare Workera (Gemini) — zamijenjen 10.8.2026., pa
 * obrisan s Workerom i svim tragovima 1.9.2026.
 *
 * Zašto lokalna tablica umjesto modela: rečenica je uvijek tu (nema
 * mreže, nema kvote, nema čekanja od dvije sekunde, nema ključa ni
 * troška), a domaći ton je ionako bio nemoguć zadatak za model koji ga
 * mora pogoditi na dva jezika. Ovdje je svaka rečenica napisana rukom.
 *
 * Hrvatski je DALMATINSKI, ne književni (Markov odabir 10.8.2026.):
 * `ča`/`šta`, ikavica (`lipo`, `vrime`, `bili`), infinitiv bez krajnjeg
 * `i` (`gledat`, `izać`), `moreš`, `nima`, `vaja`. Ostatak aplikacije je
 * književni — ovo je JEDINO mjesto gdje aplikacija govori, a ne
 * izvještava, pa smije zvučat ko čovik.
 *
 * PRAVILO ZA BUDUĆE UREĐIVANJE: ton je namjerno grub (Markov odabir
 * 10.8.2026.). Ako aplikacija ikad ide u javni App Store, ovo je jedina
 * datoteka koju triba ublažit — Appleova smjernica 1.1.1 pokriva
 * psovke. TestFlight (internal) prolazi bez problema.
 */

/**
 * Kategorija dana. Poredak U OVOJ LISTI JE POREDAK PRIORITETA — prvi
 * pogodak pobjeđuje, pa ekstremi idu prije običnog opisa neba.
 *
 * Zašto ne samo WMO kod: 34 °C i 12 °C uz vedro nebo dijele kod 0, a to
 * su dva posve različita dana. Kod opisuje NEBO, a rečenica mora opisat
 * DAN — pa vrućina, hladnoća i vjetar pobjeđuju nad kodom.
 */
export type QuipKey =
  | "scorching"
  | "hot"
  | "freezing"
  | "cold"
  | "bura"
  | "windy"
  | "thunder"
  | "hail"
  | "snowHeavy"
  | "snow"
  | "rainHeavy"
  | "rain"
  | "drizzle"
  | "fog"
  | "overcast"
  | "cloudy"
  | "clearNight"
  | "nice"
  | "clear";

/**
 * Pragovi temperature. Jedinice su ONE IZ BUNDLEA (°C), ne korisnikove —
 * tekst se bira po STVARNOM vremenu, a ne po tome je li netko prebacio
 * na Fahrenheit. Isto pravilo kao značka bure.
 */
/*
 * 35 °C je granica za najjače rečenice (Markov odabir 10.8.2026.).
 * Ispod toga je "vruće ko u vraga", iznad ide puni repertoar — na 34 °C
 * bi "jebački vruće" bilo pretjerivanje, a na 36 nije.
 */
const T_SCORCHING = 35;
const T_HOT = 28;
const T_FREEZING = -3;
const T_COLD = 3;

/**
 * Vjetar se mjeri PO UDARIMA, isto kao značka bure — bura se pamti po
 * udarima, ne po stalnom vjetru (Polača: 4.2 stalno uz 9.1 u udarima).
 *
 * Pragovi se UVOZE iz `weatherLook`, ne prepisuju: `WIND_STORM_KMH`
 * (61.2 km/h = 17 m/s = 8 Bf) je isti broj na kojem značka postaje
 * olujna. Da su ovdje prepisani, jedan bi se dan pomaknuo bez drugog i
 * rečenica bi govorila "bura" dok značka šuti. Polje je u KM/H.
 */
const GUST_BURA_KMH = WIND_STORM_KMH;
const GUST_WINDY_KMH = WIND_FLAG_KMH;

/** Zbroj oborina u 24 h iznad kojeg je "jaka kiša", u mm. */
const PRECIP_HEAVY = 12;

/**
 * Ulaz za odabir rečenice. Plosnat i unaprijed izračunat — isto pravilo
 * kao `widgetData.ts`: ono ča bira tekst ne smije morat kopat po
 * bundleu, da se logika ne raziđe na dva mjesta.
 */
export type QuipInput = {
  code: number;
  isDay: boolean;
  temp: number;
  /** Udari vjetra u KM/H — isto kao `current.windGusts` u bundleu. */
  gustsKmh: number;
  precip24: number;
};

/**
 * Dan → kategorija. Prvi pogodak pobjeđuje.
 *
 * Redoslijed je NAMJERAN i nije proizvoljan:
 *
 * 1. Grmljavina i tuča idu PRVE — to je jedino vrijeme koje je opasno
 *    samo po sebi, pa nadglasava i vrućinu ("pakleno vruće" na 34 °C uz
 *    nevrijeme bi bilo smiješno).
 * 2. Vrućina i hladnoća prije neba — vedar dan na 34 °C nije "vedro",
 *    nego pakao; vedar dan na −5 °C nije "vedro", nego zima.
 * 3. Bura prije kiše — na 20 m/s nikoga ne zanima je li mokro.
 * 4. Tek onda obično nebo.
 */
export function quipKey(input: QuipInput): QuipKey {
  const { code, isDay, temp, gustsKmh, precip24 } = input;

  // 1. Opasno vrijeme — nadglasava sve ostalo.
  if (code === 96 || code === 99) return "hail";
  if (code === 95) return "thunder";

  // 2. Ekstremi temperature — prije opisa neba.
  if (temp >= T_SCORCHING) return "scorching";
  if (temp <= T_FREEZING) return "freezing";

  // 3. Bura — na osam bofora je vjetar cijela priča.
  if (gustsKmh >= GUST_BURA_KMH) return "bura";

  // 4. Snijeg prije kiše (kod ga razlikuje pouzdanije od količine).
  if (code === 75 || code === 86) return "snowHeavy";
  if (code === 71 || code === 73 || code === 77 || code === 85) return "snow";

  // 5. Kiša — jačina po KODU ili po zbroju u 24 h, ča god je gore.
  if (code === 65 || code === 82 || precip24 >= PRECIP_HEAVY) return "rainHeavy";
  if (code === 61 || code === 63 || code === 80 || code === 81 || code === 66 || code === 67) return "rain";
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return "drizzle";

  // 6. Blaži ekstremi tek sad — jaka kiša na 30 °C je ipak kiša.
  if (temp >= T_HOT) return "hot";
  if (temp <= T_COLD) return "cold";
  if (gustsKmh >= GUST_WINDY_KMH) return "windy";

  // 7. Obično nebo.
  if (code === 45 || code === 48) return "fog";
  // 3.5 („pretezno oblacno", mjereno) ide u istu recenicu kao oblacno.
  if (code >= 3 && code < 4) return "overcast";
  if (code === 2) return "cloudy";
  if (code === 0 || code === 1) {
    if (!isDay) return "clearNight";
    // Vedro I ugodno (između pragova) dobiva vlastitu, toplu rečenicu.
    return temp >= 18 && temp < T_HOT ? "nice" : "clear";
  }

  return "clear";
}

/**
 * Rečenice. VIŠE po kategoriji da se ne ponavljaju svaki dan — jedna
 * rečenica po vremenu bi nakon tjedan dana postala dio pozadine.
 *
 * Engleski NIJE prijevod, nego parnjak. Doslovan prijevod domaće psovke
 * na engleskom zvuči jače nego ča na hrvatskom zvuči (a i besmisleno —
 * "bura" nema englesku riječ), pa svaka kategorija ima vlastite
 * engleske rečenice u istom duhu.
 */
const QUIPS: Record<QuipKey, { hr: string[]; en: string[] }> = {
  scorching: {
    hr: [
      "Jebački vruće. Ni pas ne izlazi — hlad, gajba i ništa pametno do mraka.",
      "Jebeno vruće, pizda materina. Ko izađe u dva popodne, sam je kriv.",
      "Danas se kuva ko u paklu. Asfalt se topi, a klima radi za dvoje.",
      "Gori sve živo. Ovo ti je dan za more ili za mrak u sobi, trećega nema.",
      "Vrućina da ti mozak prokuva. Pij vodu ko deva i ne pametuj po suncu.",
      "Sunce te jebalo. Nemoj ništa obećavat prije šest navečer.",
      "Vruće ko u guzici. Ni šugaman ti danas neće pomoć.",
      "Peče ko da te neko drži nad gradelama. Sakri se dok ne popusti.",
      "Jebalo te sunce, ovo nije normalno. Klima, mrak, i ne izlazi.",
      "Vrućina da popizdiš. Ko danas radi vani, svetac je.",
      "Kuva se sve živo, pas mater. Do pet popodne ništa se ne događa.",
      "Ubija vrućina. Voda, hlad, i nikakve pametne ideje.",
      "Đava odnija ovo sunce. Ni u kamenu se nema di sakrit.",
      "Sunce te jebalo, ni vitra nima. Čekaj da padne, prije ništa.",
      "Jebo te al gori. Ko nema mora, nek ne izlazi.",
      "Sunce ti jebem, gori kamen. Ne diraj ništa vani do večeri.",
      "Jebo te žar. Danas se radi ujutro ili se ne radi.",
      "Sunce te spržilo. Ni ćakula se danas ne da na suncu.",
      "Jebem ti ovakav dan. Voda, hlad, i nemoj se nervirat.",
      "Pali ko furuna. Ko sad kreće na put, nek ponese pola gajbe vode.",
    ],
    en: [
      "Fucking roasting. Even the dog's staying in — shade, cold beer, nothing clever till dark.",
      "Bloody scorcher. Anyone out at two in the afternoon brought it on themselves.",
      "Cooking like hell out there. The tarmac's melting and the aircon's doing overtime.",
      "Absolute furnace. It's the sea or a dark room, no third option.",
      "Hot enough to boil your brain. Drink like a camel and don't be a hero in the sun.",
      "Everything's cooking. Don't promise anyone anything before six in the evening.",
      "Like being held over a grill. Hide until it lets up.",
      "Christ, this isn't normal. Aircon, dark room, and stay put.",
      "Hot enough to lose your mind. Anyone working outside today is a saint.",
      "The whole place is boiling, damn it. Nothing happens before five in the afternoon.",
      "This heat is murder. Water, shade, and no clever ideas.",
      "Sod this sun. There's not a scrap of shade anywhere.",
      "Damn this sun, and not a breath of wind. Wait till it drops, nothing before that.",
      "Sod this inferno. No sea, no going out.",
      "Bloody hell, even the stone's burning. Touch nothing outside till evening.",
      "Damn this heat. Work happens in the morning or it doesn't happen.",
      "This sun will fry you. Too hot even to stand about and chat.",
      "Sod a day like this. Water, shade, and don't wind yourself up.",
      "Burning like a furnace. Setting off anywhere? Take half a crate of water.",
    ],
  },

  hot: {
    hr: [
      "Vruće ko u vraga, al se more izdržat. Hlad oko podneva i sve pet.",
      "Ljeto radi svoje. Pivo ladno, majica kratka, i jebeš ostalo.",
      "Toplo da se znojiš i dok stojiš, jebiga. Nemoj nikud žurit.",
      "Pripeklo je pošteno. Šugaman, more, i niko te ne triba do večeri.",
      "Znojiš se ko konj. Ništa ozbiljno prije mraka.",
      "Vruće, ma ne još za paniku. Klima na 24 i savjest čista.",
      "Peče, al se da đir napravit. Samo ne u podne — nisi gušter.",
      "Toplo ko kraj peći u pizzeriji. Naruči nešto ladno i ne miči se.",
      "Sunce grije ko da mu plaćaš po satu. Kapa na glavu i ajde.",
      "Dan za gaće i japanke. Sve više od toga je pretjerivanje.",
      "Znoj ide, al još ne curi. More danas rješava sve.",
      "Nije još jebački vruće, al se bliži. Pij vodu unaprijed.",
      "Vruće taman da svugdi prvo pitaš imaju li klimu.",
      "Ljeto gura svoje, jebiga. Ko radi popodne, sam si je kriv.",
      "Vruće taman da stranu ulice biraš po hladu, ne po smjeru.",
      "Vruće taman da volan ne moreš primit prvih pet minuta.",
      "Vruće da sladoled jedeš brže nego što se topi. Jedva.",
      "Vruće taman da klupa na suncu zja prazna, a za onu u hladu se čeka red.",
      "Vruće dost da „idemo na kavu” znači „unutra, di je klima”.",
      "Pas se šeta u šest ujutro il nikako. On je to prvi skužija.",
      "Vruće da ti se mobitel počne žalit na sunce prije tebe.",
      "Ovo je tek zagrijavanje. Pravi pakao još vježba.",
    ],
    en: [
      "Hot as hell, but survivable. Grab some shade around noon and you're fine.",
      "Summer doing exactly what it says. Cold beer, short sleeves.",
      "Warm enough to sweat standing still. Take it slow.",
      "Properly baking. Towel, sea, and nobody needs you till evening.",
      "Hot, but not panic hot. Aircon at 24 and a clear conscience.",
      "Baking, but a stroll's still doable. Just not at noon — you're not a lizard.",
      "Warm as the doorway of a pizza oven. Order something cold and stay put.",
      "Sun's working like it's paid by the hour. Hat on and off you go.",
      "Shorts and flip-flops weather. Anything more is showing off.",
      "Sweating, but not dripping yet. The sea solves everything today.",
      "Not properly roasting yet, but it's coming. Drink water in advance.",
      "Hot enough that you check every café for aircon before sitting down.",
      "Summer's pushing it, damn it. Anyone working this afternoon volunteered.",
      "Hot enough to pick your side of the street by the shade, not the direction.",
      "Hot enough that the steering wheel needs a five-minute cooldown first.",
      "Warm enough to eat ice cream faster than it melts. Barely.",
      "Hot enough that the sunny bench sits empty and the shady one has a queue.",
      "Hot enough that “let's grab a coffee” means “inside, next to the aircon”.",
      "The dog walks at six in the morning or not at all. He figured it out first.",
      "Hot enough that your phone complains about the sun before you do.",
      "This is just the warm-up. The real hell is still in rehearsal.",
    ],
  },

  freezing: {
    hr: [
      "Ledeno ko u grobu. Sve što je mokro je sad klizavo — gledaj kud staješ.",
      "Zima da ti jaja otpadnu. Obuci se ko kapula i nemoj se pravit junak.",
      "Smrzava se sve živo, pas mater. Auto se neće sam odledit, ustani prije.",
      "Jebena zima. Ko danas izađe u tenisicama, zaslužio je.",
      "Pizda materina, ledi se sve. Ruke u džepe i hodaj ko starac.",
      "Smrzavica da te jebe. Ako ne moraš van, nemoj ni pomišljat.",
    ],
    en: [
      "Cold as the grave. Anything wet is ice now — watch your step.",
      "Cold enough to snap your ears off. Layer up and stop pretending you're tough.",
      "Everything's freezing solid. The car won't defrost itself — set the alarm earlier.",
    ],
  },

  cold: {
    hr: [
      "Zima ko u vraga. Jakna ti nije prijedlog nego uvjet.",
      "Ladno da ti se jebe izać. Šal i kapa, nemoj filozofirat.",
      "Prohladno i gadno. Čaj, deka, i neka svit čeka.",
      "Sere ladnoća. Obuci se ozbiljno ili ostani doma.",
    ],
    en: [
      "Bitterly cold. The coat isn't a suggestion, it's a requirement.",
      "Cold enough to kill the plans. Scarf and hat, don't be a hero.",
      "Chilly and mean out there. Tea, blanket, let the world wait.",
    ],
  },

  bura: {
    hr: [
      "Bura briše sve prid sobon. Ne diraj ceradu i drž se ceste.",
      "Puše ko sudnji dan. Kante lete, kamioni stoje — ostani doma ako moreš.",
      "Bura je pizdila. Sve što nije zavezano danas putuje bez tebe.",
      "Nosi sve što nije pribijeno, jebem ti vitar. Ne otvaraj škure na tu stranu.",
      "Puše pošteno. Frizura ti danas nije briga.",
    ],
    en: [
      "The bura's tearing through. Leave the tarp alone and stay off the exposed roads.",
      "Blowing like judgement day. Bins airborne, lorries grounded — stay put if you can.",
      "The bura has properly lost it. Anything not tied down is travelling without you.",
      "It'll take whatever isn't nailed down. Don't open the shutters on that side.",
    ],
  },

  windy: {
    hr: [
      "Puše pošteno. Frizura ti danas nije briga.",
      "Vitar radi svoje. Drž šešir i gledaj ča si osušio na balkonu.",
      "Vjetrovito i živo. Nije strašno, ma ga osjetiš.",
      "Puše da ti se jebe stat vani. Ponesi nešto priko sebe.",
    ],
    en: ["Blowing a fair bit. Your hair is not today's problem.", "The wind's got opinions. Hold your hat and watch the washing line.", "Breezy and lively. Nothing dramatic, but you'll feel it."],
  },

  thunder: {
    hr: [
      "Grmi ko da se nebo raspada, jebote. Skloni se i ugasi što moreš.",
      "Nevrime na vratima. Ovo ti nije dan ni za brdo ni za more.",
      "Tuče i grmi ko lud. Ostani pod krovon dok ne prođe.",
      "Nebo je popizdilo. Ko sad izađe na more, nek se pozdravi s obitelji.",
    ],
    en: [
      "Thunder like the sky's coming apart. Get inside and unplug what you can.",
      "Proper storm rolling in. Not a day for the hills or the water.",
      "Cracking and rumbling out there. Stay under a roof till it passes.",
    ],
  },

  hail: {
    hr: [
      "Tuča, pas mater. Makni auto pod krov ako ikako moreš — ovo lupa po limu.",
      "Pada led s neba. Ništa vani danas ne vridi koliko šteta.",
      "Jebena tuča. Sve što je vani i ima lim, danas je najebalo.",
      "Led pada ko kamenje. Ostani unutra i moli se za auto.",
    ],
    en: [
      "Hail. Get the car under cover if you possibly can — this dents metal.",
      "Ice falling out of the sky. Nothing outside is worth the damage today.",
      "Hail coming down like rocks. Stay in and pray for the car.",
      "Bloody hail. Anything outside with metal on it is getting battered.",
    ],
  },

  snowHeavy: {
    hr: [
      "Zavijava ko u filmu. Lopata, lanci, i nemoj ništa planirat na vrime.",
      "Snig pada ozbiljno, jebiga. Ceste su lutrija — kreni prije ili nikako.",
      "Zatrpava sve živo. Ko danas računa na red vožnje, nek se strpi.",
      "Pizda materina, ne staje. Lopata je danas glavni alat.",
    ],
    en: [
      "Snowing like a film set. Shovel, chains, and forget being on time.",
      "Serious snowfall. The roads are a lottery — leave early or don't leave.",
      "It's not letting up, damn it. The shovel is today's main tool.",
      "Piling up fast. Anyone counting on a timetable today can forget it.",
    ],
  },

  snow: {
    hr: [
      "Sniži. Lipo za gledat kroz prozor, jebeno za volanon.",
      "Pada snig. Dica sritna, šoferi psuju.",
      "Snig, jebiga. Lipo dok ne sideš za volan.",
      "Bilo je sve. Obuci nešto što ne pušta vodu i uživaj dok traje.",
    ],
    en: [
      "It's snowing. Lovely through a window, nasty behind a wheel.",
      "Snow coming down. The kids are delighted, the drivers are not.",
      "Everything's white. Put on something waterproof and enjoy it while it lasts.",
    ],
  },

  rainHeavy: {
    hr: [
      "Lije ko iz kabla. Kišobran ti je danas ukras — trebaju ti čizme.",
      "Pljušti ko lud. Sve što izneseš vraćaš mokro, jebiga.",
      "Kiša ozbiljna. Podvožnjaci pod vodon, nemoj letit kroz lokve.",
      "Pizda materina, potopit će sve. Ostavi auto gdi ne stoji voda.",
    ],
    en: [
      "Bucketing down. The umbrella's decoration today — you need boots.",
      "Absolutely tipping it. Whatever you take out comes back soaked.",
      "Serious rain. Underpasses flooding — don't gun it through the puddles.",
    ],
  },

  rain: {
    hr: [
      "Kiši. Uzmi kišobran i nemoj se pravit da neće tribat.",
      "Mokro je i ostaje mokro. Nije smak svita, ma ponesi jaknu.",
      "Pada, jebiga. Dan za kavu pod tendon.",
      "Kiša, pas mater. Ko izađe bez ničega, doma se vraća ocijeđen.",
      "Sipi cili dan. Jebeš planove vani.",
    ],
    en: [
      "It's raining. Take the umbrella and stop pretending you won't need it.",
      "Wet now, wet later. Not the end of the world, but bring a coat.",
      "Rain about. A day for coffee under an awning.",
      "Raining, damn it. Go out with nothing and you come back wrung out.",
      "Drizzling all day. So much for any outdoor plans.",
    ],
  },

  drizzle: {
    hr: [
      "Rosi ono jebeno dosadno. Nije kiša da otvoriš kišobran, a pokisneš svejedno.",
      "Sipi. Ona vrsta mokrog ča te uvati neprimjetno.",
      "Ni kiša ni ništa, a mokar si. Najgora sorta.",
      "Jebena sitna kiša. Ni ovako ni onako, a smoči te.",
    ],
    en: [
      "That annoying drizzle. Not enough for an umbrella, and you still get soaked.",
      "Spitting out there. The kind of wet that creeps up on you.",
      "Bloody spitting rain. Neither one thing nor the other, and it still soaks you.",
    ],
  },

  fog: {
    hr: [
      "Magla ko mliko. Kratka svitla i nogu s gasa.",
      "Ne vidiš kurca prid sobon. Vozi ko da ti neko stoji iza zavoja — jer možda i stoji.",
      "Magla, jebiga. Ako ti se ne mora ić, nemoj ić.",
      "Magla ko u vragu. Vozi polako i ne pretiči nikoga.",
    ],
    en: [
      "Fog like milk. Dipped headlights and ease off the throttle.",
      "Can't see your hand in front of your face. Drive like something's round the bend — because it might be.",
      "Fog like hell out there. Drive slow and overtake nobody.",
    ],
  },

  overcast: {
    hr: [
      "Sivo ko ponediljak. Suvo je barem, i to je nešto.",
      "Oblačno i mrtvo. Nebo se danas nije jebeno potrudilo.",
      "Tmurno, ma bez kiše. Prolazna ocjena.",
      "Sivo ko duša. Nit pada nit ne pada, nit vridi nit ne vridi.",
      "Sivo da ti se jebe. Nebo danas nije ni pokušalo.",
    ],
    en: [
      "Grey as a Monday. At least it's dry, and that counts for something.",
      "Overcast and lifeless. The sky didn't bother today.",
      "Gloomy but dry. A pass mark, barely.",
      "Grey enough to sap your will. The sky didn't even try today.",
    ],
  },

  cloudy: {
    hr: [
      "Sunce se probija izmed oblaka. Solidan dan bez pretjerivanja.",
      "Malo sunca, malo oblaka. Nikomu ne smeta.",
      "Ni tamo ni vamo, ma se da živit.",
      "Malo sunca, malo oblaka. Nit dobro nit loše, jebiga.",
    ],
    en: ["Sun poking through the clouds. A decent day, nothing flashy.", "Bit of sun, bit of cloud. Nobody's complaining.", "Bit of sun, bit of cloud. Neither good nor bad, whatever."],
  },

  clearNight: {
    hr: [
      "Vedra noć. Zvizde se vide, a zrak je čist.",
      "Noć bez oblaka. Idealno za gledat u nebo, ako te mrak ne smeta.",
      "Mirna noć, nebo čisto. Nema se šta zamirit.",
      "Vedro i tiho. Jebeno lipa noć za vanka.",
    ],
    en: [
      "Clear night. Stars out, air sharp.",
      "Not a cloud up there. Perfect for looking up, if the dark doesn't bother you.",
      "Calm night, clear sky. Nothing to complain about.",
      "Clear and quiet. Bloody lovely night to be out.",
    ],
  },

  nice: {
    hr: [
      "Dan ko iz reklame. Grihota ga potrošit unutra.",
      "Savršeno. Ni vruće ni ladno — takvih dana nima puno, iskoristi ga.",
      "Vedro i taman kako triba. Izađi van dok traje.",
      "Dan za pet. Grihota bi bilo ostat doma.",
    ],
    en: [
      "A day straight off a postcard. Criminal to spend it indoors.",
      "Spot on. Not hot, not cold — you don't get many like this, use it.",
      "Clear and exactly right. Get outside while it lasts.",
      "A cracking day. Be a crime to stay indoors.",
    ],
  },

  clear: {
    hr: ["Vedro je. Nebo čisto, dan uredan.", "Sunce gori, oblaka nigdi. Bez drame.", "Vedro ko oko. Nema se šta reć."],
    en: ["Clear skies. Nothing in the way, nothing to report.", "Sun's out, not a cloud in sight. No drama.", "Clear as anything. Nothing to say about it."],
  },
};

/**
 * Odabir rečenice unutar kategorije — po DANU, ne nasumično.
 *
 * `Math.random()` bi mijenja rečenicu na svaki render (skrol, promjena
 * teme, povratak u aplikaciju), pa bi tekst treperio prid očima. Ovako
 * je rečenica ista cili dan na istom mjestu, a sutra je druga.
 *
 * Mjesto ulazi u sjeme da dva grada s istim vremenom ne dobiju istu
 * rečenicu istog dana — inače popis gradova izgleda ko ispis greške.
 */
function pick(list: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return list[Math.abs(hash) % list.length]!;
}

/**
 * Sjeme: dan + SAT + mjesto + kategorija.
 *
 * Sat je unutra da se rečenica MIJENJA kroz dan (Markov odabir
 * 10.8.2026.) — inače bi ista rečenica stajala od jutra do mraka i
 * cijeli popis bi se vidio tek kroz tjedan dana.
 *
 * Zašto sat, a ne `Math.random()`: nasumično bi se mijenjalo na SVAKI
 * render — skrol, promjena teme, povratak u aplikaciju — pa bi tekst
 * treperio prid očima i ne bi se stigao pročitat. Ovako je unutar sata
 * stabilan, a kroz dan se vrti.
 */
function seedFor(bundle: WeatherBundle, key: QuipKey): string {
  const at = new Date(bundle.fetchedAt);
  const day = at.toISOString().slice(0, 10);
  const hour = at.getHours();
  return `${day}|${hour}|${bundle.place.id}|${key}`;
}

/** Zbroj oborina u sljedeća 24 h — isti izračun kao na početnoj. */
export function precipNext24(bundle: WeatherBundle): number {
  return Math.round(bundle.hourly.reduce((sum, h) => sum + h.precip, 0) * 10) / 10;
}

/**
 * Gotova rečenica za bundle. Jedini ulaz koji komponenta triba.
 *
 * Nikad ne baca i nikad ne vraća prazno — zato `QuipLine` nema ni stanje
 * učitavanja ni stanje greške: nema se šta čekat ni ča pokvarit.
 */
export function quipFor(bundle: WeatherBundle): string {
  const lang = currentLanguage();
  const key = quipKey({
    code: bundle.current.code,
    isDay: bundle.current.isDay,
    temp: bundle.current.temp,
    gustsKmh: bundle.current.windGusts,
    precip24: precipNext24(bundle),
  });
  return pick(QUIPS[key][lang], seedFor(bundle, key));
}
