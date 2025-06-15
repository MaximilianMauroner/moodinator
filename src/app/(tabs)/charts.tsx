import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Dimensions,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { seedMoods, clearMoods, getAllMoods } from "@db/db";
import type { MoodEntry } from "@db/types";
import { format, startOfDay, addDays, isBefore, isEqual } from "date-fns";
import { SafeAreaView } from "react-native-safe-area-context";
import { Circle, Line } from "react-native-svg";
import { moodScale } from "@/constants/moodScale";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// shared Tailwind->hex color map
const colorMap: Record<string, string> = {
  "text-sky-500": "#03a9f4",
  "text-cyan-500": "#00bcd4",
  "text-teal-500": "#009688",
  "text-emerald-500": "#4caf50",
  "text-green-500": "#4caf50",
  "text-gray-500": "#9e9e9e",
  "text-lime-500": "#cddc39",
  "text-yellow-500": "#ffeb3b",
  "text-amber-500": "#ffc107",
  "text-orange-600": "#fb8c00",
  "text-red-500": "#f44336",
  "text-red-700": "#d32f2f",
};
const getColorFromTailwind = (cls: string) => colorMap[cls] || "#FFD700";

const SECTION_SPACING = 12; // 48px between sections

export default function ChartsScreen() {
  const [loading, setLoading] = useState<"seed" | "clear" | null>(null);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [moodCount, setMoodCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const getMoodCount = useCallback(async () => {
    const allMoods = await getAllMoods();
    setMoods(allMoods);
    setMoodCount(allMoods.length);
    setRefreshing(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getMoodCount();
  }, [getMoodCount]);

  useEffect(() => {
    getMoodCount();
  }, [loading, getMoodCount]);

  const handleSeedMoods = useCallback(async () => {
    setLoading("seed");
    try {
      const result = await seedMoodsFromFile();
      setLastSeedResult(result);
      console.log(`Seeded ${result.count} moods from ${result.source}`);
    } finally {
      setLoading(null);
    }
  }, []);

  const handleClearMoods = useCallback(async () => {
    setLoading("clear");
    try {
      await clearMoods();
      setLastSeedResult(null);
    } finally {
      setLoading(null);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View className="mt-1 flex gap-2 flex-row justify-center items-center p-4">
            {__DEV__ && (
              <Pressable
                onPress={handleSeedMoods}
                className="bg-blue-600 px-4 py-2 rounded-md"
              >
                {loading === "seed" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Seed Moods</Text>
                )}
              </Pressable>
            )}
            <View className="flex flex-row justify-center items-center">
              <Text className="text-3xl font-extrabold text-center text-sky-400">
                Insights
              </Text>
              <Text className="font-semibold pl-2 text-purple-600">
                ({moodCount})
              </Text>
            </View>
            {__DEV__ && (
              <Pressable
                onPress={handleClearMoods}
                className="bg-red-500 px-4 py-2 rounded-md"
              >
                {loading === "clear" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Clear Moods</Text>
                )}
              </Pressable>
            )}
          </View>

          {/* Seed Result Feedback */}
          {__DEV__ && lastSeedResult && (
            <View className="mx-4 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Text className="text-green-800 text-center font-medium">
                ✅ Loaded {lastSeedResult.count} moods from{" "}
                {lastSeedResult.source === "file" ? "JSON file" : "random data"}
              </Text>
            </View>
          )}

          {/* Tab Pills */}
          <View className="px-4 mb-6">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              <View className="flex-row space-x-2 bg-gray-100 rounded-full p-1">
                {tabs.map((tab) => (
                  <Pressable
                    key={tab.id}
                    onPress={() => setSelectedTab(tab.id)}
                    className={`flex-row items-center px-5 py-3 rounded-full ${
                      selectedTab === tab.id ? "bg-white" : "bg-transparent"
                    }`}
                  >
                    <Text className="mr-2 text-base">{tab.icon}</Text>
                    <Text
                      className={`font-semibold text-sm ${
                        selectedTab === tab.id ? "text-blue-600" : "text-gray-500"
                      }`}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Content based on selected tab */}
          <View className="min-h-screen pb-20">
            {moodCount > 0 ? (
              <>
                {selectedTab === "overview" && (
                  <OverviewContent moods={moods} />
                )}
                {selectedTab === "weekly" && <WeeklyContent moods={moods} />}
                {selectedTab === "daily" && <DailyContent moods={moods} />}
                {selectedTab === "trends" && <TrendsContent moods={moods} />}
              </>
            ) : (
              <View className="flex-1 justify-center items-center p-8 mt-20">
                <Text className="text-6xl mb-4">📊</Text>
                <Text className="text-gray-500 text-center text-lg font-semibold">
                  No mood data available yet
                </Text>
                <Text className="text-gray-400 text-center mt-2">
                  Start tracking your moods to see beautiful insights here!
                </Text>
                {__DEV__ && (
                  <Text className="text-blue-500 text-center mt-4 text-sm">
                    💡 Use "Seed Moods" button above to add sample data
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const getDaysInRange = (start: Date, end: Date): Date[] => {
  const days: Date[] = [];
  let currentDate = startOfDay(start);
  const finalDate = startOfDay(end);

  while (isBefore(currentDate, finalDate) || isEqual(currentDate, finalDate)) {
    days.push(new Date(currentDate)); // Store a new Date object
    currentDate = addDays(currentDate, 1);
  }
  return days;
};

const processMoodDataForDailyChart = (allMoods: MoodEntry[]) => {
  if (!allMoods || allMoods.length === 0) {
    return { labels: [], dailyAggregates: [] };
  }

  const sortedMoods = [...allMoods].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const minDate = new Date(sortedMoods[0].timestamp);
  const maxDate = new Date(sortedMoods[sortedMoods.length - 1].timestamp);

  const allDatesInRange = getDaysInRange(minDate, maxDate);

  const moodsByDay: Record<string, number[]> = {};
  sortedMoods.forEach((mood) => {
    const dayKey = format(startOfDay(new Date(mood.timestamp)), "yyyy-MM-dd");
    if (!moodsByDay[dayKey]) {
      moodsByDay[dayKey] = [];
    }
    moodsByDay[dayKey].push(mood.mood);
  });

  type DailyMoodAggregateWorking = {
    date: Date;
    moods: number[] | null;
    avg?: number;
    min?: number;
    max?: number;
  };

  const initialAggregates: DailyMoodAggregateWorking[] = allDatesInRange.map(
    (date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const dayMoods = moodsByDay[dateKey] || null;
      let avg, min, max;

      if (dayMoods && dayMoods.length > 0) {
        avg = dayMoods.reduce((sum, val) => sum + val, 0) / dayMoods.length;
        min = Math.min(...dayMoods);
        max = Math.max(...dayMoods);
        return { date, moods: dayMoods, avg, min, max };
      } else {
        return { date, moods: null };
      }
    }
  );

  const finalAggregates = initialAggregates.map((aggregate, index) => {
    if (aggregate.avg !== undefined) {
      return { ...aggregate, finalAvg: aggregate.avg, isInterpolated: false };
    }

    let prevIndex = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (initialAggregates[i].avg !== undefined) {
        prevIndex = i;
        break;
      }
    }

    let nextIndex = -1;
    for (let i = index + 1; i < initialAggregates.length; i++) {
      if (initialAggregates[i].avg !== undefined) {
        nextIndex = i;
        break;
      }
    }

    const prevAgg = prevIndex !== -1 ? initialAggregates[prevIndex] : null;
    const nextAgg = nextIndex !== -1 ? initialAggregates[nextIndex] : null;

    let interpolatedAvg: number;
    if (
      prevAgg &&
      nextAgg &&
      prevAgg.avg !== undefined &&
      nextAgg.avg !== undefined
    ) {
      const x0 = prevAgg.date.getTime();
      const y0 = prevAgg.avg;
      const x1 = nextAgg.date.getTime();
      const y1 = nextAgg.avg;
      const x = aggregate.date.getTime();
      if (x1 === x0) {
        interpolatedAvg = y0;
      } else {
        interpolatedAvg = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
    } else if (prevAgg && prevAgg.avg !== undefined) {
      interpolatedAvg = prevAgg.avg;
    } else if (nextAgg && nextAgg.avg !== undefined) {
      interpolatedAvg = nextAgg.avg;
    } else {
      const neutralMood = moodScale.find((s) => s.label === "Neutral");
      interpolatedAvg = neutralMood ? neutralMood.value : 3;
    }
    return { ...aggregate, finalAvg: interpolatedAvg, isInterpolated: true };
  });

  return {
    labels: finalAggregates.map((agg) => format(agg.date, "d/M")),
    dailyAggregates: finalAggregates,
  };
};

const processWeeklyMoodData = (allMoods: MoodEntry[]) => {
  if (!allMoods || allMoods.length === 0) {
    return { labels: [], weeklyAggregates: [] };
  }

  const sortedMoods = [...allMoods].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const moodsByWeek: Record<string, number[]> = {};
  sortedMoods.forEach((mood) => {
    const date = new Date(mood.timestamp);
    const weekStart = startOfDay(
      new Date(date.setDate(date.getDate() - date.getDay()))
    );
    const weekKey = format(weekStart, "yyyy-MM-dd");
    if (!moodsByWeek[weekKey]) {
      moodsByWeek[weekKey] = [];
    }
    moodsByWeek[weekKey].push(mood.mood);
  });

  const getQuartiles = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const q1Idx = Math.floor(sorted.length * 0.25);
    const q2Idx = Math.floor(sorted.length * 0.5);
    const q3Idx = Math.floor(sorted.length * 0.75);
    return {
      q1: sorted[q1Idx],
      q2: sorted[q2Idx], // median
      q3: sorted[q3Idx],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      outliers: sorted.filter(
        (v) =>
          v < sorted[q1Idx] - 1.5 * (sorted[q3Idx] - sorted[q1Idx]) ||
          v > sorted[q3Idx] + 1.5 * (sorted[q3Idx] - sorted[q1Idx])
      ),
    };
  };

  const weekKeys = Object.keys(moodsByWeek).sort().reverse(); // Reverse the order
  const weeklyAggregates = weekKeys.map((weekKey) => {
    const weekMoods = moodsByWeek[weekKey];
    const stats = getQuartiles(weekMoods);
    const avg = weekMoods.reduce((sum, val) => sum + val, 0) / weekMoods.length;

    return {
      weekStart: new Date(weekKey),
      moods: weekMoods,
      ...stats,
      avg,
      finalAvg: stats.q2, // use median instead of mean
      isInterpolated: false,
    };
  });

  return {
    labels: weeklyAggregates.map((week) => format(week.weekStart, "'W'w MMM")),
    weeklyAggregates,
  };
};

const DisplayMoodChart = ({ moods }: { moods: MoodEntry[] }) => {
  if (!moods.length) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-purple-600">No mood data available.</Text>
      </View>
    );
  }

  const chartData = useMemo(
    () => ({
      labels: moods.map((m) => format(new Date(m.timestamp), "HH:MM d/M")),
      datasets: [
        {
          data: moods.map((m) => m.mood),
          strokeWidth: 3,
          dotColor: moods.map((m) =>
            getColorFromTailwind(moodScale[m.mood].color)
          ),
        },
        {
          data: [moodScale[0].value], // min
          withDots: false,
        },
        {
          data: [moodScale[moodScale.length - 1].value], // max
          withDots: false,
        },
      ],
    }),
    [moods]
  );

  return (
    <View className={`mt-${SECTION_SPACING / 2} mb-${SECTION_SPACING}`}>
      <Text
        className="text-xl font-semibold text-center mb-3"
        style={{ color: "#9B59B6" }}
      >
        Raw Mood Data
      </Text>
      <View className="mx-4 h-0.5 bg-gray-100 mb-4" />
      <ScrollView
        className="mx-4"
        horizontal
        showsHorizontalScrollIndicator
        scrollEventThrottle={16}
      >
        <LineChart
          data={chartData}
          width={Math.max(Dimensions.get("window").width, moods.length * 60)}
          height={300}
          chartConfig={{
            backgroundColor: "#F5F5DC",
            backgroundGradientFrom: "#9B59B6",
            backgroundGradientTo: "#8E44AD",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(245, 245, 220, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(245, 245, 220, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: "4",
              strokeWidth: "1",
            },
            propsForLabels: {
              fontSize: 10,
            },
            fillShadowGradientFrom: "#9B59B6",
            fillShadowGradientTo: "rgba(142, 68, 173, 0.2)",
          }}
          style={{
            borderRadius: 16,
          }}
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
  );
};

const DisplayDailyMoodChart = ({ moods }: { moods: MoodEntry[] }) => {
  const processedData = processMoodDataForDailyChart(moods);
  if (!processedData?.dailyAggregates.length) {
    return (
      <View className="mb-8">
        <Text style={{ color: "#7DCEA0", textAlign: "center" }}>
          No daily mood data available for summary chart.
        </Text>
      </View>
    );
  }

  const reversedLabels = processedData.labels.slice().reverse();
  const reversedAggregates = processedData.dailyAggregates.slice().reverse();

  // compute dot colors based on rounded average mood
  const dotColors = reversedAggregates.map((agg) => {
    const idx = Math.round(agg.finalAvg);
    return getColorFromTailwind(moodScale[idx]?.color);
  });

  const chartData = {
    labels: reversedLabels,
    datasets: [
      {
        data: reversedAggregates.map((agg) => agg.finalAvg),
        dotColor: dotColors,
        strokeWidth: 2,
        color: (o = 1) => `rgba(255,255,255,${o})`,
      },
      {
        data: reversedAggregates.map(() => moodScale[0].value),
        withDots: false,
      },
      {
        data: reversedAggregates.map(
          () => moodScale[moodScale.length - 1].value
        ),
        withDots: false,
      },
    ],
  };

  return (
    <View className={`mb-${SECTION_SPACING}`}>
      <View className="mx-4 h-0.5 bg-gray-100 mb-4" />
      <Text
        className="text-xl font-semibold text-center mb-3"
        style={{ color: "#7986CB" }}
      >
        Daily Mood Summary
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        scrollEventThrottle={16}
        className="mx-4"
      >
        <LineChart
          data={chartData}
          width={Math.max(
            Dimensions.get("window").width - 32,
            processedData.labels.length * 60
          )}
          height={300}
          chartConfig={{
            backgroundColor: "#F5F5DC",
            backgroundGradientFrom: "#7986CB",
            backgroundGradientTo: "#5C6BC0",
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(245, 245, 220, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(245, 245, 220, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: "3",
              strokeWidth: "1",
            },
            propsForLabels: {
              fontSize: 10,
            },
            fillShadowGradientFrom: "#7986CB",
            fillShadowGradientTo: "rgba(92, 107, 192, 0.2)",
          }}
          style={{ borderRadius: 16 }}
          bezier
          segments={Math.min(10, moodScale.length - 1)}
          renderDotContent={({ x, y, index }) => {
            const agg = reversedAggregates[index];
            const startY = 240,
              endY = 15,
              split = Math.abs(startY - endY) / 10;
            const uniqueMoods = Array.from(new Set(agg.moods ?? []));
            const moodCircles = uniqueMoods.map((val) => (
              <Circle
                key={`m-${index}-${val}`}
                cx={x}
                cy={startY - split * val}
                r="3"
                fill={getColorFromTailwind(moodScale[val].color)}
                stroke={getColorFromTailwind(moodScale[val].color)}
              />
            ));
            const y1 = startY - split * (agg.min ?? agg.finalAvg);
            const y2 = startY - split * (agg.max ?? agg.finalAvg);
            const lineEl =
              agg.min !== undefined && agg.max !== undefined ? (
                <Line
                  x1={x}
                  x2={x}
                  y1={y1}
                  y2={y2}
                  stroke={dotColors[index]}
                  strokeWidth="3"
                />
              ) : null;
            return (
              <React.Fragment key={index}>
                {lineEl}
                {moodCircles}
                <Circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill={dotColors[index]}
                  stroke={dotColors[index]}
                  strokeWidth="1"
                />
              </React.Fragment>
            );
          }}
        />
      </ScrollView>
    </View>
  );
};

const DisplayWeeklyMoodChart = ({ moods }: { moods: MoodEntry[] }) => {
  const processedData = processWeeklyMoodData(moods);

  if (!processedData?.weeklyAggregates.length) {
    return (
      <View className="my-4 py-10">
        <Text style={{ color: "#7DCEA0", textAlign: "center" }}>
          No weekly mood data available for summary chart.
        </Text>
      </View>
    );
  }

  const chartData = {
    labels: processedData.labels,
    datasets: [
      {
        data: processedData.weeklyAggregates.map((agg) => agg.q2),
        strokeWidth: 2,
        color: (o = 1) => `rgba(255,255,255,${o})`,
      },
      {
        data: processedData.weeklyAggregates.map(() => moodScale[0].value),
        withDots: false,
      },
      {
        data: processedData.weeklyAggregates.map(
          () => moodScale[moodScale.length - 1].value
        ),
        withDots: false,
      },
    ],
  };

  return (
    <View className={`mb-${SECTION_SPACING * 1.5}`}>
      <View className="mx-4 h-0.5 bg-gray-100 mb-4" />
      <Text
        className="text-xl font-semibold text-center mb-3"
        style={{ color: "#673AB7" }}
      >
        Weekly Mood Distribution
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        scrollEventThrottle={16}
        className="mx-4"
      >
        <LineChart
          data={chartData}
          width={Math.max(
            Dimensions.get("window").width - 32,
            processedData.labels.length * 80 + 40
          )}
          height={340} // Increased height further
          chartConfig={{
            backgroundColor: "#673AB7",
            backgroundGradientFrom: "#673AB7",
            backgroundGradientTo: "#4527A0",
            fillShadowGradientFrom: "#673AB7",
            fillShadowGradientTo: "rgba(69, 39, 160, 0.2)",
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(245, 245, 220, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(245, 245, 220, ${opacity})`,
            style: {
              borderRadius: 16,
              paddingLeft: 15,
              paddingRight: 15,
              paddingTop: 20, // Increased top padding
              paddingBottom: 20, // Increased bottom padding
            },
            propsForDots: { r: "3", strokeWidth: "1" },
            propsForLabels: { fontSize: 10 },
          }}
          fromZero={true} // Ensure chart starts from 0
          style={{
            borderRadius: 16,
            paddingBottom: 10, // Extra padding for container
          }}
          bezier
          segments={Math.min(10, moodScale.length - 1)}
          renderDotContent={({ x, y, index }) => {
            const agg = processedData.weeklyAggregates[index];
            const startY = 280, // Increased start Y
              endY = 30; // Increased end Y
            const split = Math.abs(startY - endY) / 10;
            const boxWidth = 20; // Controls overall width of the boxplot
            const whiskerWidth = boxWidth * 0.6; // Whiskers are slightly narrower than the box

            const getColorForValue = (value: number) => {
              const roundedValue = Math.round(value);
              return getColorFromTailwind(moodScale[roundedValue]?.color);
            };

            // Calculate vertical positions
            const minY = startY - split * agg.min;
            const maxY = startY - split * agg.max;
            const q1Y = startY - split * agg.q1;
            const q2Y = startY - split * agg.q2;
            const q3Y = startY - split * agg.q3;

            // Get colors based on mood values
            const minColor = getColorForValue(agg.min);
            const maxColor = getColorForValue(agg.max);
            const q1Color = getColorForValue(agg.q1);
            const q2Color = getColorForValue(agg.q2);
            const q3Color = getColorForValue(agg.q3);

            return (
              <React.Fragment key={index}>
                {/* Whiskers */}
                <Line
                  x1={x}
                  x2={x}
                  y1={minY}
                  y2={q1Y}
                  stroke={q1Color}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <Line
                  x1={x}
                  x2={x}
                  y1={q3Y}
                  y2={maxY}
                  stroke={q3Color}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />

                {/* Min/Max caps */}
                <Line
                  x1={x - whiskerWidth / 2}
                  x2={x + whiskerWidth / 2}
                  y1={minY}
                  y2={minY}
                  stroke={minColor}
                  strokeWidth="2"
                />
                <Line
                  x1={x - whiskerWidth / 2}
                  x2={x + whiskerWidth / 2}
                  y1={maxY}
                  y2={maxY}
                  stroke={maxColor}
                  strokeWidth="2"
                />

                {/* Box edges */}
                <Line
                  x1={x - boxWidth / 2}
                  x2={x + boxWidth / 2}
                  y1={q1Y}
                  y2={q1Y}
                  stroke={q1Color}
                  strokeWidth="2"
                />
                <Line
                  x1={x - boxWidth / 2}
                  x2={x + boxWidth / 2}
                  y1={q3Y}
                  y2={q3Y}
                  stroke={q3Color}
                  strokeWidth="2"
                />

                {/* Box sides */}
                <Line
                  x1={x - boxWidth / 2}
                  x2={x - boxWidth / 2}
                  y1={q1Y}
                  y2={q3Y}
                  stroke={q2Color}
                  strokeWidth="2"
                />
                <Line
                  x1={x + boxWidth / 2}
                  x2={x + boxWidth / 2}
                  y1={q1Y}
                  y2={q3Y}
                  stroke={q2Color}
                  strokeWidth="2"
                />

                {/* Outliers */}
                {agg.outliers.map((val, i) => (
                  <Circle
                    key={`outlier-${index}-${i}`}
                    cx={x}
                    cy={startY - split * val}
                    r="3"
                    fill={getColorForValue(val)}
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="1"
                  />
                ))}
              </React.Fragment>
            );
          }}
        />
      </ScrollView>
    </View>
  );
};
