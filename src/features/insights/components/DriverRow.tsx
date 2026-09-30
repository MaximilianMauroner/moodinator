import React from "react";
import { Text, View } from "react-native";
import { useThemeColors } from "@/constants/colors";
import { getMoodHex } from "@/lib/moodPresentation";
import type { Driver } from "../utils/drivers";
export function ComparisonBars({ means }: { means: [number, number] }) {
  const { isDark } = useThemeColors();
  return (
    <View
      className="gap-2 mt-3"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {means.map((mean, i) => (
        <View
          key={i}
          className="h-2 rounded-full bg-paper-200 dark:bg-paper-800"
        >
          <View
            style={{
              height: 8,
              borderRadius: 4,
              width: `${mean * 10}%`,
              backgroundColor: getMoodHex(mean, isDark),
            }}
          />
        </View>
      ))}
    </View>
  );
}
export function DriverRow({ driver }: { driver: Driver }) {
  const label = `${driver.kind === "context" ? "Context tag" : "Emotion"}: ${driver.name}`;
  return (
    <View
      className="py-3"
      accessible
      accessibilityLabel={`${label}, average ${driver.withMean.toFixed(1)} with across ${driver.withCount} entries, average ${driver.withoutMean.toFixed(1)} without across ${driver.withoutCount} entries. Lower is better.`}
    >
      <Text className="font-semibold text-paper-800 dark:text-paper-200">
        {label}
      </Text>
      <Text className="text-sm text-paper-700 dark:text-sand-300">
        {driver.withMean.toFixed(1)} average with ({driver.withCount}) · {driver.withoutMean.toFixed(1)} without ({driver.withoutCount})
      </Text>
      <ComparisonBars means={[driver.withMean, driver.withoutMean]} />
    </View>
  );
}
