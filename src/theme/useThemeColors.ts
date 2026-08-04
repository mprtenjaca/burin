import { useColorScheme } from "nativewind";

import { colors } from "./colors";

/** Boje ovisne o temi — za props koji ne idu kroz className (ikone, mape...). */
export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  return {
    dark,
    fg: dark ? colors.paper : colors.ink,
    bg: dark ? colors.night : colors.paper,
    mint: colors.mint,
  };
}
