import type { ReactNode } from "react";
import { Text, View } from "react-native";

/** Sekcija s tihim naslovom — bez kartice, dijeli je samo bjelina. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="text-xs uppercase tracking-[2px] text-ink/50 dark:text-paper/50">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Kartica — rounded-2xl s jedva vidljivim rubom, bez sjena. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View
      className={`rounded-2xl border border-ink/[0.08] dark:border-paper/10 ${className ?? ""}`}
    >
      {children}
    </View>
  );
}

/** 1px linija-razdjelnica. */
export function Hairline() {
  return <View className="h-px bg-ink/[0.08] dark:bg-paper/10" />;
}
