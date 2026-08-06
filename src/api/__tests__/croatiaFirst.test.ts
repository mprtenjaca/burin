import { croatiaFirst } from "../openMeteo";

describe("croatiaFirst", () => {
  it("hrvatska mjesta idu na vrh, redoslijed unutar grupa se čuva", () => {
    const sorted = croatiaFirst([
      { name: "Novalja (US)", countryCode: "US" },
      { name: "Novalja", countryCode: "HR" },
      { name: "Novalja (IT)", countryCode: "IT" },
      { name: "Novalja 2", countryCode: "HR" },
    ]);
    expect(sorted.map((p) => p.name)).toEqual([
      "Novalja",
      "Novalja 2",
      "Novalja (US)",
      "Novalja (IT)",
    ]);
  });

  it("bez ijednog hrvatskog rezultata redoslijed ostaje netaknut", () => {
    const list = [{ name: "A", countryCode: "DE" }, { name: "B" }];
    expect(croatiaFirst(list).map((p) => p.name)).toEqual(["A", "B"]);
  });
});
