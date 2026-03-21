import React, { useState, useRef, useCallback } from "react";
import { View, Text, Pressable, useWindowDimensions, FlatList, ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import { useOnboardingStore } from "../store/onboardingStore";
import { OnboardingPage } from "../components/OnboardingPage";
import { OnboardingPagination } from "../components/OnboardingPagination";
import { onboardingPages } from "../content";

export function OnboardingScreen() {
  const { isDark, get } = useThemeColors();
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { complete } = useOnboardingStore();

  const isLastPage = currentIndex === onboardingPages.length - 1;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const newIndex = viewableItems[0].index;
        if (newIndex !== currentIndex) {
          haptics.pageChange();
          setCurrentIndex(newIndex);
        }
      }
    },
    [currentIndex]
  );

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const handleNext = useCallback(() => {
    if (isLastPage) {
      haptics.success();
      complete();
    } else {
      haptics.light();
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  }, [currentIndex, isLastPage, complete]);

  const handleSkip = useCallback(() => {
    haptics.light();
    complete();
  }, [complete]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1, { damping: 15 }) }],
  }));

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: get("background") }}
      edges={["top", "bottom"]}
    >
      {/* Skip button */}
      {!isLastPage && (
        <View className="absolute top-16 right-6 z-10">
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
        </View>
      )}

      {/* Pages */}
      <FlatList
        ref={flatListRef}
        data={onboardingPages}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <OnboardingPage page={item} isActive={index === currentIndex} />
        )}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Bottom section */}
      <View className="px-6 pb-6">
        {/* Pagination dots */}
        <OnboardingPagination
          total={onboardingPages.length}
          current={currentIndex}
        />

        {/* Action button */}
        <Animated.View style={buttonAnimatedStyle}>
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
            accessibilityLabel={isLastPage ? "Get started" : "Next page"}
          >
            <Text className="text-base font-bold text-white mr-2">
              {isLastPage ? "Get Started" : "Next"}
            </Text>
            <Ionicons
              name={isLastPage ? "checkmark" : "arrow-forward"}
              size={20}
              color="#FFFFFF"
            />
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
