import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AccordionSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description?: string;
  badge?: string | number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  accentColor?: "sage" | "sand" | "coral" | "dusk";
}

export function AccordionSection({
  title,
  icon,
  description,
  badge,
  children,
  defaultExpanded = false,
  accentColor = "sage",
}: AccordionSectionProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  // Accent color configurations
  const accentColors = {
    sage: {
      iconBg: isDark ? "#2D3D2D" : "#E8EFE8",
      iconColor: isDark ? "#A8C5A8" : "#5B8A5B",
      accentLine: isDark ? "#5B8A5B" : "#7BA87B",
    },
    sand: {
      iconBg: isDark ? "#302A22" : "#F9F5ED",
      iconColor: isDark ? "#D4C4A0" : "#9D8660",
      accentLine: isDark ? "#BDA77D" : "#D4C4A0",
    },
    coral: {
      iconBg: isDark ? "#3D2822" : "#FDE8E4",
      iconColor: isDark ? "#F5A899" : "#E06B55",
      accentLine: isDark ? "#E06B55" : "#F5A899",
    },
    dusk: {
      iconBg: isDark ? "#2D2A33" : "#EFECF2",
      iconColor: isDark ? "#C4BBCF" : "#847596",
      accentLine: isDark ? "#847596" : "#A396B3",
    },
  };

  const colors = accentColors[accentColor];

  return (
    <View
      className="mb-3 rounded-3xl bg-paper-50 dark:bg-paper-850 overflow-hidden"
      style={isDark ? styles.cardShadowDark : styles.cardShadowLight}
    >
      {/* Accent line at top */}
      <View
        style={{
          height: expanded ? 3 : 2,
          backgroundColor: colors.accentLine,
          opacity: expanded ? 1 : 0.5,
        }}
      />

      {/* Header - always visible */}
      <TouchableOpacity
        onPress={toggleExpanded}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title} section, ${expanded ? "expanded" : "collapsed"}`}
      >
        <View className="flex-row items-center p-4">
          {/* Icon */}
          <View
            className="w-11 h-11 rounded-2xl items-center justify-center mr-4"
            style={{ backgroundColor: colors.iconBg }}
          >
            <Ionicons name={icon} size={22} color={colors.iconColor} />
          </View>

          {/* Title and description */}
          <View className="flex-1 mr-3">
            <View className="flex-row items-center">
              <Text
                className="text-base font-bold text-paper-800 dark:text-paper-200"
                style={{ letterSpacing: -0.3 }}
              >
                {title}
              </Text>
              {badge !== undefined && (
                <View
                  className="ml-2 px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: colors.iconBg }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: colors.iconColor }}
                  >
                    {badge}
                  </Text>
                </View>
              )}
            </View>
            {description && (
              <Text className="text-xs text-sand-500 dark:text-sand-400 mt-0.5">
                {description}
              </Text>
            )}
          </View>

          {/* Chevron */}
          <View
            className="w-8 h-8 rounded-xl items-center justify-center"
            style={{
              backgroundColor: isDark ? "#2A2520" : "#F5F1E8",
            }}
          >
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={isDark ? "#6B5C4A" : "#9D8660"}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Collapsible content */}
      {expanded && (
        <View
          className="border-t border-paper-200 dark:border-paper-800"
          style={{ backgroundColor: isDark ? "#1F1B18" : "#FAFAF8" }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadowLight: {
    elevation: 3,
    shadowColor: "#9D8660",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardShadowDark: {
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});
