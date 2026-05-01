import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Toaster } from "sonner-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";
import { fontFamilies, typography } from "@/constants/typography";
import { useColorScheme } from "@/hooks/useColorScheme";

function ToasterSafeAreaOverlay({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={styles.overlaySafeArea}
      pointerEvents="box-none"
    >
      <View pointerEvents="box-none" style={styles.overlayContent}>
        {children}
      </View>
    </SafeAreaView>
  );
}

export function AppToaster() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Toaster
      ToasterOverlayWrapper={ToasterSafeAreaOverlay}
      theme={isDark ? "dark" : "light"}
      position="top-center"
      offset={8}
      gap={8}
      visibleToasts={3}
      enableStacking
      swipeToDismissDirection="up"
      toastOptions={{
        style: {
          borderRadius: 22,
          borderWidth: 1,
          backgroundColor: isDark ? colors.surface.dark : colors.surface.light,
          borderColor: isDark ? colors.border.dark : colors.border.light,
          shadowColor: isDark ? "#000000" : "#9D8660",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.2 : 0.08,
          shadowRadius: 14,
          elevation: 4,
        },
        toastContainerStyle: {
          width: "100%",
          maxWidth: 364,
          paddingHorizontal: 12,
        },
        textContainerStyle: {
          rowGap: 3,
        },
        titleStyle: {
          ...typography.bodyMd,
          color: isDark ? colors.text.dark : colors.text.light,
          fontFamily: fontFamilies.bodyMedium,
          fontWeight: "600",
        },
        descriptionStyle: {
          ...typography.bodySm,
          color: isDark ? colors.textMuted.dark : colors.textMuted.light,
          fontSize: 13,
        },
        buttonsStyle: {
          gap: 6,
        },
        actionButtonStyle: {
          backgroundColor: isDark ? colors.primaryBg.dark : colors.primaryBg.light,
          borderWidth: 1,
          borderColor: isDark ? "#4A6653" : "#D1DFD1",
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 7,
        },
        actionButtonTextStyle: {
          ...typography.bodySm,
          color: isDark ? "#C8EEC8" : "#476D47",
          fontSize: 13,
          fontWeight: "600",
        },
        cancelButtonStyle: {
          backgroundColor: isDark ? colors.surfaceAlt.dark : colors.surfaceAlt.light,
          borderWidth: 1,
          borderColor: isDark ? colors.border.dark : colors.border.light,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 7,
        },
        cancelButtonTextStyle: {
          ...typography.bodySm,
          color: isDark ? colors.textMuted.dark : colors.textMuted.light,
          fontSize: 13,
          fontWeight: "600",
        },
      }}
      icons={{
        success: <Ionicons name="leaf" size={16} color="#5B8A5B" />,
        error: <Ionicons name="alert-circle-outline" size={16} color="#E06B55" />,
        warning: <Ionicons name="lock-closed" size={16} color="#BDA77D" />,
        info: <Ionicons name="calendar" size={16} color="#847596" />,
        loading: <ActivityIndicator size="small" color={isDark ? "#C8EEC8" : "#5B8A5B"} />,
      }}
    />
  );
}

export default AppToaster;

const styles = StyleSheet.create({
  overlaySafeArea: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContent: {
    flex: 1,
  },
});
