import React from "react";
import { View, Text, ScrollView, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { format } from "date-fns";
import type { MoodEntry } from "@db/types";
import { Circle, Line } from "react-native-svg";
import {
  processMoodDataForDailyChart,
  getBaseChartConfig,
  getColorFromTailwind,
  getMoodInterpretation,
} from "./ChartComponents";
import { moodScale } from "@/constants/moodScale";

export const DailyTab = ({ moods }: { moods: MoodEntry[] }) => {
  const processedData = processMoodDataForDailyChart(moods);

  if (!processedData?.dailyAggregates.length) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-gray-500 text-center text-lg">
          No daily mood data available yet
        </Text>
      </View>
    );
  }

  const reversedLabels = processedData.labels.slice().reverse();
  const reversedAggregates = processedData.dailyAggregates.slice().reverse();

  // Daily statistics
  const dailyStats = {
    bestDay: Math.min(...reversedAggregates.map((d) => d.finalAvg)),
    worstDay: Math.max(...reversedAggregates.map((d) => d.finalAvg)),
    averageDay:
      reversedAggregates.reduce((sum, d) => sum + d.finalAvg, 0) /
      reversedAggregates.length,
    daysWithEntries: reversedAggregates.filter(
      (d) => d.moods && d.moods.length > 0
    ).length,
    totalDays: reversedAggregates.length,
  };

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
    <ScrollView className="flex-1">
      <Text className="text-xl font-semibold text-center mb-4 text-indigo-600 mx-4">
        📈 Daily Mood Analysis
      </Text>

      {/* Daily Statistics Summary */}
      <View className="mx-4 mb-6 bg-white p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Daily Statistics
        </Text>
        <View className="flex-row justify-between mb-3">
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Best Day</Text>
            <Text className="text-lg font-bold text-green-600">
              {dailyStats.bestDay.toFixed(1)}
            </Text>
            <Text className="text-xs text-gray-400">
              {getMoodInterpretation(dailyStats.bestDay).text}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Challenging Day</Text>
            <Text className="text-lg font-bold text-red-600">
              {dailyStats.worstDay.toFixed(1)}
            </Text>
            <Text className="text-xs text-gray-400">
              {getMoodInterpretation(dailyStats.worstDay).text}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Average</Text>
            <Text className="text-lg font-bold text-blue-600">
              {dailyStats.averageDay.toFixed(1)}
            </Text>
            <Text className="text-xs text-gray-400">
              {getMoodInterpretation(dailyStats.averageDay).text}
            </Text>
          </View>
        </View>
        <View className="flex-row justify-between">
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Days Tracked</Text>
            <Text className="text-lg font-bold text-purple-600">
              {dailyStats.daysWithEntries}
            </Text>
            <Text className="text-xs text-gray-400">
              of {dailyStats.totalDays} days
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Consistency</Text>
            <Text className="text-lg font-bold text-teal-600">
              {(
                (dailyStats.daysWithEntries / dailyStats.totalDays) *
                100
              ).toFixed(0)}
              %
            </Text>
            <Text className="text-xs text-gray-400">tracking rate</Text>
          </View>
        </View>
      </View>

      {/* Recent Days Summary */}
      <View className="mx-4 mb-6">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Recent Days
        </Text>
        {reversedAggregates.slice(0, 7).map((day, index) => {
          const interpretation = getMoodInterpretation(day.finalAvg);
          const hasRealData = day.moods && day.moods.length > 0;

          return (
            <View
              key={day.date.toString()}
              className="bg-white p-4 rounded-xl mb-3 shadow-sm"
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="font-semibold text-gray-800">
                    {format(day.date, "EEEE, MMM dd")}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {hasRealData
                      ? `${day.moods!.length} entries • Range: ${day.min}-${
                          day.max
                        }`
                      : "Interpolated data"}
                  </Text>
                  {hasRealData && day.moods!.length > 1 && (
                    <Text className="text-xs text-gray-400 mt-1">
                      Individual moods: {day.moods!.join(", ")}
                    </Text>
                  )}
                </View>
                <View className="items-end">
                  <Text
                    className={`text-2xl font-bold ${
                      interpretation.color === "green"
                        ? "text-green-600"
                        : interpretation.color === "blue"
                        ? "text-blue-600"
                        : interpretation.color === "yellow"
                        ? "text-yellow-600"
                        : interpretation.color === "orange"
                        ? "text-orange-600"
                        : "text-red-600"
                    }`}
                  >
                    {day.finalAvg.toFixed(1)}
                  </Text>
                  <View
                    className={`px-2 py-1 rounded mt-1 ${
                      interpretation.color === "green"
                        ? "bg-green-100"
                        : interpretation.color === "blue"
                        ? "bg-blue-100"
                        : interpretation.color === "yellow"
                        ? "bg-yellow-100"
                        : interpretation.color === "orange"
                        ? "bg-orange-100"
                        : "bg-red-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        interpretation.color === "green"
                          ? "text-green-700"
                          : interpretation.color === "blue"
                          ? "text-blue-700"
                          : interpretation.color === "yellow"
                          ? "text-yellow-700"
                          : interpretation.color === "orange"
                          ? "text-orange-700"
                          : "text-red-700"
                      }`}
                    >
                      {interpretation.text}
                    </Text>
                  </View>
                  {!hasRealData && (
                    <Text className="text-xs text-gray-400 mt-1">
                      (estimated)
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Daily Chart */}
      <View className="bg-white mx-4 p-4 rounded-2xl shadow-lg mb-6">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Daily Mood Trend
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={chartData}
            width={Math.max(
              Dimensions.get("window").width - 32,
              processedData.labels.length * 60
            )}
            height={300}
            chartConfig={getBaseChartConfig("#7986CB", "#5C6BC0")}
            style={{ borderRadius: 16 }}
            bezier
            segments={10}
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

      {/* Daily Patterns Analysis */}
      <View className="mx-4 mb-6 bg-white p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Patterns & Insights
        </Text>

        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Most Consistent Period
          </Text>
          <Text className="text-sm text-gray-600">
            Last 7 days have{" "}
            {dailyStats.daysWithEntries >= 5 ? "excellent" : "good"} tracking
            consistency
          </Text>
        </View>

        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Trend Direction
          </Text>
          <Text className="text-sm text-gray-600">
            {reversedAggregates.length >= 7
              ? reversedAggregates
                  .slice(0, 3)
                  .reduce((sum, d) => sum + d.finalAvg, 0) /
                  3 <
                reversedAggregates
                  .slice(-3)
                  .reduce((sum, d) => sum + d.finalAvg, 0) /
                  3
                ? "Recent days show improvement compared to a week ago"
                : "Consider what might help improve recent patterns"
              : "More data needed for trend analysis"}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};
