import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useColorScheme } from "nativewind";
import { Ionicons } from "@expo/vector-icons";

import type { CorrelationResult, CorrelationSummary } from "../utils/correlations";
import { formatDelta } from "../utils/correlations";

interface CorrelationsCardProps {
  summary: CorrelationSummary;
  maxItems?: number;
}

export function CorrelationsCard({ summary, maxItems = 5 }: CorrelationsCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  if (summary.correlations.length === 0) {
    return null;
  }

  // Get top correlations
  const topCorrelations = summary.correlations.slice(0, maxItems);

  return (
    <View
      className="rounded-3xl bg-paper-50 dark:bg-paper-850 p-5 mb-4"
      style={isDark ? styles.cardShadowDark : styles.cardShadowLight}
    >
      {/* Header */}
      <View className="flex-row items-center mb-4">
        <View
          className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
          style={{ backgroundColor: isDark ? "#2D2A33" : "#EFECF2" }}
        >
          <Ionicons
            name="git-compare-outline"
            size={20}
            color={isDark ? "#C4BBCF" : "#695C78"}
          />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-paper-800 dark:text-paper-200">
            Mood Correlations
          </Text>
          <Text className="text-xs text-sand-500 dark:text-sand-400">
            Based on {summary.totalEntries} entries
          </Text>
        </View>
      </View>

      {/* Summary Stats */}
      <View className="flex-row mb-4 gap-3">
        {summary.topPositive && (
          <View className="flex-1 p-3 rounded-xl bg-sage-100 dark:bg-sage-600/20">
            <View className="flex-row items-center mb-1">
              <Ionicons
                name="trending-up"
                size={14}
                color={isDark ? "#A8C5A8" : "#5B8A5B"}
              />
              <Text className="text-xs ml-1 text-sage-600 dark:text-sage-300">
                Best for mood
              </Text>
            </View>
            <Text className="text-sm font-semibold text-sage-600 dark:text-sage-300">
              {summary.topPositive.label}
            </Text>
            <Text className="text-xs text-sage-500 dark:text-sage-400">
              {formatDelta(summary.topPositive.delta)} avg
            </Text>
          </View>
        )}

        {summary.topNegative && (
          <View className="flex-1 p-3 rounded-xl bg-coral-100 dark:bg-coral-600/20">
            <View className="flex-row items-center mb-1">
              <Ionicons
                name="trending-down"
                size={14}
                color={isDark ? "#F5A899" : "#C75441"}
              />
              <Text className="text-xs ml-1 text-coral-600 dark:text-coral-300">
                Challenging
              </Text>
            </View>
            <Text className="text-sm font-semibold text-coral-600 dark:text-coral-300">
              {summary.topNegative.label}
            </Text>
            <Text className="text-xs text-coral-500 dark:text-coral-400">
              {formatDelta(summary.topNegative.delta)} avg
            </Text>
          </View>
        )}
      </View>

      {/* Correlation List */}
      <View className="gap-2">
        {topCorrelations.map((correlation, index) => (
          <CorrelationItem
            key={`${correlation.type}-${correlation.label}`}
            correlation={correlation}
            overallAvg={summary.overallAvg}
            isDark={isDark}
            isLast={index === topCorrelations.length - 1}
          />
        ))}
      </View>

      {/* Footer */}
      <View className="mt-4 pt-3 border-t border-paper-200 dark:border-paper-800">
        <Text className="text-xs text-center text-sand-500 dark:text-sand-400">
          Lower values indicate better moods ({formatDelta(-1)} = better)
        </Text>
      </View>
    </View>
  );
}

interface CorrelationItemProps {
  correlation: CorrelationResult;
  overallAvg: number;
  isDark: boolean;
  isLast: boolean;
}

function CorrelationItem({ correlation, overallAvg, isDark, isLast }: CorrelationItemProps) {
  const deltaColor = correlation.isPositive
    ? isDark ? "#A8C5A8" : "#5B8A5B"
    : isDark ? "#F5A899" : "#C75441";

  const typeLabel = {
    emotion: "Emotion",
    context: "Context",
    time_of_day: "Time",
    day_of_week: "Day",
    energy: "Energy",
  }[correlation.type];

  return (
    <View
      className={`flex-row items-center py-2 ${
        !isLast ? "border-b border-paper-200 dark:border-paper-800" : ""
      }`}
    >
      {/* Icon */}
      <View
        className={`w-8 h-8 rounded-xl items-center justify-center mr-3 ${
          correlation.isPositive
            ? "bg-sage-100 dark:bg-sage-600/20"
            : "bg-coral-100 dark:bg-coral-600/20"
        }`}
      >
        <Ionicons
          name={correlation.icon as keyof typeof Ionicons.glyphMap}
          size={16}
          color={deltaColor}
        />
      </View>

      {/* Label & Type */}
      <View className="flex-1">
        <Text className="text-sm font-medium text-paper-800 dark:text-paper-200">
          {correlation.label}
        </Text>
        <Text className="text-xs text-sand-500 dark:text-sand-400">
          {typeLabel} ({correlation.count} entries)
        </Text>
      </View>

      {/* Delta Badge */}
      <View
        className={`px-2 py-1 rounded-lg ${
          correlation.isPositive
            ? "bg-sage-100 dark:bg-sage-600/20"
            : "bg-coral-100 dark:bg-coral-600/20"
        }`}
      >
        <Text
          className="text-xs font-semibold"
          style={{ color: deltaColor }}
        >
          {formatDelta(correlation.delta)}
        </Text>
      </View>

      {/* Average Badge */}
      <View className="ml-2 px-2 py-1 rounded-lg bg-paper-100 dark:bg-paper-800">
        <Text className="text-xs text-sand-600 dark:text-sand-300">
          {correlation.avgMood.toFixed(1)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadowLight: {
    shadowColor: "#9D8660",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardShadowDark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 3,
  },
});
