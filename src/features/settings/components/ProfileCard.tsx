import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";

interface ProfileCardProps {
  entryCount: number;
  daysTracking: number;
}

export function ProfileCard({ entryCount, daysTracking }: ProfileCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View
      className="mb-6 rounded-3xl bg-paper-50 dark:bg-paper-850 overflow-hidden"
      style={isDark ? styles.cardShadowDark : styles.cardShadowLight}
    >
      {/* Decorative sage accent bar */}
      <View className="h-1 bg-sage-400 dark:bg-sage-500" />

      <View className="p-5">
        {/* App Identity */}
        <View className="flex-row items-center mb-5">
          {/* App Icon with layered background */}
          <View className="relative mr-4">
            <View className="w-16 h-16 rounded-2xl items-center justify-center bg-sage-100 dark:bg-sage-600/20">
              {/* Subtle inner glow effect */}
              <View className="absolute w-12 h-12 rounded-xl bg-sage-500/10 dark:bg-sage-300/15" />
              <Text className="text-3xl">🌿</Text>
            </View>
          </View>

          {/* App Info */}
          <View className="flex-1">
            <Text className="text-xl font-bold text-paper-800 dark:text-paper-200 tracking-tight">
              Moodinator
            </Text>
            <Text className="text-sm text-sand-500 dark:text-sand-400 mt-0.5">
              Your wellness companion
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="flex-row gap-3">
          {/* Entries Stat */}
          <View className="flex-1 p-4 rounded-2xl bg-sage-100 dark:bg-sage-600/20">
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 rounded-xl items-center justify-center mr-2 bg-sage-500/15 dark:bg-sage-300/20">
                <Ionicons
                  name="document-text"
                  size={16}
                  color={isDark ? "#A8C5A8" : "#5B8A5B"}
                />
              </View>
              <Text className="text-xs font-medium uppercase tracking-wider text-sage-500 dark:text-sage-300">
                Entries
              </Text>
            </View>
            <Text className="text-2xl font-extrabold text-sage-500 dark:text-sage-300 tracking-tighter">
              {entryCount.toLocaleString()}
            </Text>
          </View>

          {/* Days Stat */}
          <View className="flex-1 p-4 rounded-2xl bg-sand-100 dark:bg-sand-800">
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 rounded-xl items-center justify-center mr-2 bg-sand-600/12 dark:bg-sand-400/20">
                <Ionicons
                  name="calendar"
                  size={16}
                  color={isDark ? "#D4C4A0" : "#9D8660"}
                />
              </View>
              <Text className="text-xs font-medium uppercase tracking-wider text-sand-500 dark:text-sand-400">
                Days
              </Text>
            </View>
            <Text className="text-2xl font-extrabold text-sand-600 dark:text-sand-300 tracking-tighter">
              {daysTracking.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadowLight: {
    elevation: 4,
    shadowColor: "#9D8660",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  cardShadowDark: {
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
});
