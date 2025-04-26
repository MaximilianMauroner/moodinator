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
import { format } from "date-fns";
import { SafeAreaView } from "react-native-safe-area-context";
import { Circle } from "react-native-svg";
import { moodScale } from "@/constants/moodScale";

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
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="mt-1 flex gap-2 flex-row justify-between items-center p-4">
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
              className="text-3xl font-extrabold text-center mb-2"
              style={{ color: "#5DADE2" }}
            >
              Chart
            </Text>
            <Text className="font-semibold" style={{ color: "#9B59B6" }}>
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
        {moodCount > 0 && <DisplayMoodChart />}
      </ScrollView>
    </SafeAreaView>
  );
}

const DisplayMoodChart = () => {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMoods = async () => {
    const allMoods = await getAllMoods();
    setMoods(allMoods);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchMoods();
  }, []);

  // Add helper function to get color from Tailwind class
  const getColorFromTailwind = (colorClass: string) => {
    const colorMap: Record<string, string> = {
      "text-emerald-500": "#10B981",
      "text-green-500": "#22C55E",
      "text-lime-500": "#84CC16",
      "text-yellow-500": "#EAB308",
      "text-amber-500": "#F59E0B",
      "text-blue-500": "#3B82F6",
      "text-indigo-500": "#6366F1",
      "text-violet-500": "#8B5CF6",
      "text-purple-500": "#A855F7",
      "text-pink-500": "#EC4899",
      "text-red-500": "#EF4444",
    };
    return colorMap[colorClass] || "#FFD700";
  };

  const chartData = useMemo(() => {
    return {
      labels: moods.map((m) => format(new Date(m.timestamp), "HH d/M")),
      datasets: [
        {
          data: moods.map((m) => m.mood),
          strokeWidth: 3,
          dotColor: moods.map((m) =>
            getColorFromTailwind(moodScale[m.mood].color)
          ),
        },
      ],
    };
  }, [moods]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#5DADE2" />
      </View>
    );
  }

  if (!moods.length) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text style={{ color: "#9B59B6" }}>No mood data available.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="mx-4"
      horizontal={true}
      showsHorizontalScrollIndicator={true}
    >
      <LineChart
        data={chartData}
        width={Math.max(
          Dimensions.get("window").width * 1.5,
          moods.length * 60
        )}
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
        renderDotContent={({ x, y, index }) => (
          <Circle
            key={index}
            cx={x}
            cy={y}
            r="5"
            fill={chartData.datasets[0].dotColor[index]}
            stroke={chartData.datasets[0].dotColor[index]}
          />
        )}
      />
    </ScrollView>
  );
};
