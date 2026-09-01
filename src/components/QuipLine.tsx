import { Text } from "react-native";

import type { WeatherBundle } from "@/api/types";
import { quipFor } from "@/utils/quips";

/**
 * Domaća rečenica o vremenu — NA HEROJU, ispod osjeta.
 *
 * Bila je kartica ispod heroja (`SummaryCard`, do 10.8.2026.), pa je
 * Marko na uređaju rekao da mu se okvir ne sviđa i da rečenicu triba
 * dignut gore. Dvije stvari su se time promijenile:
 *
 *  1. NEMA VIŠE PLOHE. Na nebu svaka kartica izgleda ko zakrpa — heroj
 *     nema ni jedne druge, sve na njemu je goli tekst na gradijentu.
 *     Zato ni ovdje: ista boja ko ostatak heroja, samo prigušena i u
 *     kurzivu, pa se čita ko misao, a ne ko još jedan podatak.
 *  2. NEMA OZNAKE. Uz AI tekst je stajalo "Sastavljeno iz podataka" —
 *     ograda da se rečenica ne čita ko izmjerena brojka. Sad je piše
 *     čovjek, a kurziv i navodnici već govore da je ovo komentar.
 *
 * Boja NE dolazi iz teme nego se PRIMA (`color`): heroj je gradijent po
 * vremenu, pa se čitljivost mjeri na njemu (`readableOn`), isto pravilo
 * ko za sav ostali tekst na heroju.
 */
export function QuipLine({ bundle, color, maxWidth }: { bundle: WeatherBundle; color: string; maxWidth: number }) {
  return (
    <Text
      className="mt-3 text-center font-grotesk-medium text-[13.5px] italic"
      style={{
        color,
        /*
         * 0.8, ne puna boja: rečenica je komentar uz brojke, a ne
         * podatak — na punoj neprozirnosti se tukla s opisom vremena
         * iznad sebe, koji je stvarna informacija.
         */
        opacity: 0.8,
        lineHeight: 19,
        maxWidth,
      }}
    >
      {`„${quipFor(bundle)}”`}
    </Text>
  );
}
