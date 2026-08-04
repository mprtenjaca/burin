import { t } from "@/i18n";

import type { OwmLayer, TileSource } from "./types";

const KEY = process.env.EXPO_PUBLIC_OWM_API_KEY;

/** Bez ključa se OWM slojevi jednostavno ne nude — aplikacija radi i bez njih. */
export function hasOwmKey(): boolean {
  return typeof KEY === "string" && KEY.trim().length > 0;
}

export const OWM_LAYERS: OwmLayer[] = [
  "temp_new",
  "clouds_new",
  "wind_new",
  "precipitation_new",
];

export function owmLayerLabel(layer: OwmLayer): string {
  switch (layer) {
    case "temp_new":
      return t.map.layerTemperature;
    case "clouds_new":
      return t.map.layerClouds;
    case "wind_new":
      return t.map.layerWind;
    case "precipitation_new":
      return t.map.layerPrecipitation;
  }
}

export function owmTileSource(layer: OwmLayer): TileSource {
  return {
    id: `owm-${layer}`,
    label: owmLayerLabel(layer),
    urlTemplate: `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${KEY ?? ""}`,
    opacity: 0.6,
    attribution: { label: "OpenWeatherMap", url: "https://openweathermap.org" },
  };
}
