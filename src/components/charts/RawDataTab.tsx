import React from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  RefreshControl,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { format } from "date-fns";
import type { MoodEntry } from "@db/types";
import { Circle } from "react-native-svg";
import {
  getColorFromTailwind,
  getBaseChartConfig,
  getMoodInterpretation,
} from "./ChartComponents";
import { moodScale } from "@/constants/moodScale";

export const RawDataTab = ({
  moods,
  onRefresh,
}: {
  moods: MoodEntry[];
  onRefresh: () => void;
}) => {
  if (!moods.length) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-gray-500 text-center text-lg">
          No mood data available yet
        </Text>
      </View>
    );
  }

  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  // Sort moods by timestamp for chronological display
  const sortedMoods = [...moods].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Raw data statistics
  const rawStats = {
    totalEntries: moods.length,
    averageMood: moods.reduce((sum, mood) => sum + mood.mood, 0) / moods.length,
    bestMood: Math.min(...moods.map((m) => m.mood)),
    worstMood: Math.max(...moods.map((m) => m.mood)),
    entriesWithNotes: moods.filter((m) => m.note && m.note.trim().length > 0)
      .length,
    moodDistribution: moodScale
      .map((scale) => ({
        ...scale,
        count: moods.filter((mood) => mood.mood === scale.value).length,
        percentage:
          (moods.filter((mood) => mood.mood === scale.value).length /
            moods.length) *
          100,
      }))
      .filter((item) => item.count > 0),
  };

  const chartData = {
    labels: sortedMoods.map((m) => format(new Date(m.timestamp), "M/d HH:mm")),
    datasets: [
      {
        data: sortedMoods.map((m) => m.mood),
        strokeWidth: 3,
        dotColor: sortedMoods.map((m) =>
          getColorFromTailwind(moodScale[m.mood].color)
        ),
      },
      {
        data: [0], // Min value for y-axis
        withDots: false,
      },
      {
        data: [10], // Max value for y-axis
        withDots: false,
      },
    ],
  };

  return (
    <ScrollView
      className="flex-1"
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} />
      }
    >
      <Text className="text-xl font-semibold text-center mb-4 text-purple-600 mx-4">
        🔬 Raw Mood Data Analysis
      </Text>

      {/* Raw Data Statistics */}
      <View className="mx-4 mb-6 bg-white p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Data Overview
        </Text>
        <View className="flex-row justify-between mb-3">
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Total Entries</Text>
            <Text className="text-lg font-bold text-purple-600">
              {rawStats.totalEntries}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500">With Notes</Text>
            <Text className="text-lg font-bold text-blue-600">
              {rawStats.entriesWithNotes}
            </Text>
            <Text className="text-xs text-gray-400">
              {(
                (rawStats.entriesWithNotes / rawStats.totalEntries) *
                100
              ).toFixed(0)}
              %
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Average</Text>
            <Text className="text-lg font-bold text-indigo-600">
              {rawStats.averageMood.toFixed(1)}
            </Text>
            <Text className="text-xs text-gray-400">
              {getMoodInterpretation(rawStats.averageMood).text}
            </Text>
          </View>
        </View>
        <View className="flex-row justify-between">
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Best Entry</Text>
            <Text
              className={`text-lg font-bold ${
                moodScale[rawStats.bestMood]?.color || "text-gray-600"
              }`}
            >
              {rawStats.bestMood}
            </Text>
            <Text className="text-xs text-gray-400">
              {moodScale[rawStats.bestMood]?.label}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Most Challenging</Text>
            <Text
              className={`text-lg font-bold ${
                moodScale[rawStats.worstMood]?.color || "text-gray-600"
              }`}
            >
              {rawStats.worstMood}
            </Text>
            <Text className="text-xs text-gray-400">
              {moodScale[rawStats.worstMood]?.label}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Range</Text>
            <Text className="text-lg font-bold text-gray-600">
              {rawStats.worstMood - rawStats.bestMood}
            </Text>
            <Text className="text-xs text-gray-400">points span</Text>
          </View>
        </View>
      </View>

      {/* Mood Distribution */}
      <View className="mx-4 mb-6 bg-white p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Mood Distribution
        </Text>
        {rawStats.moodDistribution.map((item, index) => (
          <View
            key={item.value}
            className="flex-row items-center justify-between mb-2 last:mb-0"
          >
            <View className="flex-row items-center flex-1">
              <View
                className="w-4 h-4 rounded mr-3"
                style={{ backgroundColor: getColorFromTailwind(item.color) }}
              />
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700">
                  {item.label}
                </Text>
                <Text className="text-xs text-gray-500">
                  {item.description}
                </Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-sm font-bold text-gray-800">
                {item.count}
              </Text>
              <Text className="text-xs text-gray-500">
                {item.percentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Recent Entries */}
      <View className="mx-4 mb-6">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Recent Entries
        </Text>
        {sortedMoods
          .slice(-10)
          .reverse()
          .map((mood, index) => {
            const interpretation = getMoodInterpretation(mood.mood);
            return (
              <View
                key={mood.id}
                className="bg-white p-4 rounded-xl mb-3 shadow-sm"
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-800">
                      {format(
                        new Date(mood.timestamp),
                        "EEEE, MMM dd 'at' HH:mm"
                      )}
                    </Text>
                    {mood.note && (
                      <Text className="text-sm text-gray-600 mt-1 italic">
                        "{mood.note}"
                      </Text>
                    )}
                    <Text className="text-xs text-gray-400 mt-1">
                      {moodScale[mood.mood]?.description}
                    </Text>
                  </View>
                  <View className="items-end ml-4">
                    <Text
                      className={`text-2xl font-bold ${interpretation.textClass}`}
                    >
                      {mood.mood}
                    </Text>
                    <View
                      className={`px-2 py-1 rounded mt-1 ${interpretation.bgClass}`}
                    >
                      <Text
                        className={`text-xs font-medium ${interpretation.textClass}`}
                      >
                        {moodScale[mood.mood]?.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
      </View>

      {/* Raw Data Chart */}
      <View className="bg-white mx-4 p-4 rounded-2xl shadow-lg mb-6">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Complete Timeline
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: 10 }}
        >
          <LineChart
            data={chartData}
            width={Math.max(
              Dimensions.get("window").width - 64,
              chartData.labels.length * 40
            )}
            height={300}
            chartConfig={getBaseChartConfig("#9B59B6", "#8E44AD")}
            style={{ borderRadius: 16 }}
            withVerticalLines={true}
            segments={10}
            bezier
            renderDotContent={({ x, y, index }) =>
              chartData.datasets[0] &&
              Array.isArray(chartData.datasets[0].dotColor) &&
              chartData.datasets[0].dotColor[index] && (
                <Circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="5"
                  fill={chartData.datasets[0].dotColor[index]}
                  stroke={chartData.datasets[0].dotColor[index]}
                />
              )
            }
          />
        </ScrollView>
      </View>

      {/* Data Insights */}
      <View className="mx-4 mb-6 bg-white p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Data Insights
        </Text>

        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Most Common Mood
          </Text>
          <Text className="text-sm text-gray-600">
            {rawStats.moodDistribution[0]?.label} (
            {rawStats.moodDistribution[0]?.count} entries,{" "}
            {rawStats.moodDistribution[0]?.percentage.toFixed(1)}%)
          </Text>
        </View>

        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Note-Taking Frequency
          </Text>
          <Text className="text-sm text-gray-600">
            {rawStats.entriesWithNotes > rawStats.totalEntries * 0.7
              ? "Excellent documentation - notes help track patterns!"
              : rawStats.entriesWithNotes > rawStats.totalEntries * 0.3
              ? "Good note-taking - consider adding more context when possible"
              : "Consider adding notes to better understand mood patterns"}
          </Text>
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Mood Variability
          </Text>
          <Text className="text-sm text-gray-600">
            {rawStats.worstMood - rawStats.bestMood <= 3
              ? "Low variability - relatively stable mood patterns"
              : rawStats.worstMood - rawStats.bestMood <= 6
              ? "Moderate variability - some ups and downs"
              : "High variability - wide range of experiences tracked"}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};
