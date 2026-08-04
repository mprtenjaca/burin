import { t } from "@/i18n";

import { fetchJson } from "./client";
import type { RadarFrame, TileSource } from "./types";

const API_URL = "https://api.rainviewer.com/public/weather-maps.json";

type RvFrame = { time: number; path: string };
type RvResponse = {
  host: string;
  radar?: { past?: RvFrame[]; nowcast?: RvFrame[] };
};

export type RadarFrames = { frames: RadarFrame[]; host: string };

/**
 * Dohvaća listu radarskih okvira (prošla 2 h + nowcast). `nowcast` zna biti
 * prazan — player mora raditi i samo s prošlim okvirima.
 */
export async function fetchRadarFrames(): Promise<RadarFrames> {
  const res = await fetchJson<RvResponse>(API_URL);
  const past = res.radar?.past ?? [];
  const nowcast = res.radar?.nowcast ?? [];
  return {
    host: res.host,
    frames: [
      ...past.map((f) => ({ time: f.time, path: f.path, isNowcast: false })),
      ...nowcast.map((f) => ({ time: f.time, path: f.path, isNowcast: true })),
    ],
  };
}

/** Shema boja 4, glatke pločice sa snijegom (1_1), 256 px. */
export function rainviewerTileSource(host: string, frame: RadarFrame): TileSource {
  return {
    id: `rainviewer-${frame.time}`,
    label: t.map.layerRadar,
    urlTemplate: `${host}${frame.path}/256/{z}/{x}/{y}/4/1_1.png`,
    opacity: 0.7,
    attribution: { label: t.map.radarAttribution, url: "https://www.rainviewer.com" },
  };
}
