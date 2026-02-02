import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Ionicons } from "@expo/vector-icons";

import { useSettingsStore } from "@/shared/state/settingsStore";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { haptics } from "@/lib/haptics";

import type { MoodScaleConfig, MoodLevelConfig, PresetScaleId } from "@/types/moodScaleConfig";
import {
  getPresetScaleConfigs,
  getDefaultMoodScaleConfig,
  buildMoodScale,
  getScaleRange,
  COLOR_PALETTE,
} from "@/lib/moodScaleUtils";

type EditMode = "none" | "label" | "color";

export default function MoodScaleSettingsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const hydrate = useSettingsStore((state) => state.hydrate);
  const moodScaleConfig = useSettingsStore((state) => state.moodScaleConfig);
  const setMoodScaleConfig = useSettingsStore((state) => state.setMoodScaleConfig);

  const [localConfig, setLocalConfig] = useState<MoodScaleConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingLevelIndex, setEditingLevelIndex] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [editingLabel, setEditingLabel] = useState("");
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (moodScaleConfig) {
      setLocalConfig(moodScaleConfig);
    } else {
      setLocalConfig(getDefaultMoodScaleConfig());
    }
  }, [moodScaleConfig]);

  const presets = getPresetScaleConfigs();
  const presetList = Object.entries(presets) as [PresetScaleId, MoodScaleConfig][];

  const handleSelectPreset = useCallback((presetId: PresetScaleId) => {
    haptics.selection();
    const preset = presets[presetId];
    setLocalConfig({ ...preset });
    setHasChanges(true);
    setEditingLevelIndex(null);
    setEditMode("none");
  }, [presets]);

  const handleSave = useCallback(async () => {
    if (!localConfig) return;

    try {
      haptics.success();
      await setMoodScaleConfig(localConfig);
      setHasChanges(false);
      Alert.alert("Saved", "Your mood scale has been updated.");
    } catch (error) {
      haptics.error();
      Alert.alert("Error", "Failed to save mood scale settings.");
      console.error(error);
    }
  }, [localConfig, setMoodScaleConfig]);

  const handleEditLevel = useCallback((index: number, mode: EditMode) => {
    if (!localConfig?.levels) return;

    haptics.light();
    setEditingLevelIndex(index);
    setEditMode(mode);

    if (mode === "label") {
      setEditingLabel(localConfig.levels[index].label);
    } else if (mode === "color") {
      // Find current color in palette
      const level = localConfig.levels[index];
      const colorIdx = COLOR_PALETTE.findIndex(
        (c) => c.bg === level.colorHex || c.text === level.textHex
      );
      setSelectedColorIndex(colorIdx >= 0 ? colorIdx : null);
    }
  }, [localConfig]);

  const handleSaveLevelLabel = useCallback(() => {
    if (!localConfig?.levels || editingLevelIndex === null) return;

    const newLevels = [...localConfig.levels];
    newLevels[editingLevelIndex] = {
      ...newLevels[editingLevelIndex],
      label: editingLabel.trim() || newLevels[editingLevelIndex].label,
    };

    setLocalConfig({
      ...localConfig,
      levels: newLevels,
      isCustom: true,
      modifiedAt: Date.now(),
    });
    setHasChanges(true);
    setEditingLevelIndex(null);
    setEditMode("none");
  }, [localConfig, editingLevelIndex, editingLabel]);

  const handleSelectColor = useCallback((colorIndex: number) => {
    if (!localConfig?.levels || editingLevelIndex === null) return;

    haptics.selection();
    const color = COLOR_PALETTE[colorIndex];
    const newLevels = [...localConfig.levels];
    newLevels[editingLevelIndex] = {
      ...newLevels[editingLevelIndex],
      colorHex: color.bg,
      textHex: color.text,
      colorHexDark: color.bgDark,
      textHexDark: color.textDark,
    };

    setLocalConfig({
      ...localConfig,
      levels: newLevels,
      isCustom: true,
      modifiedAt: Date.now(),
    });
    setHasChanges(true);
    setSelectedColorIndex(colorIndex);
  }, [localConfig, editingLevelIndex]);

  const handleCloseEditor = useCallback(() => {
    setEditingLevelIndex(null);
    setEditMode("none");
    setEditingLabel("");
    setSelectedColorIndex(null);
  }, []);

  const handleScaleLabelChange = useCallback((newLabel: string) => {
    if (!localConfig) return;

    setLocalConfig({
      ...localConfig,
      scaleLabel: newLabel,
      isCustom: true,
      modifiedAt: Date.now(),
    });
    setHasChanges(true);
  }, [localConfig]);

  if (!localConfig) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
        <SettingsPageHeader
          title="Mood Scale"
          subtitle="Customization"
          icon="options-outline"
          accentColor="sage"
        />
        <View className="flex-1 justify-center items-center">
          <Text className="text-sand-500 dark:text-sand-400">Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentRange = getScaleRange(localConfig);
  const processedScale = buildMoodScale(localConfig);

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Mood Scale"
        subtitle="Customization"
        icon="options-outline"
        accentColor="sage"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Presets Section */}
        <SettingsSection title="Presets">
          <View className="p-4 gap-2">
            {presetList.map(([id, preset]) => {
              const isSelected = localConfig.id === id && !localConfig.isCustom;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => handleSelectPreset(id)}
                  className={`p-4 rounded-xl border-2 ${
                    isSelected
                      ? "border-sage-500 bg-sage-50 dark:bg-sage-600/20"
                      : "border-transparent bg-paper-100 dark:bg-paper-800"
                  }`}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-paper-800 dark:text-paper-200">
                        {preset.name}
                      </Text>
                      <Text className="text-sm text-sand-500 dark:text-sand-400 mt-0.5">
                        {preset.scaleType === "slider"
                          ? `${preset.slider?.min}-${preset.slider?.max} slider`
                          : `${preset.levels?.length || 0} levels`}
                        {preset.displayStyle === "emoji" && " with emojis"}
                      </Text>
                    </View>
                    {isSelected && (
                      <View className="w-6 h-6 rounded-full bg-sage-500 items-center justify-center">
                        <Ionicons name="checkmark" size={16} color="white" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingsSection>

        {/* Scale Label */}
        <SettingsSection title="Scale Label">
          <View className="p-4">
            <Text className="text-sm text-sand-500 dark:text-sand-400 mb-2">
              Name shown in the app (e.g., "Mood", "Wellbeing", "Energy")
            </Text>
            <TextInput
              value={localConfig.scaleLabel}
              onChangeText={handleScaleLabelChange}
              className="p-3 rounded-xl bg-paper-100 dark:bg-paper-800 text-paper-800 dark:text-paper-200"
              style={styles.input}
              placeholder="Mood"
              placeholderTextColor={isDark ? "#6B5C4A" : "#BDA77D"}
              maxLength={20}
            />
          </View>
        </SettingsSection>

        {/* Current Scale Preview */}
        {localConfig.scaleType === "discrete" && localConfig.levels && (
          <SettingsSection title="Current Scale">
            <View className="p-4">
              <Text className="text-sm text-sand-500 dark:text-sand-400 mb-3">
                Tap a level to edit its label or color
              </Text>

              {localConfig.levels.map((level, index) => {
                const isEditing = editingLevelIndex === index;
                return (
                  <View key={level.value} className="mb-2">
                    <TouchableOpacity
                      onPress={() => handleEditLevel(index, "label")}
                      className={`flex-row items-center p-3 rounded-xl ${
                        isEditing
                          ? "border-2 border-sage-500"
                          : "border border-paper-200 dark:border-paper-700"
                      }`}
                      style={{
                        backgroundColor: isDark ? level.colorHexDark || level.colorHex : level.colorHex,
                      }}
                      activeOpacity={0.8}
                    >
                      <View className="w-8 h-8 rounded-lg items-center justify-center bg-white/30 mr-3">
                        <Text
                          className="text-base font-bold"
                          style={{ color: isDark ? level.textHexDark || level.textHex : level.textHex }}
                        >
                          {level.emoji || level.value}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-base font-medium"
                          style={{ color: isDark ? level.textHexDark || level.textHex : level.textHex }}
                        >
                          {level.label}
                        </Text>
                        {level.description && (
                          <Text
                            className="text-xs opacity-80"
                            style={{ color: isDark ? level.textHexDark || level.textHex : level.textHex }}
                          >
                            {level.description}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleEditLevel(index, "color")}
                        className="p-2 rounded-lg bg-white/20"
                      >
                        <Ionicons
                          name="color-palette-outline"
                          size={18}
                          color={isDark ? level.textHexDark || level.textHex : level.textHex}
                        />
                      </TouchableOpacity>
                    </TouchableOpacity>

                    {/* Inline Editor */}
                    {isEditing && editMode === "label" && (
                      <View className="mt-2 p-3 rounded-xl bg-paper-100 dark:bg-paper-800">
                        <Text className="text-xs text-sand-500 dark:text-sand-400 mb-2">
                          Edit Label
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <TextInput
                            value={editingLabel}
                            onChangeText={setEditingLabel}
                            className="flex-1 p-2 rounded-lg bg-white dark:bg-paper-700 text-paper-800 dark:text-paper-200"
                            style={styles.input}
                            autoFocus
                            maxLength={20}
                          />
                          <TouchableOpacity
                            onPress={handleSaveLevelLabel}
                            className="p-2 rounded-lg bg-sage-500"
                          >
                            <Ionicons name="checkmark" size={20} color="white" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleCloseEditor}
                            className="p-2 rounded-lg bg-sand-200 dark:bg-sand-800"
                          >
                            <Ionicons name="close" size={20} color={isDark ? "#D4C4A0" : "#7A6545"} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {isEditing && editMode === "color" && (
                      <View className="mt-2 p-3 rounded-xl bg-paper-100 dark:bg-paper-800">
                        <Text className="text-xs text-sand-500 dark:text-sand-400 mb-2">
                          Select Color
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                          {COLOR_PALETTE.map((color, colorIdx) => {
                            const isColorSelected = selectedColorIndex === colorIdx;
                            return (
                              <TouchableOpacity
                                key={color.name}
                                onPress={() => handleSelectColor(colorIdx)}
                                className={`w-10 h-10 rounded-xl items-center justify-center ${
                                  isColorSelected ? "border-2 border-paper-800 dark:border-paper-200" : ""
                                }`}
                                style={{ backgroundColor: isDark ? color.bgDark : color.bg }}
                              >
                                {isColorSelected && (
                                  <Ionicons name="checkmark" size={18} color={isDark ? color.textDark : color.text} />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TouchableOpacity
                          onPress={handleCloseEditor}
                          className="mt-3 p-2 rounded-lg bg-sand-200 dark:bg-sand-800 items-center"
                        >
                          <Text className="text-sand-600 dark:text-sand-300 font-medium">Done</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </SettingsSection>
        )}

        {/* Slider Preview */}
        {localConfig.scaleType === "slider" && localConfig.slider && (
          <SettingsSection title="Scale Range">
            <View className="p-4">
              <Text className="text-sm text-sand-500 dark:text-sand-400 mb-3">
                This scale uses a slider from {localConfig.slider.min} to {localConfig.slider.max}
              </Text>
              <View
                className="h-12 rounded-xl items-center justify-center"
                style={{
                  backgroundColor: isDark
                    ? localConfig.slider.gradientStartHexDark || localConfig.slider.gradientStartHex
                    : localConfig.slider.gradientStartHex,
                }}
              >
                <Text className="text-paper-800 dark:text-paper-200 font-medium">
                  {localConfig.slider.min} - {localConfig.slider.max}
                </Text>
              </View>
            </View>
          </SettingsSection>
        )}

        {/* Info */}
        <View className="mx-4 mt-4 p-4 rounded-2xl bg-dusk-100 dark:bg-dusk-600/20">
          <View className="flex-row items-center mb-2">
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={isDark ? "#C4BBCF" : "#695C78"}
            />
            <Text className="text-sm font-medium ml-2 text-dusk-600 dark:text-dusk-300">
              About Mood Scales
            </Text>
          </View>
          <Text className="text-sm text-dusk-500 dark:text-dusk-400 leading-5">
            Your mood scale determines how you track and visualize your emotional state.
            Lower values represent better moods in all scales. Changes apply to new entries;
            existing entries retain their original values.
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      {hasChanges && (
        <View
          className="absolute bottom-0 left-0 right-0 p-4"
          style={{
            backgroundColor: isDark ? "#1C1916" : "#FAF8F4",
            borderTopWidth: 1,
            borderTopColor: isDark ? "#2A2520" : "#E5D9BF",
          }}
        >
          <TouchableOpacity
            onPress={handleSave}
            className="p-4 rounded-xl bg-sage-500 dark:bg-sage-600 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold text-base">Save Changes</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    fontSize: 16,
  },
});
