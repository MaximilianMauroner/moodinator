import React, { useEffect, useState, useCallback } from "react";
import { AccessibilityInfo, BackHandler, View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import { useOnboardingStore } from "../store/onboardingStore";
import { OnboardingPage } from "../components/OnboardingPage";
import { OnboardingPagination } from "../components/OnboardingPagination";
import { onboardingPages } from "../content";

export function OnboardingScreen() {
  const { isDark, get } = useThemeColors();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const { complete } = useOnboardingStore();

  const isFirstPage = currentIndex === 0;
  const isLastPage = currentIndex === onboardingPages.length - 1;
  const currentPage = onboardingPages[currentIndex];

  const handleNext = useCallback(() => {
    if (isLastPage) {
      haptics.success();
      void complete();
    } else {
      const nextIndex = currentIndex + 1;

      haptics.light();
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, isLastPage, complete]);

  const handleBack = useCallback(() => {
    if (isFirstPage) return;

    const previousIndex = currentIndex - 1;

    haptics.light();
    setCurrentIndex(previousIndex);
  }, [currentIndex, isFirstPage]);

  const handleSkip = useCallback(() => {
    haptics.light();
    void complete();
  }, [complete]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Page ${currentIndex + 1} of ${onboardingPages.length}: ${currentPage.title}`
    );
  }, [currentIndex, currentPage.title]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isFirstPage) {
        return false;
      }

      handleBack();
      return true;
    });

    return () => subscription.remove();
  }, [handleBack, isFirstPage]);

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: get("background") }}
      edges={["top", "bottom"]}
    >
      {/* Top controls */}
      <View className="px-6 pt-2 flex-row items-center justify-between">
        {!isFirstPage ? (
          <Pressable
            onPress={handleBack}
            className="flex-row items-center px-4 py-2 rounded-xl"
            style={{
              backgroundColor: isDark ? "rgba(42, 37, 32, 0.8)" : "rgba(245, 241, 232, 0.9)",
            }}
            accessibilityRole="button"
            accessibilityLabel="Previous onboarding page"
          >
            <Ionicons
              name="arrow-back"
              size={16}
              color={get("textMuted")}
            />
            <Text
              className="text-sm font-medium ml-1"
              style={{ color: get("textMuted") }}
            >
              Back
            </Text>
          </Pressable>
        ) : (
          <View />
        )}

        {!isLastPage ? (
          <Pressable
            onPress={handleSkip}
            className="px-4 py-2 rounded-xl"
            style={{
              backgroundColor: isDark ? "rgba(42, 37, 32, 0.8)" : "rgba(245, 241, 232, 0.9)",
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text
              className="text-sm font-medium"
              style={{ color: get("textMuted") }}
            >
              Skip
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      {/* Page */}
      <OnboardingPage
        key={currentPage.id}
        page={currentPage}
        isActive
        reduceMotion={reduceMotion}
      />

      {/* Bottom section */}
      <View className="px-6 pb-6">
        {/* Pagination dots */}
        <OnboardingPagination
          total={onboardingPages.length}
          current={currentIndex}
        />
        <Text
          className="text-xs text-center mb-3"
          style={{ color: get("textMuted") }}
          accessibilityLiveRegion="polite"
        >
          Page {currentIndex + 1} of {onboardingPages.length}
        </Text>

        {/* Action button */}
        <Animated.View>
          <Pressable
            onPress={handleNext}
            className="flex-row items-center justify-center py-4 rounded-2xl"
            style={{
              backgroundColor: get("primary"),
              shadowColor: isDark ? "#000" : "#5B8A5B",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.3 : 0.25,
              shadowRadius: 16,
              elevation: 6,
            }}
            accessibilityRole="button"
            accessibilityLabel={isLastPage ? "Get started" : "Next onboarding page"}
          >
            <Text className="text-base font-bold mr-2" style={{ color: get("onPrimary") }}>
              {isLastPage ? "Get Started" : "Next"}
            </Text>
            <Ionicons
              name={isLastPage ? "checkmark" : "arrow-forward"}
              size={20}
              color={get("onPrimary")}
            />
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
