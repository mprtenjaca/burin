import { WEBCAM_RANGE_KM, parseWebcams, pickWebcams } from "../windyWebcams";
import type { Webcam } from "../windyWebcams";

/**
 * Oblik odgovora Windy Webcams v3 (`include=images,location,urls`).
 *
 * Isječak PRAVOG odgovora, dohvaćen s ključem 9.9.2026. (kamera Tkon uz
 * Polaču). Kad Windy promijeni oblik, ovaj test pukne prvi — isto načelo
 * kao `__fixtures__/stampar-zagreb.html`.
 *
 * Ovdje je i zamka koja je stvarno prevarila prvu verziju parsera:
 * `images.sizes` nosi DIMENZIJE, ne adrese.
 */
const RESPONSE = {
  total: 3,
  webcams: [
    {
      webcamId: 1437078303,
      title: "Tkon: Webcam Live - Marina",
      status: "active",
      lastUpdatedOn: "2026-09-09T08:11:45.000Z",
      images: {
        current: {
          icon: "https://imgproxy.windy.com/_/icon/plain/current/1437078303/original.jpg?v=2",
          thumbnail: "https://imgproxy.windy.com/_/thumbnail/plain/current/1437078303/original.jpg?v=2",
          preview: "https://imgproxy.windy.com/_/preview/plain/current/1437078303/original.jpg?v=2",
        },
        // DIMENZIJE, ne adrese — prva verzija parsera je odavde citala
        //  i dobivala undefined (vidi test ispod).
        sizes: {
          icon: { width: 48, height: 48 },
          thumbnail: { width: 200, height: 112 },
          preview: { width: 400, height: 224 },
        },
        daylight: {
          preview: "https://imgproxy.windy.com/_/preview/plain/daylight/1437078303/original.jpg?v=2",
        },
      },
      location: {
        city: "Tkon",
        region: "Zadar County",
        country_code: "HR",
        latitude: 43.92212,
        longitude: 15.41891,
      },
      urls: {
        detail: "https://windy.com/webcams/1437078303",
        provider: "https://www.whatsupcams.com/en/webcams/Croatia/Zadar/Tkon/tkon-marina",
      },
    },
    {
      // Blize Zadru — mora ispasti prvo po udaljenosti.
      webcamId: 42,
      title: "Cam 3",
      status: "active",
      location: { latitude: 44.12, longitude: 15.24, city: "Zadar" },
      images: { current: { preview: "https://img/zd.jpg?t=def" } },
      urls: { detail: "https://windy.com/webcams/42" },
      lastUpdatedOn: "2026-09-09T13:00:00.000Z",
    },
    {
      // Bez koordinata — odbacuje se.
      webcamId: 99,
      title: "Nowhere",
      status: "active",
      images: { current: { preview: "https://img/x.jpg" } },
    },
  ],
};

const ZADAR = { lat: 44.12, lon: 15.24 };

describe("parseWebcams", () => {
  it("sortira po udaljenosti, najbliža prva", () => {
    const out = parseWebcams(RESPONSE, ZADAR.lat, ZADAR.lon);
    expect(out.map((w) => w.id)).toEqual(["42", "1437078303"]);
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
   * REGRESIJA koja je stvarno pogodila korisnika (9.9.2026.): za Polaču je
   * kartica pisala „nema kamera u blizini" iako je API vratio deset.
   *
   * Uzrok: prva verzija je sliku čitala kao `images.sizes.preview.url`, a
   * `sizes` nosi DIMENZIJE (`{width, height}`) — adrese su samo u
   * `images.current` i `images.daylight`. Rezultat je bio `undefined`, a
   * kartica bez slike pokazuje prazno stanje.
   */
  it("čita sliku iz images.current, ne iz sizes (dimenzije)", () => {
    const out = parseWebcams(RESPONSE, ZADAR.lat, ZADAR.lon);
    const tkon = out.find((w) => w.id === "1437078303")!;
    expect(tkon.preview).toBe(
      "https://imgproxy.windy.com/_/preview/plain/current/1437078303/original.jpg?v=2",
    );
    // `preview` (400×224) je najveća veličina koju v3 daje — nema većeg.
    expect(tkon.full).toBe(tkon.preview);
  });

  /** Kamera koja noću ne daje sliku pada na zadnju DNEVNU. */
  it("bez current slike uzima daylight", () => {
    const raw = {
      webcams: [
        {
          webcamId: 7,
          status: "active",
          location: { latitude: 44.12, longitude: 15.24, city: "Nin" },
          images: { daylight: { preview: "https://img/day.jpg" } },
        },
      ],
    };
    expect(parseWebcams(raw, ZADAR.lat, ZADAR.lon)[0]!.preview).toBe(
      "https://img/day.jpg",
    );
  });

  /**
   * Slika stara danima laže o današnjem vremenu gore nego prazan okvir,
   * pa neaktivne kamere ispadaju.
   */
  it("odbacuje neaktivne kamere", () => {
    const raw = {
      webcams: [
        {
          webcamId: 8,
          status: "inactive",
          location: { latitude: 44.12, longitude: 15.24, city: "Nin" },
          images: { current: { preview: "https://img/old.jpg" } },
        },
      ],
    };
    expect(parseWebcams(raw, ZADAR.lat, ZADAR.lon)).toEqual([]);
  });

  /**
   * Izmjereno na pravom odgovoru za Polaču: od 10 vraćenih kamera PET je
   * bio Tkon, sve na 4.2 km. Pet slika istog mjesta ne govori više od
   * jedne, a istisnu susjedna mjesta iz limita.
   */
  it("zadržava najviše jednu kameru po mjestu", () => {
    const mk = (city: string, lat: number) => ({
      webcamId: `${city}-${lat}`,
      status: "active",
      location: { latitude: lat, longitude: 15.24, city },
      images: { current: { preview: "https://img/x.jpg" } },
    });
    const out = parseWebcams(
      { webcams: [mk("Tkon", 43.92), mk("Tkon", 43.93), mk("Nin", 44.24)] },
      ZADAR.lat,
      ZADAR.lon,
    );
    expect(out.map((w) => w.title)).toEqual(["Nin", "Tkon"]);
  });

  /** Obveza iz uvjeta Windyja: svaka slika mora vesti na njihovu stranicu. */
  it("svaka kamera ima adresu svoje stranice", () => {
    for (const w of parseWebcams(RESPONSE, ZADAR.lat, ZADAR.lon)) {
      expect(w.pageUrl).toMatch(/^https:\/\/(www\.)?windy\.com\/webcams\//);
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
   * Mjesto bez vlastite kamere dobiva TOČNO JEDNU — najbližu (Markov
   * zahtjev 9.9.2026.: „ako nema ništa u tom mjestu želim samo 1 najbližu
   * kameru, obavezno").
   */
  it("bez vlastite kamere uzima samo jednu, najbližu", () => {
    const out = pickWebcams([cam("Nin", 8), cam("Vir", 20)], "Polača");
    expect(out.map((w) => w.title)).toEqual(["Nin"]);
  });

  /**
   * REGRESIJA: prva verzija je susjede rezala na 12 km, pa su Pridraga i
   * Polača (bez vlastite kamere, najbliža dalje od 12 km) ostajale BEZ
   * sekcije. Udaljenost nije razlog da se ništa ne pokaže — kartica je
   * ionako ispiše.
   */
  it("najbliža se pokazuje i kad je daleko", () => {
    expect(pickWebcams([cam("Vir", 20), cam("Zadar", 25)], "Pridraga").map((w) => w.title)).toEqual(["Vir"]);
    expect(pickWebcams([cam("Zadar", 48)], "Gračac").map((w) => w.title)).toEqual(["Zadar"]);
  });

  it("bez imena mjesta isto uzima najbližu", () => {
    const out = pickWebcams([cam("Nin", 8), cam("Vir", 20)], "");
    expect(out.map((w) => w.title)).toEqual(["Nin"]);
  });

  it("bez ijedne kamere vraća prazno — tek tada nema sekcije", () => {
    expect(pickWebcams([], "Pridraga")).toEqual([]);
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
