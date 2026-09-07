import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Toaster } from "sonner-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";
import { fontFamilies, typography } from "@/constants/typography";
import { useToastOffset } from "@/hooks/useToastOffset";
import { useColorScheme } from "@/hooks/useColorScheme";

function ToasterSafeAreaOverlay({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView
      edges={["left", "right"]}
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
  const offset = useToastOffset();
  const isDark = colorScheme === "dark";

  return (
    <Toaster
      ToasterOverlayWrapper={ToasterSafeAreaOverlay}
      theme={isDark ? "dark" : "light"}
      position="bottom-center"
      offset={offset}
      gap={8}
      visibleToasts={3}
      enableStacking
      swipeToDismissDirection="up"
      toastOptions={{
        style: {
          borderRadius: 12,
          padding: 12,
          marginHorizontal: 0,
          borderWidth: 1,
          backgroundColor: isDark ? colors.surfaceElevated.dark : colors.surfaceElevated.light,
          borderColor: isDark ? colors.border.dark : colors.border.light,
          shadowColor: isDark ? colors.background.dark : "#9D8660",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: isDark ? 0.18 : 0.07,
          shadowRadius: 12,
          elevation: 3,
        },
        toastContainerStyle: {
          width: "100%",
          paddingHorizontal: 16,
        },
        toastContentStyle: {
          gap: 12,
        },
        textContainerStyle: {
          rowGap: 2,
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
          backgroundColor: isDark ? colors.primaryBgHover.dark : colors.primaryBgHover.light,
          borderWidth: 1,
          borderColor: isDark ? "#4A6653" : "#D1DFD1",
          borderRadius: 10,
          minHeight: 48,
          paddingHorizontal: 12,
          paddingVertical: 6,
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
          borderRadius: 10,
          minHeight: 48,
          paddingHorizontal: 12,
          paddingVertical: 6,
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
