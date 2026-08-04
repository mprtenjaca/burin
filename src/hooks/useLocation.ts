import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

import type { Place } from "@/api/types";
import { placeId } from "@/api/types";
import { t } from "@/i18n";

export type GpsState =
  | { status: "loading" }
  | { status: "granted"; place: Place }
  | { status: "denied" };

/**
 * Traži foreground dozvolu (samo balanced točnost — nikad preciznu ni
 * pozadinsku), dohvaća poziciju i reverse-geocodira ime mjesta.
 * Aplikacija mora biti potpuno upotrebljiva i kad je dozvola odbijena.
 */
export function useLocation(enabled: boolean): GpsState & { request: () => void } {
  const [state, setState] = useState<GpsState>({ status: "loading" });

  const request = useCallback(() => {
    let cancelled = false;

    async function run() {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (!perm.granted) {
          setState({ status: "denied" });
          return;
        }
        const pos =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));
        if (cancelled) return;

        const { latitude, longitude } = pos.coords;
        let name = t.drawer.myLocation;
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
          const first = geo[0];
          name = first?.city ?? first?.subregion ?? first?.region ?? name;
        } catch {
          // reverse geocode nije kritičan — ostaje "Moja lokacija"
        }
        if (cancelled) return;

        setState({
          status: "granted",
          place: {
            id: placeId(latitude, longitude),
            name,
            lat: latitude,
            lon: longitude,
            isGps: true,
          },
        });
      } catch {
        if (!cancelled) setState({ status: "denied" });
      }
    }

    setState({ status: "loading" });
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    return request();
  }, [enabled, request]);

  return { ...state, request };
}
