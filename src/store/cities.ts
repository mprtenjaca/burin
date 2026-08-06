import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Place } from "@/api/types";

type CitiesState = {
  /** Spremljeni gradovi (redoslijed = redoslijed u ladici). */
  saved: Place[];
  /** Odabrano mjesto; null = "Moja lokacija" (GPS). */
  selected: Place | null;
  addCity: (place: Place) => void;
  removeCity: (id: string) => void;
  select: (place: Place | null) => void;
  isSaved: (id: string) => boolean;
};

export const useCities = create<CitiesState>()(
  persist(
    (set, get) => ({
      saved: [],
      selected: null,
      addCity: (place) =>
        set((s) =>
          s.saved.some((p) => p.id === place.id)
            ? s
            : { saved: [...s.saved, place] },
        ),
      removeCity: (id) =>
        set((s) => ({ saved: s.saved.filter((p) => p.id !== id) })),
      /*
       * Odabir SPREMLJENOG grada seli ga na kraj niza (= vrh prikaza:
       * ladica i tražilica prikazuju obrnuto, najnovije prvo). Bez ovoga
       * je grad istisnut iz prvih 6 u ladici bio "izgubljen" i povratkom
       * u njega se nije vraćao (dorada 6.8.2026.).
       */
      select: (place) =>
        set((s) => {
          if (!place || !s.saved.some((p) => p.id === place.id)) {
            return { selected: place };
          }
          return {
            selected: place,
            saved: [...s.saved.filter((p) => p.id !== place.id), place],
          };
        }),
      isSaved: (id) => get().saved.some((p) => p.id === id),
    }),
    {
      name: "burin:cities",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ saved: s.saved, selected: s.selected }) as CitiesState,
    },
  ),
);
