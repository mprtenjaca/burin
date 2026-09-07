import { create } from "zustand";

import type { DailyPoint, HourlyPoint } from "@/api/types";

/**
 * Podaci za sheet s detaljima dana (`app/(screens)/day.tsx`), u MEMORIJI.
 *
 * Zašto store, a ne parametri navigacije: ekran peludi prima podatke
 * kroz parametre (desetak brojki, sitan JSON), ali detalji dana trebaju
 * `hourlyAll` — 14 dana × 24 sata × 15 polja, ~69 kB po gradu. Toliko
 * kroz URL parametre znači serijalizaciju na JS threadu točno u kadru
 * prijelaza, a to je isti trošak zbog kojeg se `hourlyAll` ne piše ni na
 * disk (odluka „sve što ide na disk mora biti malo").
 *
 * Zato početna, prije `router.push`, samo POKAŽE na podatke koje već drži
 * u ruci (referenca, bez kopiranja), a sheet ih pročita. Isto pravilo kao
 * ekran peludi i `widgetData.ts`: što prima drugi ekran, mora biti GOTOVO
 * — sheet ne vrti nijedan upit ni hook s mrežom.
 *
 * Namjerno NIJE `persist`: podaci žive koliko i bundle na početnoj; kad
 * se grad promijeni, početna upiše nove prije sljedećeg otvaranja. Bez
 * upisa (npr. deep link) sheet pokaže „Nema podataka".
 */
type DayDetailsState = {
  days: DailyPoint[];
  hourly: HourlyPoint[];
  /** Ime mjesta za podnaslov sheeta („Zadar"). */
  place: string;
  setSource: (source: { days: DailyPoint[]; hourly: HourlyPoint[]; place: string }) => void;
};

export const useDayDetails = create<DayDetailsState>((set) => ({
  days: [],
  hourly: [],
  place: "",
  setSource: (source) => set(source),
}));
