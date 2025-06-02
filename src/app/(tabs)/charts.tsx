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
      await seedMoods();
    } finally {
      setLoading(null);
    }
  }, []);

  const handleClearMoods = useCallback(async () => {
    setLoading("clear");
    try {
      await clearMoods();
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
          <View className="mt-1 flex gap-2 flex-row justify-center items-center p-4">
            {__DEV__ && (
              <Pressable
                onPress={handleSeedMoods}
                className="bg-blue-500 px-4 py-2 rounded "
              >
                {loading === "seed" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Seed Moods</Text>
                )}
              </Pressable>
            )}
            <View className="flex flex-row justify-center items-center">
              <Text
                className="text-3xl font-extrabold text-center"
                style={{ color: "#5DADE2" }}
              >
                Chart
              </Text>
              <Text className="font-semibold pl-2" style={{ color: "#9B59B6" }}>
                ({moodCount})
              </Text>
            </View>
            {__DEV__ && (
              <Pressable
                onPress={handleClearMoods}
                className="bg-red-500 px-4 py-2 rounded"
              >
                {loading === "clear" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Clear Moods</Text>
                )}
              </Pressable>
            )}
          </View>
          {moodCount > 0 && <DisplayMoodChart moods={moods} />}
          {moodCount > 0 && <DisplayDailyMoodChart moods={moods} />}
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

const DisplayMoodChart = ({ moods }: { moods: MoodEntry[] }) => {
  if (!moods.length) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text style={{ color: "#9B59B6" }}>No mood data available.</Text>
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
          backgroundGradientTo: "#9B59B6",
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(245, 245, 220, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(245, 245, 220, ${opacity})`,
          style: {
            borderRadius: 16,
          },
          propsForDots: {
            r: "4", // Slightly smaller dots
            strokeWidth: "1",
          },
          propsForLabels: {
            fontSize: 10, // Smaller font size for labels
          },
          fillShadowGradientFrom: "#9B59B6",
          fillShadowGradientTo: "transparent",
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
  );
};

const DisplayDailyMoodChart = ({ moods }: { moods: MoodEntry[] }) => {
  const processedData = processMoodDataForDailyChart(moods);
  if (!processedData?.dailyAggregates.length) {
    return (
      <View className="my-4 py-10">
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
    <View className="my-8">
      <Text
        className="text-xl font-semibold text-center mb-3"
        style={{ color: "#27AE60" }}
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
            backgroundColor: "#E8F8F5",
            backgroundGradientFrom: "#A9DFBF",
            backgroundGradientTo: "#A9DFBF",
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(39, 174, 96, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(25, 111, 61, ${opacity})`,
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
            fillShadowGradientFrom: "rgba(39, 174, 96, 0.5)",
            fillShadowGradientTo: "rgba(169, 223, 191, 0.1)",
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
