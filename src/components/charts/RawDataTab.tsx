import React, { useMemo } from "react";
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
  sampleDataPoints,
} from "./ChartComponents";
import { moodScale } from "@/constants/moodScale";
import { useColorScheme } from "@/hooks/useColorScheme";

export const RawDataTab = ({
  moods,
  onRefresh,
}: {
  moods: MoodEntry[];
  onRefresh: () => void;
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  // Sort moods by timestamp for chronological display
  const sortedMoods = useMemo(() => {
    return [...moods].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [moods]);

  // Raw data statistics (memoized for performance)
  const rawStats = useMemo(() => {
    const totalEntries = moods.length;
    if (totalEntries === 0) {
      return {
        totalEntries: 0,
        averageMood: 0,
        bestMood: 0,
        worstMood: 0,
        entriesWithNotes: 0,
        moodDistribution: [],
      };
    }

    let sum = 0;
    let min = 10;
    let max = 0;
    let notesCount = 0;
    const moodCounts = new Map<number, number>();

    moods.forEach((mood) => {
      sum += mood.mood;
      min = Math.min(min, mood.mood);
      max = Math.max(max, mood.mood);
      if (mood.note && mood.note.trim().length > 0) {
        notesCount++;
      }
      moodCounts.set(mood.mood, (moodCounts.get(mood.mood) || 0) + 1);
    });

    const moodDistribution = moodScale
      .map((scale) => {
        const count = moodCounts.get(scale.value) || 0;
        return {
          ...scale,
          count,
          percentage: (count / totalEntries) * 100,
        };
      })
      .filter((item) => item.count > 0);

    return {
      totalEntries,
      averageMood: sum / totalEntries,
      bestMood: min,
      worstMood: max,
      entriesWithNotes: notesCount,
      moodDistribution,
    };
  }, [moods]);

  const emotionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    moods.forEach((mood) => {
      if (Array.isArray(mood.emotions)) {
        mood.emotions.forEach((emotion) => {
          if (emotion) {
            counts[emotion] = (counts[emotion] || 0) + 1;
          }
        });
      }
    });
    return counts;
  }, [moods]);

  const contextCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    moods.forEach((mood) => {
      if (Array.isArray(mood.contextTags)) {
        mood.contextTags.forEach((context) => {
          if (context) {
            counts[context] = (counts[context] || 0) + 1;
          }
        });
      }
    });
    return counts;
  }, [moods]);

  const topEmotions = useMemo(
    () =>
      Object.entries(emotionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    [emotionCounts]
  );

  const topContexts = useMemo(
    () =>
      Object.entries(contextCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    [contextCounts]
  );

  const avgEnergy = useMemo(() => {
    const energyValues = moods
      .map((m) => (typeof m.energy === "number" ? m.energy : null))
      .filter((value): value is number => value !== null);
    return energyValues.length > 0
      ? energyValues.reduce((sum, val) => sum + val, 0) / energyValues.length
      : null;
  }, [moods]);

  // Sample chart data to max 200 points for performance
  const sampledMoods = useMemo(() => {
    return sampleDataPoints(sortedMoods, 200);
  }, [sortedMoods]);

  const chartData = useMemo(
    () => ({
      labels: sampledMoods.map((m) => format(new Date(m.timestamp), "HH:mm")),
      datasets: [
        {
          data: sampledMoods.map((m) => m.mood),
          strokeWidth: 3,
          dotColor: sampledMoods.map((m) =>
            getColorFromTailwind(moodScale[m.mood]?.color || "text-gray-500")
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
    }),
    [sampledMoods]
  );

  const recentEntries = useMemo(
    () =>
      sortedMoods
        .slice(-10)
        .reverse()
        .map((mood) => {
          const interpretation = getMoodInterpretation(mood.mood);
          return (
            <View
              key={mood.id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl mb-3 shadow-sm"
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="font-semibold text-gray-800 dark:text-slate-200">
                    {format(
                      new Date(mood.timestamp),
                      "EEEE, MMM dd 'at' HH:mm"
                    )}
                  </Text>
                  {mood.note && (
                    <Text className="text-sm text-gray-600 dark:text-slate-300 mt-1 italic">
                      "{mood.note}"
                    </Text>
                  )}
                  <Text className="text-xs text-gray-400 dark:text-slate-500 mt-1">
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
        }),
    [sortedMoods]
  );

  if (!moods.length) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-gray-500 dark:text-slate-400 text-center text-lg">
          No mood data available yet
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-transparent"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Text className="text-xl font-semibold text-center mb-4 text-purple-600 dark:text-purple-400 mx-4">
        🔬 Raw Mood Data Analysis
      </Text>

      {/* Raw Data Statistics */}
      <View className="mx-4 mb-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800 dark:text-slate-200">
          Data Overview
        </Text>
        <View className="flex-row justify-between mb-3">
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Total Entries
            </Text>
            <Text className="text-lg font-bold text-purple-600">
              {rawStats.totalEntries}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              With Notes
            </Text>
            <Text className="text-lg font-bold text-blue-600">
              {rawStats.entriesWithNotes}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-slate-500">
              {(
                (rawStats.entriesWithNotes / rawStats.totalEntries) *
                100
              ).toFixed(0)}
              %
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Average
            </Text>
            <Text className="text-lg font-bold text-indigo-600">
              {rawStats.averageMood.toFixed(1)}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-slate-500">
              {getMoodInterpretation(rawStats.averageMood).text}
            </Text>
          </View>
        </View>
        <View className="flex-row justify-between">
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Best Entry
            </Text>
            <Text
              className={`text-lg font-bold ${
                moodScale[rawStats.bestMood]?.color || "text-gray-600"
              }`}
            >
              {rawStats.bestMood}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-slate-500">
              {moodScale[rawStats.bestMood]?.label}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Most Challenging
            </Text>
            <Text
              className={`text-lg font-bold ${
                moodScale[rawStats.worstMood]?.color || "text-gray-600"
              }`}
            >
              {rawStats.worstMood}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-slate-500">
              {moodScale[rawStats.worstMood]?.label}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Range
            </Text>
            <Text className="text-lg font-bold text-gray-600">
              {rawStats.worstMood - rawStats.bestMood}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-slate-500">
              points span
            </Text>
          </View>
        </View>
      </View>

      {/* Mood Distribution */}
      <View className="mx-4 mb-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800 dark:text-slate-200">
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
                <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  {item.label}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-slate-400">
                  {item.description}
                </Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-sm font-bold text-gray-800 dark:text-slate-200">
                {item.count}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-slate-400">
                {item.percentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Recent Entries */}
      <View className="mx-4 mb-6">
        <Text className="text-lg font-semibold mb-3 text-gray-800 dark:text-slate-200">
          Recent Entries
        </Text>
        {recentEntries}
      </View>

      {/* Raw Data Chart */}
      <View className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 mx-4 p-4 rounded-2xl shadow-lg mb-6">
        <Text className="text-lg font-semibold mb-3 text-gray-800 dark:text-slate-200">
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
            chartConfig={getBaseChartConfig("#9B59B6", "#8E44AD", isDark)}
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
      <View className="mx-4 mb-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800 dark:text-slate-200">
          Data Insights
        </Text>

        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
            Most Common Mood
          </Text>
          <Text className="text-sm text-gray-600 dark:text-slate-400">
            {rawStats.moodDistribution[0]?.label} (
            {rawStats.moodDistribution[0]?.count} entries,{" "}
            {rawStats.moodDistribution[0]?.percentage.toFixed(1)}%)
          </Text>
        </View>

        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
            Note-Taking Frequency
          </Text>
          <Text className="text-sm text-gray-600 dark:text-slate-400">
            {rawStats.entriesWithNotes > rawStats.totalEntries * 0.7
              ? "Excellent documentation - notes help track patterns!"
              : rawStats.entriesWithNotes > rawStats.totalEntries * 0.3
              ? "Good note-taking - consider adding more context when possible"
              : "Consider adding notes to better understand mood patterns"}
          </Text>
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
            Mood Variability
          </Text>
          <Text className="text-sm text-gray-600 dark:text-slate-400">
            {rawStats.worstMood - rawStats.bestMood <= 3
              ? "Low variability - relatively stable mood patterns"
              : rawStats.worstMood - rawStats.bestMood <= 6
              ? "Moderate variability - some ups and downs"
              : "High variability - wide range of experiences tracked"}
          </Text>
        </View>
      </View>

      <View className="mx-4 mb-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800 dark:text-slate-200">
          Emotions, Context & Energy
        </Text>
        <View className="mb-4">
          <Text className="text-sm text-gray-500 dark:text-slate-400 mb-1">
            Top Emotions
          </Text>
          {topEmotions.length ? (
            <View className="flex-row flex-wrap gap-2">
              {topEmotions.map(([emotion, count]) => (
                <View
                  key={emotion}
                  className="px-3 py-1 rounded-full bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700"
                >
                  <Text className="text-xs font-medium text-blue-700 dark:text-slate-100">
                    {emotion} · {count}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-gray-400 dark:text-slate-500">
              No emotions logged yet.
            </Text>
          )}
        </View>

        <View className="mb-4">
          <Text className="text-sm text-gray-500 dark:text-slate-400 mb-1">
            Top Contexts
          </Text>
          {topContexts.length ? (
            <View className="flex-row flex-wrap gap-2">
              {topContexts.map(([context, count]) => (
                <View
                  key={context}
                  className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-slate-800 border border-emerald-100 dark:border-slate-700"
                >
                  <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-200">
                    {context} · {count}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-gray-400 dark:text-slate-500">
              No contexts logged yet.
            </Text>
          )}
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-500 dark:text-slate-400">
            Average Energy
          </Text>
          <Text className="text-lg font-semibold text-orange-500 dark:text-orange-300">
            {avgEnergy !== null ? `${avgEnergy.toFixed(1)}/10` : "—"}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};
