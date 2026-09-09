import { create } from "zustand";

import type { MapLayerId } from "@/api/mapLayers";

/**
 * Dijeljeno stanje karte: aktivni sloj i položaj vremenske crte.
 *
 * Zašto izvan ekrana: crta mora preživjeti prebacivanje sloja. Ekran karte
 * se pri promjeni sloja rekreira (`key` po sloju na MapView — vidi app/map.tsx),
 * pa bi lokalni `useState` resetirao i sat i play/pauzu na svakom čipu.
 *
 * Namjerno nije `persist`: sat od jučer nema smisla vraćati u novoj sesiji.
 * Sloj se pamti samo unutar sesije, kako je i traženo.
 */
type MapTimelineState = {
  layer: MapLayerId;
  /** Korak crte; null = zadani (zadnji izmjereni okvir / trenutni sat). */
  step: number | null;
  playing: boolean;
  setLayer: (layer: MapLayerId) => void;
  setStep: (step: number) => void;
  resetStep: () => void;
  togglePlay: () => void;
  stop: () => void;
};

export const useMapTimeline = create<MapTimelineState>((set) => ({
  /*
   * ZADANI SLOJ je `radar_plus` (LibreWXR) od 9.9.2026. — stari `radar`
   * (RainViewer) je zakomentiran u `MAP_LAYERS` pa ga `mapLayerById` ne bi
   * ni našao. Store nije persistiran, pa nema starih instalacija koje bi
   * ostale na uklonjenom sloju.
   */
  layer: "radar_plus",
  step: null,
  playing: false,
  /**
   * Promjena sloja NE dira `step` ni `playing` — crta se nastavlja tamo gdje
   * je bila. Iznimka je prijelaz između vrsta crte (okviri <-> sati), gdje
   * indeks ne znači isto; to rješava ekran preko `resetStep`.
   */
  setLayer: (layer) => set({ layer }),
  setStep: (step) => set({ step }),
  resetStep: () => set({ step: null }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  stop: () => set({ playing: false }),
}));
