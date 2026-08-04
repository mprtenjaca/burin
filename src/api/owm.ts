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

/**
 * Prozirnost po sloju. Naoblaka je u izvoru blijeda pa je gura se najviše;
 * temperatura je puna površina pa mora biti prozirnija da se vide gradovi.
 */
function layerOpacity(layer: OwmLayer): number {
  switch (layer) {
    case "clouds_new":
      return 0.85;
    case "temp_new":
      return 0.55;
    case "wind_new":
      return 0.7;
    case "precipitation_new":
      return 0.75;
  }
}

/**
 * OWM besplatni tile slojevi postoje samo do zoom razine 10; iznad toga
 * server vraća grešku ("zoom level not supported"). `maximumNativeZ` govori
 * karti da pločice s z=10 rasteže na veće zoomove umjesto da ih traži.
 */
export const OWM_MAX_NATIVE_Z = 10;

export function owmTileSource(layer: OwmLayer): TileSource {
  return {
    id: `owm-${layer}`,
    label: owmLayerLabel(layer),
    urlTemplate: `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${KEY ?? ""}`,
    opacity: layerOpacity(layer),
    attribution: { label: "OpenWeatherMap", url: "https://openweathermap.org" },
  };
}
