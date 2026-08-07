import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { fetchCurrentBatch } from "@/api/openMeteo";
import type { CurrentWeather, Place } from "@/api/types";
import { useCities } from "@/store/cities";
import { useLastWeather } from "@/store/lastWeather";
import { useSearchHistory } from "@/store/searchHistory";

/**
 * OSVJEŽAVANJE TEMPERATURA U POPISIMA (8.8.2026.).
 *
 * Ladica i tražilica pokazuju temperaturu uz svaki spremljeni grad, a ta
 * je brojka dolazila IZ KEŠA (`burin:last-weather`), koji je punio jedino
 * puni dohvat za OTVORENO mjesto. Gradovi koje korisnik nije otvorio su
 * zato držali temperaturu od zadnjeg otvaranja — nakon dan-dva posve
 * krivu, a djelovala je kao trenutna.
 *
 * Ovaj hook to popravlja jednim upitom pri pokretanju:
 *  - uzme SVE spremljene gradove (+ trenutno odabrani, ako nije spremljen)
 *  - dohvati im trenutno stanje odjednom (`fetchCurrentBatch`)
 *  - upiše samo `current`, prognozu ne dira
 *
 * Zašto ne react-query: ovo nije podatak nekog ekrana nego održavanje
 * zajedničkog keša, pokreće se jednom po pokretanju i nema svog
 * korisničkog sučelja. Hook u korijenu je jednostavniji od upita koji
 * nitko ne čita.
 */

/**
 * Koliko star keš mora biti da ga vrijedi osvježiti.
 *
 * 10 minuta je isti prag koji `useWeatherBundle` koristi za trenutno
 * vrijeme — nema smisla biti agresivniji od glavnog ekrana. Bez ovoga bi
 * svako vraćanje u aplikaciju trošilo kvotu, a Open-Meteo ima satnu
 * (~600/h, probijena testiranjem 6.8.).
 */
const STALE_MS = 10 * 60 * 1000;

export function useRefreshSavedCities(): void {
  const saved = useCities((s) => s.saved);
  const selected = useCities((s) => s.selected);
  /*
   * I POVIJEST pretrage (dorada 8.8.2026.): tražilica uz svako mjesto iz
   * povijesti pokazuje istu temperaturu iz keša kao i uz spremljene, pa
   * bez ovoga povijest ostaje na starim brojkama dok spremljeni žive.
   * Store je ionako ograničen na 12 unosa — batch ostaje malen.
   */
  const history = useSearchHistory((s) => s.entries);
  const refreshCurrent = useLastWeather((s) => s.refreshCurrent);

  /*
   * Zadnji pokušaj se pamti u refu, ne u stanju: služi samo kao brava
   * protiv ponavljanja i njegova promjena ne smije izazvati render.
   */
  const lastRun = useRef(0);

  useEffect(() => {
    const run = async () => {
      const now = Date.now();
      if (now - lastRun.current < STALE_MS) return;

      /*
       * Kandidati: spremljeni + odabrani (u ladici je na vrhu i kad nije
       * spremljen) + povijest pretrage. Duplikati se miču po `id`-u.
       *
       * FILTAR NA KEŠIRANE je bitan za kvotu: svaka koordinata u batchu
       * troši Open-Meteo poziv, a `refreshCurrent` mjesta BEZ postojećeg
       * paketa ionako preskače (paket bez prognoze bi offline srušio
       * ekran). Mjesto koje nikad nije otvoreno ni ne pokazuje
       * temperaturu u popisu, pa za njega nema što osvježiti.
       */
      const cached = useLastWeather.getState().byPlaceId;
      const seen = new Set<string>();
      const places: Place[] = [];
      for (const p of [...saved, ...(selected ? [selected] : []), ...history]) {
        if (seen.has(p.id) || !cached[p.id]) continue;
        seen.add(p.id);
        places.push(p);
      }
      if (places.length === 0) return;

      lastRun.current = now;

      const results = await fetchCurrentBatch(
        places.map((p) => ({ lat: p.lat, lon: p.lon })),
      );

      const updates: Record<string, CurrentWeather> = {};
      results.forEach((current, i) => {
        const place = places[i];
        // `null` = taj grad nije uspio; stara vrijednost ostaje.
        if (place && current) updates[place.id] = current;
      });

      if (Object.keys(updates).length > 0) refreshCurrent(updates);
    };

    void run();

    /*
     * I pri POVRATKU u aplikaciju, ne samo pri pokretanju: telefon se
     * danima ne gasi, pa bi inače „pokretanje" bilo jednom tjedno.
     * `STALE_MS` čuva od pretjeranog trošenja kvote.
     */
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void run();
    });
    return () => sub.remove();
    /*
     * `byPlaceId` se namjerno čita kroz `getState()` a NE kroz selektor:
     * upis koji `refreshCurrent` napravi promijenio bi ovisnost i vrtio
     * efekt u krug. `history` u ovisnostima je bezopasan — mijenja se na
     * otvaranje mjesta, a `lastRun` brana ionako guši ponavljanja.
     */
  }, [saved, selected, history, refreshCurrent]);
}
