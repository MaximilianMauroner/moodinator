import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
  StyleSheet,
} from "react-native";
import { useColorScheme } from "nativewind";
import { Ionicons } from "@expo/vector-icons";
import PagerView from "react-native-pager-view";

import { useSettingsStore } from "@/shared/state/settingsStore";
import { haptics } from "@/lib/haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  emoji: string;
  title: string;
  description: string;
  accentColor: "sage" | "dusk" | "sand" | "coral";
}

const slides: OnboardingSlide[] = [
  {
    id: "welcome",
    icon: "heart",
    emoji: "👋",
    title: "Welcome to Moodinator",
    description:
      "Your personal mood journal. Track how you feel, discover patterns, and understand yourself better.",
    accentColor: "sage",
  },
  {
    id: "track",
    icon: "add-circle",
    emoji: "📊",
    title: "Track Your Mood",
    description:
      "Tap the mood button to log how you're feeling. Add emotions, context, and notes for deeper insights.",
    accentColor: "dusk",
  },
  {
    id: "insights",
    icon: "bar-chart",
    emoji: "💡",
    title: "Discover Insights",
    description:
      "View patterns over time, see correlations between your mood and activities, and celebrate your progress.",
    accentColor: "sand",
  },
  {
    id: "privacy",
    icon: "lock-closed",
    emoji: "🔒",
    title: "Private & Secure",
    description:
      "All your data stays on your device. No accounts, no cloud, no tracking. Your thoughts are yours alone.",
    accentColor: "coral",
  },
];

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const setHasCompletedOnboarding = useSettingsStore(
    (state) => state.setHasCompletedOnboarding
  );

  const accentColors = {
    sage: {
      iconBg: isDark ? "#2D3D2D" : "#E8EFE8",
      iconColor: isDark ? "#A8C5A8" : "#5B8A5B",
      dotActive: isDark ? "#A8C5A8" : "#5B8A5B",
    },
    dusk: {
      iconBg: isDark ? "#2D2A33" : "#EFECF2",
      iconColor: isDark ? "#C4BBCF" : "#695C78",
      dotActive: isDark ? "#C4BBCF" : "#695C78",
    },
    sand: {
      iconBg: isDark ? "#302A22" : "#F9F5ED",
      iconColor: isDark ? "#D4C4A0" : "#7A6545",
      dotActive: isDark ? "#D4C4A0" : "#7A6545",
    },
    coral: {
      iconBg: isDark ? "#3D2822" : "#FDE8E4",
      iconColor: isDark ? "#F5A899" : "#E06B55",
      dotActive: isDark ? "#F5A899" : "#E06B55",
    },
  };

  const handleComplete = useCallback(async () => {
    haptics.patterns.successCelebration();
    await setHasCompletedOnboarding(true);
    onComplete();
  }, [setHasCompletedOnboarding, onComplete]);

  const handleSkip = useCallback(async () => {
    haptics.light();
    await setHasCompletedOnboarding(true);
    onComplete();
  }, [setHasCompletedOnboarding, onComplete]);

  const handleNext = useCallback(() => {
    haptics.patterns.onboardingStep();
    if (currentPage < slides.length - 1) {
      pagerRef.current?.setPage(currentPage + 1);
    } else {
      handleComplete();
    }
  }, [currentPage, handleComplete]);

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      setCurrentPage(e.nativeEvent.position);
    },
    []
  );

  const currentSlide = slides[currentPage];
  const colors = accentColors[currentSlide.accentColor];
  const isLastPage = currentPage === slides.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleSkip}
    >
      <View
        className="flex-1"
        style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
      >
        {/* Skip Button */}
        <View className="absolute top-14 right-4 z-10">
          <TouchableOpacity
            onPress={handleSkip}
            className="px-4 py-2 rounded-full"
            style={{ backgroundColor: isDark ? "#2A252020" : "#E5D9BF30" }}
          >
            <Text
              className="font-medium"
              style={{ color: isDark ? "#BDA77D" : "#6B5C4A" }}
            >
              Skip
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pager */}
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={0}
          onPageSelected={handlePageSelected}
        >
          {slides.map((slide, index) => {
            const slideColors = accentColors[slide.accentColor];
            return (
              <View key={slide.id} className="flex-1 justify-center items-center px-8">
                {/* Icon Container */}
                <View
                  className="w-32 h-32 rounded-[40px] items-center justify-center mb-8"
                  style={{
                    backgroundColor: slideColors.iconBg,
                    shadowColor: isDark ? "#000" : "#9D8660",
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: isDark ? 0.4 : 0.15,
                    shadowRadius: 24,
                    elevation: 8,
                  }}
                >
                  <Text className="text-6xl">{slide.emoji}</Text>
                </View>

                {/* Title */}
                <Text
                  className="text-2xl font-bold text-center mb-4"
                  style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
                >
                  {slide.title}
                </Text>

                {/* Description */}
                <Text
                  className="text-base text-center leading-6 px-4"
                  style={{ color: isDark ? "#BDA77D" : "#6B5C4A" }}
                >
                  {slide.description}
                </Text>
              </View>
            );
          })}
        </PagerView>

        {/* Bottom Section */}
        <View className="px-8 pb-12">
          {/* Page Indicators */}
          <View className="flex-row justify-center items-center mb-8">
            {slides.map((slide, index) => {
              const isActive = index === currentPage;
              const dotColor = isActive
                ? colors.dotActive
                : isDark
                ? "#3D352A"
                : "#E5D9BF";

              return (
                <TouchableOpacity
                  key={slide.id}
                  onPress={() => {
                    haptics.selection();
                    pagerRef.current?.setPage(index);
                  }}
                  className="mx-1.5"
                >
                  <View
                    style={{
                      width: isActive ? 24 : 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: dotColor,
                    }}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            onPress={handleNext}
            className="flex-row items-center justify-center py-4 px-8 rounded-2xl"
            style={{
              backgroundColor: colors.iconBg,
              shadowColor: isDark ? "#000" : "#9D8660",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.3 : 0.15,
              shadowRadius: 12,
              elevation: 4,
            }}
            activeOpacity={0.8}
          >
            <Text
              className="text-lg font-bold mr-2"
              style={{ color: colors.iconColor }}
            >
              {isLastPage ? "Get Started" : "Next"}
            </Text>
            <Ionicons
              name={isLastPage ? "checkmark-circle" : "arrow-forward"}
              size={22}
              color={colors.iconColor}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
});
