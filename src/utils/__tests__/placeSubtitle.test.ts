import { placeSubtitle } from "../format";

describe("placeSubtitle", () => {
  /**
   * Povod (9.9.2026.): tražilica je dala Vranu na Cresu umjesto one uz
   * Vransko jezero, a Polača postoji i kod Knina. Sama „Hrvatska" ta
   * mjesta ne razlikuje — županija da.
   */
  it("hrvatsko mjesto: županija · država", () => {
    expect(
      placeSubtitle({ name: "Vrana", region: "Zadarska županija", country: "Hrvatska" }),
    ).toBe("Zadarska županija · Hrvatska");
    expect(
      placeSubtitle({ name: "Vrana", region: "Primorsko-goranska županija", country: "Hrvatska" }),
    ).toBe("Primorsko-goranska županija · Hrvatska");
  });

  it("vrijedi i izvan Hrvatske", () => {
    expect(placeSubtitle({ name: "Neustadt", region: "Bayern", country: "Njemačka" })).toBe(
      "Bayern · Njemačka",
    );
  });

  /** Wien / Wien, Zagreb / Grad Zagreb: regija jednaka imenu ne ponavlja se. */
  it("preskače regiju jednaku imenu mjesta", () => {
    expect(placeSubtitle({ name: "Wien", region: "Wien", country: "Austrija" })).toBe("Austrija");
  });

  /** Stariji spremljeni gradovi i GPS nemaju regiju — ostaje kako je bilo. */
  it("bez regije pokazuje samo državu", () => {
    expect(placeSubtitle({ name: "Zadar", country: "Hrvatska" })).toBe("Hrvatska");
  });

  it("prazna i razmaknuta polja ispadaju", () => {
    expect(placeSubtitle({ name: "X", region: "  ", country: "" })).toBe("");
    expect(placeSubtitle({ name: "X" })).toBe("");
  });
});
