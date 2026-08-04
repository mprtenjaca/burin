import { View } from "react-native";

/** Tihi placeholder blok za stanje učitavanja. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <View className={`rounded-2xl bg-ink/5 dark:bg-paper/10 ${className ?? ""}`} />
  );
}

/** Skelet cijelog početnog ekrana. */
export function HomeSkeleton() {
  return (
    <View className="flex-1 gap-6 bg-paper px-5 pt-8 dark:bg-night">
      <View className="items-center gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-24 w-44" />
        <Skeleton className="h-5 w-36" />
      </View>
      <Skeleton className="h-16" />
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </View>
  );
}
