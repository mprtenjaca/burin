import { Text, View } from "react-native";

import type { MapLayerId } from "@/api/mapLayers";
import { t } from "@/i18n";

/** Skala boja po sloju — bez ovoga korisnik ne zna što crveno/zeleno znači. */
const SCALES: Record<MapLayerId, { colors: string[]; from: string; to: string }> = {
  radar: {
    colors: ["#8CD1F5", "#2E9DF7", "#2EE68A", "#F5E12E", "#F58A2E", "#E63946"],
    from: t.map.legendWeak,
    to: t.map.legendStrong,
  },
  temp_new: {
    colors: ["#8E44AD", "#2E86DE", "#2EE6A8", "#F5E12E", "#F58A2E", "#E63946"],
    from: "-40 °C",
    to: "+40 °C",
  },
  clouds_new: {
    // Sivo, ne bijelo: bijela na svijetloj podlozi ne postoji kao legenda.
    colors: ["#E8EAED", "#CBD2D9", "#9AA5B1", "#6B7580", "#3E4C59"],
    from: "0 %",
    to: "100 %",
  },
  /*
   * Prati `SPEED_COLOR` u `WindBarbs`: bijelo (mirno) → jantarno
   * (olujno). Zelena je maknuta 8.8.2026. — na plavoj podlozi se čitala
   * kao vlastita informacija, a ne kao jačina.
   */
  wind_new: {
    /*
     * Nijedna boja se NE SMIJE ponoviti: legenda ih koristi kao React
     * `key` (nađeno na uređaju 8.8.2026. — dva puta #FFFFFF je srušilo
     * ekran karte). Zato je drugi stupanj tek malo topliji od bijele,
     * umjesto da bude ista bijela.
     */
    colors: ["#FFFFFF", "#FFF7E0", "#FFE9A8", "#FFC24D"],
    from: "0 km/h",
    to: "70+ km/h",
  },
};

export function LayerLegend({ layer }: { layer: MapLayerId }) {
  const scale = SCALES[layer];

  return (
    // Tamna ploha kao ostale kontrole karte (dorada 6.8.2026.) — podloga
    // karte varira, tamna je jedina koja svugdje drži kontrast.
    <View className="gap-1.5 rounded-2xl bg-ink/85 px-3 py-2">
      <View className="h-1.5 flex-row overflow-hidden rounded-full">
        {/*
          Ključ je POLOŽAJ, ne boja (popravak 8.8.2026.): skala smije
          imati dvije iste boje (npr. dva bijela stupnja), a boja kao
          ključ je tada duplikat i React sruši ekran. Redoslijed je
          fiksan, pa je indeks ovdje ispravan ključ.
        */}
        {scale.colors.map((color, i) => (
          <View key={i} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </View>
      <View className="flex-row justify-between">
        <Text className="font-grotesk text-[10.5px] text-paper/60">{scale.from}</Text>
        <Text className="font-grotesk text-[10.5px] text-paper/60">{scale.to}</Text>
      </View>
    </View>
  );
}
