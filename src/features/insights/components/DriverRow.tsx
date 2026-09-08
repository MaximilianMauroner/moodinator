import React from "react";
import { Text, View } from "react-native";
import { useThemeColors } from "@/constants/colors";
import { getMoodHex } from "@/lib/moodPresentation";
import type { Driver } from "../utils/drivers";
import { effectWords } from "../utils/findings";
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
  return (
    <View
      className="py-3"
      accessible
      accessibilityLabel={`${driver.name}, ${effectWords(driver.effect)}, ${driver.withCount} with, ${driver.withoutCount} without`}
    >
      <Text className="font-semibold text-paper-800 dark:text-paper-200">
        {driver.name} · {effectWords(driver.effect)}
      </Text>
      <Text className="text-sm text-paper-700 dark:text-sand-300">
        {driver.withCount} with · {driver.withoutCount} without
      </Text>
      <ComparisonBars means={[driver.withMean, driver.withoutMean]} />
    </View>
  );
}
