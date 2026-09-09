import { WEBCAM_RANGE_KM, parseWebcams, pickWebcams } from "../windyWebcams";
import type { Webcam } from "../windyWebcams";

/**
 * Oblik odgovora Windy Webcams v3 (`include=images,location,urls`).
 *
 * NAPOMENA o izvoru: ovo je oblik iz dokumentacije, ne isječak PRAVOG
 * odgovora — API vraća 403 bez ključa, pa se pravi odgovor nije mogao
 * uzeti. Kad ključ postoji, ovaj fixture treba zamijeniti stvarnim
 * odgovorom (kao `__fixtures__/stampar-zagreb.html`), jer tek tada test
 * čuva parser od promjene na tuđoj strani.
 *
 * Zato je parser namjerno OBRAMBEN i traži sliku na više mjesta — testovi
 * ispod pokrivaju obje varijante.
 */
const RESPONSE = {
  total: 3,
  webcams: [
    {
      webcamId: 1651177539,
      title: "Tkon: Live cam - ferry",
      location: { latitude: 43.9078, longitude: 15.2158, city: "Tkon" },
      images: { current: { preview: "https://img/tkon-preview.jpg?t=abc" } },
      urls: { detail: "https://www.windy.com/webcams/1651177539" },
      lastUpdatedOn: "2026-09-09T12:54:43.000Z",
    },
    {
      // Bliža kamera, ali NAVEDENA DRUGA — mora ispasti prva po udaljenosti.
      webcamId: 42,
      title: "Cam 3",
      location: { latitude: 44.12, longitude: 15.24, city: "Zadar" },
      // Druga varijanta smještaja slike (`sizes` umjesto `current`).
      images: {
        sizes: {
          preview: { url: "https://img/zd-preview.jpg?t=def" },
          full: { url: "https://img/zd-full.jpg?t=def" },
        },
      },
      urls: { detail: "https://www.windy.com/webcams/42" },
      lastUpdatedOn: "2026-09-09T13:00:00.000Z",
    },
    {
      // Bez koordinata — mora se ODBACITI (vidi test).
      webcamId: 99,
      title: "Nowhere",
      images: { current: { preview: "https://img/x.jpg" } },
    },
  ],
};

const ZADAR = { lat: 44.12, lon: 15.24 };

describe("parseWebcams", () => {
  it("sortira po udaljenosti, najbliža prva", () => {
    const out = parseWebcams(RESPONSE, ZADAR.lat, ZADAR.lon);
    expect(out.map((w) => w.id)).toEqual(["42", "1651177539"]);
    expect(out[0]!.distanceKm).toBeLessThan(out[1]!.distanceKm);
  });

  /**
   * „Kamera u blizini" bez udaljenosti nije informacija — a bez koordinata
   * se udaljenost ne može izračunati.
   */
  it("odbacuje kamere bez koordinata", () => {
    const out = parseWebcams(RESPONSE, ZADAR.lat, ZADAR.lon);
    expect(out.find((w) => w.id === "99")).toBeUndefined();
  });

  /** Ime MJESTA je korisnije od naslova kamere („Cam 3"). */
  it("uzima ime mjesta kad postoji", () => {
    const out = parseWebcams(RESPONSE, ZADAR.lat, ZADAR.lon);
    expect(out[0]!.title).toBe("Zadar");
  });

  /**
   * Slika se traži na VIŠE mjesta jer je v3 vraća pod `images.current`, a
   * neke kamere pod `images.sizes`. Obje varijante moraju proći.
   */
  it("nalazi sliku u obje varijante odgovora", () => {
    const out = parseWebcams(RESPONSE, ZADAR.lat, ZADAR.lon);
    const zd = out.find((w) => w.id === "42")!;
    const tkon = out.find((w) => w.id === "1651177539")!;
    expect(zd.preview).toBe("https://img/zd-preview.jpg?t=def");
    expect(zd.full).toBe("https://img/zd-full.jpg?t=def");
    expect(tkon.preview).toBe("https://img/tkon-preview.jpg?t=abc");
    // Bez `full` pada na `preview` — bolje manja slika nego prazan okvir.
    expect(tkon.full).toBe(tkon.preview);
  });

  /** Obveza iz uvjeta Windyja: svaka slika mora vesti na njihovu stranicu. */
  it("svaka kamera ima adresu svoje stranice", () => {
    for (const w of parseWebcams(RESPONSE, ZADAR.lat, ZADAR.lon)) {
      expect(w.pageUrl).toMatch(/^https:\/\/www\.windy\.com\/webcams\//);
    }
  });

  it("čita vrijeme snimanja kao ms", () => {
    const out = parseWebcams(RESPONSE, ZADAR.lat, ZADAR.lon);
    expect(out[0]!.takenAtMs).toBe(Date.parse("2026-09-09T13:00:00.000Z"));
  });

  /*
   * Kamere su ukras, ne podatak zbog kojeg app pada — parser ne smije
   * baciti ni na jednom obliku smeća.
   */
  it("preživi neispravan odgovor", () => {
    for (const bad of [undefined, null, {}, { webcams: null }, { webcams: {} }, []]) {
      expect(parseWebcams(bad, ZADAR.lat, ZADAR.lon)).toEqual([]);
    }
  });

  it("preživi kameru bez ijednog polja", () => {
    const out = parseWebcams({ webcams: [{}] }, ZADAR.lat, ZADAR.lon);
    expect(out).toEqual([]);
  });

  /**
   * Domet TRAŽENJA, ne prikaza — što se prikazuje odlučuje `pickWebcams`
   * po imenu mjesta (vidi ispod). 25 km je dovoljno da se uhvate i
   * susjedna mjesta, za slučaj da grad svoju kameru nema.
   */
  it("traži se u razumnom krugu", () => {
    expect(WEBCAM_RANGE_KM).toBe(25);
  });
});

describe("pickWebcams — ČIJE se kamere prikazuju", () => {
  const cam = (title: string, distanceKm: number): Webcam => ({
    id: title + distanceKm,
    title,
    lat: 0,
    lon: 0,
    distanceKm,
    preview: "https://img/x.jpg",
  });

  /**
   * Markov nalaz 9.9.2026.: u popisu za Zadar su bile tri kamere — Zadar,
   * „unknown" i **Vir na 20 km**. „To nema smisla… samo za grad ako ima
   * grad kameru." Vir je unutar dometa traženja, ali nije Zadar.
   */
  it("grad sa svojom kamerom NE pokazuje susjede", () => {
    const out = pickWebcams(
      [cam("Zadar", 1), cam("Zadar", 3), cam("Vir", 20)],
      "Zadar",
    );
    expect(out.map((w) => w.title)).toEqual(["Zadar", "Zadar"]);
  });

  /** Sufiksi i dijakritika ne smiju razdvojiti isto mjesto. */
  it("prepoznaje mjesto uz sufiks i dijakritiku", () => {
    expect(pickWebcams([cam("Zadar-Puntamika", 2)], "Zadar")).toHaveLength(1);
    expect(pickWebcams([cam("Šibenik", 2)], "Sibenik")).toHaveLength(1);
    expect(pickWebcams([cam("Sibenik", 2)], "Šibenik")).toHaveLength(1);
  });

  /**
   * Mjesto bez vlastite kamere dobiva susjede — ali samo blizu (Markov
   * predlog „ako nema u tom mjestu, isto možeš ove okolo pokazat").
   */
  it("bez vlastite kamere uzima BLIZU susjede", () => {
    const out = pickWebcams([cam("Nin", 8), cam("Vir", 20)], "Polača");
    expect(out.map((w) => w.title)).toEqual(["Nin"]);
  });

  it("daleki susjedi ispadaju i kad grad nema svoju", () => {
    expect(pickWebcams([cam("Vir", 20), cam("Zadar", 25)], "Polača")).toEqual([]);
  });

  it("bez imena mjesta pada na blizinu", () => {
    const out = pickWebcams([cam("Nin", 8), cam("Vir", 20)], "");
    expect(out.map((w) => w.title)).toEqual(["Nin"]);
  });
});

describe("parseWebcams — kamere bez imena", () => {
  /**
   * Markov nalaz 9.9.2026.: u popisu za Zadar se pojavila kamera imena
   * „unknown". Slika bez mjesta ne govori ništa o vremenu jer se ne zna
   * GDJE je — pa takva kamera ispada.
   */
  it("odbacuje kamere bez upotrebljivog imena", () => {
    const raw = {
      webcams: [
        { webcamId: 1, location: { latitude: 44.12, longitude: 15.24, city: "unknown" }, images: { current: { preview: "https://i/1.jpg" } } },
        { webcamId: 2, location: { latitude: 44.12, longitude: 15.24, city: "" }, title: "Cam 3", images: { current: { preview: "https://i/2.jpg" } } },
        { webcamId: 3, location: { latitude: 44.12, longitude: 15.24, city: "  " }, title: "webcam 12", images: { current: { preview: "https://i/3.jpg" } } },
        { webcamId: 4, location: { latitude: 44.12, longitude: 15.24, city: "Zadar" }, images: { current: { preview: "https://i/4.jpg" } } },
      ],
    };
    const out = parseWebcams(raw, 44.12, 15.24);
    expect(out.map((w) => w.title)).toEqual(["Zadar"]);
  });

  /** Ne smije pojesti prava imena koja slučajno sadrže brojku ili kraticu. */
  it("zadržava stvarna imena mjesta", () => {
    const mk = (city: string) => ({
      webcamId: city,
      location: { latitude: 44.12, longitude: 15.24, city },
      images: { current: { preview: "https://i/x.jpg" } },
    });
    const out = parseWebcams({ webcams: ["Vir", "Nin", "Mali Lošinj", "Novi Vinodolski"].map(mk) }, 44.12, 15.24);
    expect(out).toHaveLength(4);
  });
});
