import React from "react";
import { Text, View } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { useThemeColors } from "@/constants/colors";
import { getMoodHex } from "@/lib/moodPresentation";
import type { DailyPoint } from "../utils/dailySeries";
import { trendGeometry } from "../utils/trendGeometry";
export function TrendBand({ series }: { series: DailyPoint[] }) {
  const { isDark, get } = useThemeColors();
  const geometry = trendGeometry(series);
  const values = series.filter((p) => p.mean !== null);
  const mean = values.length
    ? values.reduce((sum, p) => sum + p.mean!, 0) / values.length
    : 5;
  const color = getMoodHex(mean, isDark);
  return (
    <View
      accessible
      accessibilityLabel={`Mood trend, ${values.length} logged days, ${series.length - values.length} days without entries. Lower is better.${values.length ? ` First logged day ${values[0].day}: ${values[0].mean!.toFixed(1)}. Last logged day ${values[values.length - 1].day}: ${values[values.length - 1].mean!.toFixed(1)}. Best ${values.reduce((best, point) => Math.min(best, point.min!), 10).toFixed(1)}, most difficult ${values.reduce((worst, point) => Math.max(worst, point.max!), 0).toFixed(1)}.` : ""}`}
    >
      <Text className="text-sm text-paper-700 dark:text-sand-300">
        0 · Best
      </Text>
      <Svg width="100%" height={140} viewBox="-3 -3 306 126">
        {[0, 60, 120].map((y) => (
          <Line
            key={y}
            x1={0}
            x2={300}
            y1={y}
            y2={y}
            stroke={get("border")}
            strokeWidth={0.5}
          />
        ))}
        {geometry.bands.map((d, i) => (
          <Path key={`band${i}`} d={d} fill={color} fillOpacity={0.18} />
        ))}
        {geometry.lines.map((d, i) => (
          <Path
            key={`line${i}`}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
        ))}
        {geometry.whiskers.map((whisker, i) => (
          <Line
            key={`range${i}`}
            x1={whisker.x}
            x2={whisker.x}
            y1={whisker.minY}
            y2={whisker.maxY}
            stroke={color}
            strokeWidth={3}
            strokeOpacity={0.5}
          />
        ))}
        {geometry.dots.map((dot, i) => (
          <Circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r={2}
            fill={getMoodHex(dot.mood, isDark)}
          />
        ))}
      </Svg>
      <Text className="text-sm text-paper-700 dark:text-sand-300">
        10 · Most difficult
      </Text>
      <View className="flex-row justify-between mt-2">
        <Text className="text-xs text-paper-700 dark:text-sand-300">
          {series[0]?.day}
        </Text>
        <Text className="text-xs text-paper-700 dark:text-sand-300">
          {series[series.length - 1]?.day}
        </Text>
      </View>
      <Text className="mt-2 text-xs text-paper-700 dark:text-sand-300">
        Daily mean · shaded daily range · gaps mean no entries
      </Text>
    </View>
  );
}
