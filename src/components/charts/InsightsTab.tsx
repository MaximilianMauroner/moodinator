import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { getPatternInsights, getStreakStats, PatternInsight } from "@db/db";

export function InsightsTab() {
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [streakStats, setStreakStats] = useState<{
    currentStreak: number;
    longestStreak: number;
    totalDaysLogged: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const [insightsData, streakData] = await Promise.all([
        getPatternInsights(),
        getStreakStats(),
      ]);
      setInsights(insightsData);
      setStreakStats(streakData);
    } catch (error) {
      console.error("Failed to load insights:", error);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700";
      case "medium":
        return "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700";
      case "low":
        return "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700";
      default:
        return "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700";
    }
  };

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "bg-green-500 dark:bg-green-600";
      case "medium":
        return "bg-blue-500 dark:bg-blue-600";
      case "low":
        return "bg-slate-400 dark:bg-slate-600";
      default:
        return "bg-slate-400 dark:bg-slate-600";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "day_of_week":
        return "📅";
      case "context":
        return "📍";
      case "emotion":
        return "💭";
      case "time_of_day":
        return "🕐";
      default:
        return "💡";
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-slate-500 dark:text-slate-400 mt-4">
          Analyzing your patterns...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 dark:bg-slate-950">
      <View className="p-4 space-y-4">
        {/* Streak Stats Card */}
        {streakStats && (
          <View className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <Text className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              Your Tracking Stats
            </Text>
            <View className="space-y-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-slate-600 dark:text-slate-400">
                  Current Streak
                </Text>
                <View className="flex-row items-center">
                  <Text className="text-xl font-bold text-orange-600 dark:text-orange-400 mr-1">
                    {streakStats.currentStreak}
                  </Text>
                  <Text className="text-sm text-slate-500 dark:text-slate-400">
                    {streakStats.currentStreak === 1 ? "day" : "days"}
                  </Text>
                </View>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-slate-600 dark:text-slate-400">
                  Longest Streak
                </Text>
                <View className="flex-row items-center">
                  <Text className="text-xl font-bold text-purple-600 dark:text-purple-400 mr-1">
                    {streakStats.longestStreak}
                  </Text>
                  <Text className="text-sm text-slate-500 dark:text-slate-400">
                    {streakStats.longestStreak === 1 ? "day" : "days"}
                  </Text>
                </View>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-slate-600 dark:text-slate-400">
                  Total Days Logged
                </Text>
                <View className="flex-row items-center">
                  <Text className="text-xl font-bold text-blue-600 dark:text-blue-400 mr-1">
                    {streakStats.totalDaysLogged}
                  </Text>
                  <Text className="text-sm text-slate-500 dark:text-slate-400">
                    {streakStats.totalDaysLogged === 1 ? "day" : "days"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Pattern Insights Header */}
        <View className="mb-2">
          <Text className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Pattern Insights
          </Text>
          <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Discover patterns in your mood tracking
          </Text>
        </View>

        {/* Insights List */}
        {insights.length === 0 ? (
          <View className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 items-center">
            <Text className="text-5xl mb-3">📊</Text>
            <Text className="text-center text-slate-600 dark:text-slate-300 font-medium">
              Not enough data yet
            </Text>
            <Text className="text-center text-slate-500 dark:text-slate-400 text-sm mt-2">
              Keep tracking your moods to discover personalized insights about
              your patterns!
            </Text>
          </View>
        ) : (
          <View className="space-y-3">
            {insights.map((insight, index) => (
              <View
                key={index}
                className={`rounded-2xl p-4 border ${getConfidenceColor(
                  insight.confidence
                )}`}
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-2xl mr-2">
                      {getTypeIcon(insight.type)}
                    </Text>
                    <Text className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1">
                      {insight.title}
                    </Text>
                  </View>
                  <View
                    className={`${getConfidenceBadgeColor(
                      insight.confidence
                    )} px-2 py-1 rounded-full`}
                  >
                    <Text className="text-white text-xs font-semibold uppercase">
                      {insight.confidence}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-slate-700 dark:text-slate-300 leading-5">
                  {insight.description}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="h-4" />
      </View>
    </ScrollView>
  );
}
