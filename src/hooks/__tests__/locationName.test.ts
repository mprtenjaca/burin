import { placeNameFrom, placeNameWithDistrict } from "../useLocation";

/*
 * IME MJESTA, NIKAD IME ŽUPANIJE (popravak 6.9.2026.).
 *
 * Marko na uređaju: uključio "Moju lokaciju" i na heroju je pisalo
 * "Zadarska županija" umjesto "Zadar". Stari red je bio
 * `city ?? subregion ?? region` — a na Androidu `city` zna biti `null`
 * izvan velikih gradova, pa je ime palo na upravnu jedinicu.
 *
 * Ovi testovi drže pravilo: kroz `placeNameFrom` ne smije proći naziv
 * županije/okruga ni na jednom jeziku sučelja.
 */
describe("placeNameFrom", () => {
  it("uzima grad kad postoji", () => {
    expect(placeNameFrom({ city: "Zadar", district: null, subregion: "Zadarska županija", region: "Zadarska županija", name: null })).toBe("Zadar");
  });

  it("Markov slučaj: bez grada NE uzima županiju", () => {
    // Točno ono što je Google vratio: city prazan, subregion = županija.
    const name = placeNameFrom({
      city: null,
      district: null,
      subregion: "Zadarska županija",
      region: "Zadarska županija",
      name: null,
    });
    // Radije "Moja lokacija" (undefined → pozivatelj zadrži zadano) nego županija.
    expect(name).toBeUndefined();
  });

  it("district nosi naselje kad grad izostane", () => {
    expect(
      placeNameFrom({ city: null, district: "Polača", subregion: "Zadarska županija", region: null, name: null }),
    ).toBe("Polača");
  });

  it("preskače županiju i uzme sljedeće smisleno ime", () => {
    expect(
      placeNameFrom({ city: null, district: null, subregion: "Zadarska županija", region: null, name: "Polača" }),
    ).toBe("Polača");
  });

  it("upravne jedinice na drugim jezicima također ne prolaze", () => {
    const admin = [
      "Zadarska županija",
      "Split-Dalmatia County",
      "Landkreis München",
      "Bezirk Innsbruck",
      "Province of Trieste",
      "Istarska regija",
      "Okrug Zagreb",
    ];
    for (const value of admin) {
      expect(placeNameFrom({ city: null, district: null, subregion: value, region: value, name: null })).toBeUndefined();
    }
  });

  it("ne siječe imena koja samo SADRŽE riječ", () => {
    // "Regionalni park" nije upravna jedinica — filtar hvata sufiks/prefiks,
    // ne bilo koje pojavljivanje, inače bi gutao prava imena.
    expect(placeNameFrom({ city: "Regionalni park Vransko jezero", district: null, subregion: null, region: null, name: null })).toBe(
      "Regionalni park Vransko jezero",
    );
  });

  it("prazan odgovor i prazni nizovi ne ruše ništa", () => {
    expect(placeNameFrom(undefined)).toBeUndefined();
    expect(placeNameFrom({ city: "", district: "   ", subregion: null, region: null, name: null })).toBeUndefined();
  });
});

/*
 * CETVRT U IMENU ZA VELIKE GRADOVE (11.9.2026.).
 *
 * Markov zahtjev: „ako onda nudi kvart zelim da mi pise Tresnjevka sjever
 * Zagreb… ne opcenito Zagreb, ako moze bit pljusak na jednoj strani a na
 * drugoj nista". Mjerljivo istog dana: ista celija nad Zagrebom imala je
 * 68 % pokrivenosti u 13:40 i 16 % u 13:50, a Tresnjevka i Maksimir su
 * 6 km razmaknuti = sedam radarskih piksela.
 */
describe("placeNameWithDistrict", () => {
  it("Zagreb dobiva cetvrt: 'Tresnjevka sjever · Zagreb'", () => {
    expect(placeNameWithDistrict({ city: "Zagreb", district: "Trešnjevka sjever" })).toBe(
      "Trešnjevka sjever · Zagreb",
    );
  });

  it("i ostali veliki gradovi", () => {
    expect(placeNameWithDistrict({ city: "Split", district: "Bačvice" })).toBe("Bačvice · Split");
    expect(placeNameWithDistrict({ city: "Rijeka", district: "Zamet" })).toBe("Zamet · Rijeka");
    expect(placeNameWithDistrict({ city: "Osijek", district: "Retfala" })).toBe("Retfala · Osijek");
  });

  it("MALI grad ostaje bez cetvrti — manji je od radarskog uzorka", () => {
    expect(placeNameWithDistrict({ city: "Zadar", district: "Puntamika" })).toBe("Zadar");
    expect(placeNameWithDistrict({ city: "Polača", district: "Nešto" })).toBe("Polača");
  });

  it("bez cetvrti vraca cisto ime grada", () => {
    expect(placeNameWithDistrict({ city: "Zagreb" })).toBe("Zagreb");
    expect(placeNameWithDistrict({ city: "Zagreb", district: "   " })).toBe("Zagreb");
  });

  it("cetvrt koja je ZAPRAVO grad se ne pise dvaput", () => {
    expect(placeNameWithDistrict({ city: "Zagreb", district: "Zagreb" })).toBe("Zagreb");
    expect(placeNameWithDistrict({ city: "Zagreb", district: "zagreb" })).toBe("Zagreb");
  });

  it("upravna jedinica kao 'cetvrt' se odbija", () => {
    expect(placeNameWithDistrict({ city: "Zagreb", district: "Zagrebačka županija" })).toBe("Zagreb");
  });

  it("bez adrese nema imena", () => {
    expect(placeNameWithDistrict(undefined)).toBeUndefined();
  });

  it("kad `city` fali, `district` i dalje sluzi kao IME (staro pravilo)", () => {
    // Tu cetvrt postaje samo ime — nema grada uz koji bi stajala.
    expect(placeNameWithDistrict({ district: "Trešnjevka" })).toBe("Trešnjevka");
  });
});
