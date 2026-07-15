import React, { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { DEFAULT_EMOTIONS } from "@/lib/entrySettings";
import type { Emotion } from "@db/types";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import {
  createPresetListModel,
  normalizePresetKey,
} from "@/features/settings/utils/defaultPresetSelection";
import { emotionService } from "@/services/emotionService";
import { presetSyncService } from "@/services/presetSyncService";
import { useColorScheme } from "@/hooks/useColorScheme";
import { haptics } from "@/lib/haptics";
import { Alert } from "@/components/ui/AppAlert";
import { CATEGORIES } from "@/features/settings/emotions/emotionSettingsConfig";
import { HeroStats, CategorySection } from "@/features/settings/emotions/EmotionSettingsParts";
import {
  EmotionModal,
  MoveEmotionDialog,
  RemoveEmotionDialog,
} from "@/features/settings/emotions/EmotionSettingsDialogs";
import {
  PresetHistorySyncCard,
  PresetTipCard,
  presetListStyles,
} from "@/features/settings/presets/PresetListPrimitives";

async function promptHistoricalUpdate(options: {
  affectedMoodEntryCount: number;
  message: string;
  apply: () => Promise<void>;
  fallbackMessage: string;
}) {
  if (options.affectedMoodEntryCount === 0) return;

  Alert.alert(
    "Update Past Entries?",
    options.message,
    [
      { text: "Future Only", style: "cancel" },
      {
        text: "Update All",
        onPress: async () => {
          try {
            await options.apply();
          } catch {
            Alert.alert("Error", options.fallbackMessage);
          }
        },
      },
    ]
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function EmotionsSettingsScreen() {
  const isDark = useColorScheme() === "dark";

  const emotions = useSettingsStore((s) => s.emotions);
  const setEmotions = useSettingsStore((s) => s.setEmotions);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingEmotion, setEditingEmotion] = useState<{
    name: string;
    category: Emotion["category"];
    isNew: boolean;
  } | null>(null);
  const [emotionPendingMove, setEmotionPendingMove] = useState<{
    name: string;
    category: Emotion["category"];
  } | null>(null);
  const [emotionPendingRemoval, setEmotionPendingRemoval] = useState<string | null>(
    null
  );
  const [historySyncLoading, setHistorySyncLoading] = useState(false);

  const presetModel = useMemo(
    () =>
      createPresetListModel({
        values: emotions,
        defaults: DEFAULT_EMOTIONS,
        getLabel: (emotion) => emotion.name,
      }),
    [emotions]
  );

  // Counts
  const counts = useMemo(() => {
    const positive = emotions.filter((e) => e.category === "positive").length;
    const negative = emotions.filter((e) => e.category === "negative").length;
    const neutral = emotions.filter((e) => e.category === "neutral").length;
    return { positive, negative, neutral, total: positive + negative + neutral };
  }, [emotions]);
  const historySyncTone = useMemo(
    () => ({
      primary: isDark ? "#A8C5A8" : "#5B8A5B",
      cardBg: isDark ? "rgba(30,45,38,0.48)" : "#FDFCFA",
      border: isDark ? "rgba(58,84,72,0.36)" : "rgba(221,212,196,0.80)",
      accentBg: isDark ? "rgba(91,138,91,0.20)" : "rgba(91,138,91,0.12)",
      chipActive: isDark ? "rgba(91,138,91,0.45)" : "#C8E0C8",
      chipBorder: isDark ? "#7BA87B" : "#5B8A5B",
    }),
    [isDark]
  );

  // Chip data by category
  const chipsByCategory = useMemo(() => {
    const result = {} as Record<
      Emotion["category"],
      { name: string; isActive: boolean; isCustom: boolean }[]
    >;
    CATEGORIES.forEach((cat) => {
      result[cat] = [
        ...presetModel.defaultItems.filter((item) => item.value.category === cat).map((item) => ({
          name: item.label,
          isActive: item.isActive,
          isCustom: false,
        })),
        ...presetModel.customItems.filter((item) => item.value.category === cat).map((item) => ({
          name: item.label,
          isActive: true,
          isCustom: true,
        })),
      ];
    });
    return result;
  }, [presetModel]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleDefault = useCallback(
    async (name: string) => {
      haptics.light();
      const def = DEFAULT_EMOTIONS.find(
        (e) => normalizePresetKey(e.name) === normalizePresetKey(name)
      );
      if (def) await setEmotions(presetModel.toggleDefault(def));
    },
    [presetModel, setEmotions]
  );

  const handleRemoveEmotion = useCallback(
    async (name: string) => {
      haptics.light();
      setEmotionPendingRemoval(name);
    },
    []
  );

  const handleCancelRemoveEmotion = useCallback(() => {
    setEmotionPendingRemoval(null);
  }, []);

  const handleConfirmRemoveEmotion = useCallback(async () => {
    if (!emotionPendingRemoval) return;

    haptics.destructive();
    await setEmotions(presetModel.removeByLabel(emotionPendingRemoval));
    setEmotionPendingRemoval(null);
  }, [emotionPendingRemoval, presetModel, setEmotions]);

  const handleOpenMoveEmotion = useCallback(
    (name: string, category: Emotion["category"]) => {
      haptics.longPressActivate();
      setEmotionPendingMove({ name, category });
    },
    []
  );

  const handleCancelMoveEmotion = useCallback(() => {
    setEmotionPendingMove(null);
  }, []);

  const handleUpdateCategory = useCallback(
    async (name: string, category: Emotion["category"]) => {
      const key = normalizePresetKey(name);
      if (
        !emotions.some(
          (e) => normalizePresetKey(e.name) === key && e.category !== category
        )
      )
        return;

      await setEmotions(
        emotions.map((e) =>
          normalizePresetKey(e.name) === key ? { ...e, category } : e
        )
      );

      try {
        const preview = await emotionService.previewCategoryHistoricalUpdate(
          name,
          category
        );
        await promptHistoricalUpdate({
          affectedMoodEntryCount: preview.affectedMoodEntryCount,
          message: `Apply this category change to ${preview.affectedMoodEntryCount} past ${preview.affectedMoodEntryCount === 1 ? "entry" : "entries"}?`,
          apply: () => emotionService.applyCategoryHistoricalUpdate(name, category),
          fallbackMessage: "Category saved for future entries only.",
        });
      } catch {
        /* skip */
      }
    },
    [emotions, setEmotions]
  );

  const handleConfirmMoveEmotion = useCallback(
    async (category: Emotion["category"]) => {
      if (!emotionPendingMove) return;

      await handleUpdateCategory(emotionPendingMove.name, category);
      setEmotionPendingMove(null);
    },
    [emotionPendingMove, handleUpdateCategory]
  );

  const handleSelectAll = useCallback(
    async (category: Emotion["category"]) => {
      haptics.light();
      const defs = DEFAULT_EMOTIONS.filter((e) => e.category === category);
      await setEmotions(presetModel.selectAllDefaults(defs));
    },
    [presetModel, setEmotions]
  );

  const handleClearAll = useCallback(
    async (category: Emotion["category"]) => {
      haptics.light();
      const defaultsInCategory = DEFAULT_EMOTIONS.filter(
        (e) => e.category === category
      );
      await setEmotions(presetModel.clearDefaults(defaultsInCategory));
    },
    [presetModel, setEmotions]
  );

  const handleOpenAddModal = useCallback(
    (category: Emotion["category"] = "positive") => {
      haptics.light();
      setEditingEmotion({ name: "", category, isNew: true });
      setIsModalVisible(true);
    },
    []
  );

  const handleAddFromHistory = useCallback(async () => {
    haptics.light();

    try {
      setHistorySyncLoading(true);
      const diff = await presetSyncService.previewMissingFromHistory("emotions");
      setHistorySyncLoading(false);

      if (diff.emotions.length === 0) {
        Alert.alert(
          "Nothing to Add",
          "Every emotion in your Mood Entry history is already in your Emotion List."
        );
        return;
      }

      Alert.alert(
        "Add from History",
        `Add ${diff.emotions.length} emotion${diff.emotions.length === 1 ? "" : "s"} from past Mood Entries to your Emotion List?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add",
            onPress: async () => {
              try {
                setHistorySyncLoading(true);
                const result =
                  await presetSyncService.addMissingFromHistory("emotions");
                haptics.success();
                Alert.alert(
                  "Added from History",
                  result.addedEmotions.length > 0
                    ? `Added ${result.addedEmotions.length} emotion${result.addedEmotions.length === 1 ? "" : "s"}.`
                    : "No new emotions were found."
                );
              } catch {
                haptics.error();
                Alert.alert("Error", "Could not add emotions from history.");
              } finally {
                setHistorySyncLoading(false);
              }
            },
          },
        ]
      );
    } catch {
      haptics.error();
      setHistorySyncLoading(false);
      Alert.alert("Error", "Could not check your Mood Entry history.");
    }
  }, []);

  const handleEditEmotion = useCallback(
    (name: string, category: Emotion["category"]) => {
      haptics.light();
      setEditingEmotion({ name, category, isNew: false });
      setIsModalVisible(true);
    },
    []
  );

  const handleSaveEmotion = useCallback(
    async (name: string, category: Emotion["category"], originalName?: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const normalizedOld = originalName
        ? normalizePresetKey(originalName)
        : null;

      // Check for duplicates (excluding the original name if renaming)
      const isDuplicate = presetModel.hasDuplicate(trimmed, originalName);

      if (isDuplicate) {
        Alert.alert("Duplicate", "This emotion already exists.");
        return;
      }

      haptics.medium();

      if (originalName && normalizedOld) {
        const originalEmotion = emotions.find(
          (emotion) => normalizePresetKey(emotion.name) === normalizedOld
        );
        const renamed = normalizePresetKey(trimmed) !== normalizedOld;
        const recategorized = originalEmotion?.category !== category;

        // Renaming existing emotion
        await setEmotions(
          emotions.map((e) =>
            normalizePresetKey(e.name) === normalizedOld
              ? { name: trimmed, category }
              : e
          )
        );

        if (renamed) {
          try {
            const preview = await emotionService.previewRenameHistoricalUpdate(
              originalName,
              trimmed
            );
            await promptHistoricalUpdate({
              affectedMoodEntryCount: preview.affectedMoodEntryCount,
              message: `Apply this name change to ${preview.affectedMoodEntryCount} past ${preview.affectedMoodEntryCount === 1 ? "entry" : "entries"}?`,
              apply: async () => {
                await emotionService.applyRenameHistoricalUpdate(
                  originalName,
                  trimmed
                );
                if (recategorized) {
                  await emotionService.applyCategoryHistoricalUpdate(
                    trimmed,
                    category
                  );
                }
              },
              fallbackMessage: "Emotion saved for future entries only.",
            });
          } catch {
            /* skip */
          }
        } else if (recategorized) {
          try {
            const preview = await emotionService.previewCategoryHistoricalUpdate(
              trimmed,
              category
            );
            await promptHistoricalUpdate({
              affectedMoodEntryCount: preview.affectedMoodEntryCount,
              message: `Apply this category change to ${preview.affectedMoodEntryCount} past ${preview.affectedMoodEntryCount === 1 ? "entry" : "entries"}?`,
              apply: () =>
                emotionService.applyCategoryHistoricalUpdate(trimmed, category),
              fallbackMessage: "Category saved for future entries only.",
            });
          } catch {
            /* skip */
          }
        }
      } else {
        // Adding new emotion
        const result = presetModel.addCustom({ name: trimmed, category });
        if (!result.ok) return;
        await setEmotions(result.values);
      }

      setIsModalVisible(false);
      setEditingEmotion(null);
    },
    [emotions, presetModel, setEmotions]
  );

  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    setEditingEmotion(null);
  }, []);

  // ─── Derived styles ────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      className="flex-1 bg-paper-100 dark:bg-paper-900"
      edges={["top"]}
    >
      <SettingsPageHeader
        title="Emotions"
        subtitle="Customization"
        icon="heart-outline"
        accentColor="coral"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Stats Section */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(260)}
          style={presetListStyles.heroSection}
        >
          <HeroStats counts={counts} isDark={isDark} />
        </Animated.View>

        {/* Category Sections */}
        {CATEGORIES.map((cat, index) => (
          <Animated.View
            key={cat}
            entering={FadeInDown.delay(240 + index * 80).duration(260)}
          >
            <CategorySection
              category={cat}
              chips={chipsByCategory[cat]}
              isDark={isDark}
              onToggle={handleToggleDefault}
              onRemove={handleRemoveEmotion}
              onEdit={handleEditEmotion}
              onOpenMoveDialog={handleOpenMoveEmotion}
              onSelectAll={() => handleSelectAll(cat)}
              onClearAll={() => handleClearAll(cat)}
              onAddNew={() => handleOpenAddModal(cat)}
            />
          </Animated.View>
        ))}

        {/* Tips Section */}
        <Animated.View
          entering={FadeInDown.delay(560).duration(260)}
        >
          <PresetTipCard isDark={isDark}>
            Long-press custom emotions to move them between categories. Tap the
            edit icon to rename.
          </PresetTipCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(620).duration(260)}>
          <PresetHistorySyncCard
            title="Add from History"
            description="Find logged emotions missing from this list"
            icon="time-outline"
            isDark={isDark}
            tone={historySyncTone}
            loading={historySyncLoading}
            onPress={handleAddFromHistory}
          />
        </Animated.View>
      </ScrollView>

      {/* Floating Add Button */}
      <Animated.View
        entering={FadeInUp.delay(600).duration(260)}
        style={presetListStyles.fabContainer}
      >
        <Pressable
          onPress={() => handleOpenAddModal("positive")}
          style={({ pressed }) => [
            presetListStyles.fab,
            {
              backgroundColor: "#476D47",
              transform: [{ scale: pressed ? 0.95 : 1 }],
              shadowColor: "#5B8A5B",
            },
          ]}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      {/* Add/Edit Modal */}
      <EmotionModal
        visible={isModalVisible}
        editingEmotion={editingEmotion}
        isDark={isDark}
        onClose={handleCloseModal}
        onSave={handleSaveEmotion}
      />

      <RemoveEmotionDialog
        visible={emotionPendingRemoval !== null}
        emotionName={emotionPendingRemoval}
        isDark={isDark}
        onCancel={handleCancelRemoveEmotion}
        onConfirm={handleConfirmRemoveEmotion}
      />

      <MoveEmotionDialog
        visible={emotionPendingMove !== null}
        emotionName={emotionPendingMove?.name ?? null}
        currentCategory={emotionPendingMove?.category ?? null}
        isDark={isDark}
        onCancel={handleCancelMoveEmotion}
        onSelectCategory={handleConfirmMoveEmotion}
      />
    </SafeAreaView>
  );
}
