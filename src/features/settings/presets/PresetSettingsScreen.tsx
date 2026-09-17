import React from "react";
import { Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";

import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { presetListStyles } from "@/features/settings/presets/PresetListPrimitives";

/**
 * Shell shared by the emotions and contexts preset screens: page header,
 * scrolling body, and the floating add button.
 *
 * The two screens differ in what they list, not in how the page is framed, so
 * only the frame lives here. Their section layouts stay in their own files:
 * emotions group by category with move and energy editing, contexts are a flat
 * built-in and custom pair, and forcing both through one configuration object
 * costs more than the duplication it removes.
 */
export function PresetSettingsScreen({
  title,
  icon,
  accentColor,
  addButtonColor,
  addButtonShadowColor,
  addButtonLabel,
  onAdd,
  addButtonDelay = 420,
  children,
  overlays,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accentColor: React.ComponentProps<typeof SettingsPageHeader>["accentColor"];
  addButtonColor: string;
  addButtonShadowColor: string;
  addButtonLabel: string;
  onAdd: () => void;
  addButtonDelay?: number;
  children: React.ReactNode;
  /** Modals and dialogs. They must sit outside the ScrollView, not inside it. */
  overlays?: React.ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title={title}
        subtitle="Customization"
        icon={icon}
        accentColor={accentColor}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(addButtonDelay).duration(260)}
        style={presetListStyles.fabContainer}
      >
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={addButtonLabel}
          style={({ pressed }) => [
            presetListStyles.fab,
            {
              backgroundColor: addButtonColor,
              transform: [{ scale: pressed ? 0.95 : 1 }],
              shadowColor: addButtonShadowColor,
            },
          ]}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      {overlays}
    </SafeAreaView>
  );
}
