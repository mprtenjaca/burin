import type { ReactNode } from "react";
import { Text, View } from "react-native";

/**
 * Sekcija s malim naslovom. Naslovi su NORMALNA slova, ne verzal s
 * razmaknutim slovima (dorada 6.8.2026.) — uppercase+tracking je posvuda
 * izgledao generički ("AI dizajn"), a čita se i teže.
 */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2.5">
      <Text className="px-1 font-grotesk-bold text-[13.5px] text-ink/55 dark:text-paper/55">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Kartica — bez ruba, ispunjena: bijela na mist podlozi, coal na night
 * (redizajn 6.8.2026.; rubovi su na mockupu ocijenjeni kao "ružni").
 */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={`rounded-2xl bg-white dark:bg-coal ${className ?? ""}`}>
      {children}
    </View>
  );
}

/** 1px linija-razdjelnica. */
export function Hairline() {
  return <View className="h-px bg-ink/[0.05] dark:bg-paper/[0.07]" />;
}
