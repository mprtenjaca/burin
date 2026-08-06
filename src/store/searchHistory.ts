import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Place } from "@/api/types";

/**
 * Povijest otvaranih mjesta iz tražilice (dorada 6.8.2026.) — najnovije
 * prvo, bez duplikata, S GRANICOM: povijest je pomoć za "ono mjesto od
 * neki dan", ne arhiv do beskraja.
 */
const MAX_ENTRIES = 12;

type SearchHistoryState = {
  entries: Place[];
  add: (place: Place) => void;
  clear: () => void;
};

export const useSearchHistory = create<SearchHistoryState>()(
  persist(
    (set) => ({
      entries: [],
      add: (place) =>
        set((s) => ({
          entries: [place, ...s.entries.filter((p) => p.id !== place.id)].slice(
            0,
            MAX_ENTRIES,
          ),
        })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: "burin:search-history",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
