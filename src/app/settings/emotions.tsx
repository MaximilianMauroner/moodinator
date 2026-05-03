import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { DEFAULT_EMOTIONS } from "@/lib/entrySettings";
import type { Emotion } from "@db/types";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import {
  hasEmotionPreset,
  normalizePresetKey,
  toggleEmotionPreset,
} from "@/features/settings/utils/defaultPresetSelection";
import { emotionService } from "@/services/emotionService";
import { useColorScheme } from "@/hooks/useColorScheme";
import { haptics } from "@/lib/haptics";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES: Emotion["category"][] = ["positive", "negative", "neutral"];

const CATEGORY_CONFIG = {
  positive: {
    label: "Positive",
    icon: "sunny-outline" as const,
    description: "Uplifting emotions",
    lightPrimary: "#5B8A5B",
    darkPrimary: "#A8C5A8",
    lightBg: "rgba(91,138,91,0.08)",
    darkBg: "rgba(91,138,91,0.15)",
    lightBgSolid: "#EDF5ED",
    darkBgSolid: "rgba(40,62,42,0.65)",
    lightBorder: "rgba(91,138,91,0.25)",
    darkBorder: "rgba(91,138,91,0.35)",
    lightAccentBg: "#D4E8D4",
    darkAccentBg: "rgba(91,138,91,0.30)",
    lightChipActive: "#C8E0C8",
    darkChipActive: "rgba(91,138,91,0.45)",
    lightChipBorder: "#5B8A5B",
    darkChipBorder: "#7BA87B",
  },
  negative: {
    label: "Negative",
    icon: "rainy-outline" as const,
    description: "Challenging feelings",
    lightPrimary: "#C75441",
    darkPrimary: "#F5A899",
    lightBg: "rgba(199,84,65,0.06)",
    darkBg: "rgba(199,84,65,0.12)",
    lightBgSolid: "#FDF2F0",
    darkBgSolid: "rgba(62,38,35,0.65)",
    lightBorder: "rgba(199,84,65,0.20)",
    darkBorder: "rgba(199,84,65,0.30)",
    lightAccentBg: "#F5D0C8",
    darkAccentBg: "rgba(199,84,65,0.25)",
    lightChipActive: "#FADCD6",
    darkChipActive: "rgba(199,84,65,0.40)",
    lightChipBorder: "#C75441",
    darkChipBorder: "#E88070",
  },
  neutral: {
    label: "Neutral",
    icon: "water-outline" as const,
    description: "Balanced states",
    lightPrimary: "#695C78",
    darkPrimary: "#C4BBCF",
    lightBg: "rgba(105,92,120,0.06)",
    darkBg: "rgba(105,92,120,0.12)",
    lightBgSolid: "#F5F3F8",
    darkBgSolid: "rgba(48,42,65,0.65)",
    lightBorder: "rgba(105,92,120,0.20)",
    darkBorder: "rgba(105,92,120,0.30)",
    lightAccentBg: "#E0D8EC",
    darkAccentBg: "rgba(105,92,120,0.25)",
    lightChipActive: "#E8E2F0",
    darkChipActive: "rgba(105,92,120,0.40)",
    lightChipBorder: "#695C78",
    darkChipBorder: "#9888B0",
  },
} as const;

// ─── AnimatedPressable ───────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

  // Counts
  const counts = useMemo(() => {
    const positive = emotions.filter((e) => e.category === "positive").length;
    const negative = emotions.filter((e) => e.category === "negative").length;
    const neutral = emotions.filter((e) => e.category === "neutral").length;
    return { positive, negative, neutral, total: positive + negative + neutral };
  }, [emotions]);

  // Chip data by category
  const chipsByCategory = useMemo(() => {
    const defaultNames = new Set(
      DEFAULT_EMOTIONS.map((e) => normalizePresetKey(e.name))
    );
    const customs = emotions.filter(
      (e) => !defaultNames.has(normalizePresetKey(e.name))
    );

    const result = {} as Record<
      Emotion["category"],
      { name: string; isActive: boolean; isCustom: boolean }[]
    >;
    CATEGORIES.forEach((cat) => {
      result[cat] = [
        ...DEFAULT_EMOTIONS.filter((e) => e.category === cat).map((e) => ({
          name: e.name,
          isActive: hasEmotionPreset(emotions, e.name),
          isCustom: false,
        })),
        ...customs.filter((e) => e.category === cat).map((e) => ({
          name: e.name,
          isActive: true,
          isCustom: true,
        })),
      ];
    });
    return result;
  }, [emotions]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleDefault = useCallback(
    async (name: string) => {
      haptics.light();
      const def = DEFAULT_EMOTIONS.find(
        (e) => normalizePresetKey(e.name) === normalizePresetKey(name)
      );
      if (def) await setEmotions(toggleEmotionPreset(emotions, def));
    },
    [emotions, setEmotions]
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
    const key = normalizePresetKey(emotionPendingRemoval);
    await setEmotions(emotions.filter((e) => normalizePresetKey(e.name) !== key));
    setEmotionPendingRemoval(null);
  }, [emotionPendingRemoval, emotions, setEmotions]);

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
        if (preview.affectedMoodEntryCount === 0) return;
        Alert.alert(
          "Update Past Entries?",
          `Apply this category change to ${preview.affectedMoodEntryCount} past ${preview.affectedMoodEntryCount === 1 ? "entry" : "entries"}?`,
          [
            { text: "Future Only", style: "cancel" },
            {
              text: "Update All",
              onPress: async () => {
                try {
                  await emotionService.applyCategoryHistoricalUpdate(
                    name,
                    category
                  );
                } catch {
                  Alert.alert("Error", "Category saved for future entries only.");
                }
              },
            },
          ]
        );
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
      const have = new Set(emotions.map((e) => normalizePresetKey(e.name)));
      const add = defs.filter((e) => !have.has(normalizePresetKey(e.name)));
      if (add.length) await setEmotions([...emotions, ...add]);
    },
    [emotions, setEmotions]
  );

  const handleClearAll = useCallback(
    async (category: Emotion["category"]) => {
      haptics.light();
      const remove = new Set(
        DEFAULT_EMOTIONS.filter((e) => e.category === category).map((e) =>
          normalizePresetKey(e.name)
        )
      );
      await setEmotions(
        emotions.filter((e) => !remove.has(normalizePresetKey(e.name)))
      );
    },
    [emotions, setEmotions]
  );

  const handleOpenAddModal = useCallback(
    (category: Emotion["category"] = "positive") => {
      haptics.light();
      setEditingEmotion({ name: "", category, isNew: true });
      setIsModalVisible(true);
    },
    []
  );

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

      const normalizedNew = normalizePresetKey(trimmed);
      const normalizedOld = originalName
        ? normalizePresetKey(originalName)
        : null;

      // Check for duplicates (excluding the original name if renaming)
      const isDuplicate = emotions.some((e) => {
        const normalized = normalizePresetKey(e.name);
        return normalized === normalizedNew && normalized !== normalizedOld;
      });

      if (isDuplicate) {
        Alert.alert("Duplicate", "This emotion already exists.");
        return;
      }

      haptics.medium();

      if (originalName && normalizedOld) {
        // Renaming existing emotion
        await setEmotions(
          emotions.map((e) =>
            normalizePresetKey(e.name) === normalizedOld
              ? { name: trimmed, category }
              : e
          )
        );
      } else {
        // Adding new emotion
        await setEmotions([...emotions, { name: trimmed, category }]);
      }

      setIsModalVisible(false);
      setEditingEmotion(null);
    },
    [emotions, setEmotions]
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
          entering={FadeInDown.delay(100).springify()}
          style={styles.heroSection}
        >
          <HeroStats counts={counts} isDark={isDark} />
        </Animated.View>

        {/* Category Sections */}
        {CATEGORIES.map((cat, index) => (
          <Animated.View
            key={cat}
            entering={FadeInDown.delay(200 + index * 80).springify()}
          >
            <CategorySection
              category={cat}
              chips={chipsByCategory[cat]}
              isDark={isDark}
              onToggle={handleToggleDefault}
              onRemove={handleRemoveEmotion}
              onEdit={handleEditEmotion}
              onUpdateCategory={handleUpdateCategory}
              onOpenMoveDialog={handleOpenMoveEmotion}
              onSelectAll={() => handleSelectAll(cat)}
              onClearAll={() => handleClearAll(cat)}
              onAddNew={() => handleOpenAddModal(cat)}
            />
          </Animated.View>
        ))}

        {/* Tips Section */}
        <Animated.View
          entering={FadeInDown.delay(500).springify()}
          style={styles.tipsSection}
        >
          <View
            style={[
              styles.tipsCard,
              {
                backgroundColor: isDark
                  ? "rgba(157,134,96,0.08)"
                  : "rgba(157,134,96,0.06)",
                borderColor: isDark
                  ? "rgba(157,134,96,0.20)"
                  : "rgba(157,134,96,0.15)",
              },
            ]}
          >
            <View style={styles.tipsIcon}>
              <Ionicons
                name="bulb-outline"
                size={18}
                color={isDark ? "#D4C4A0" : "#9D8660"}
              />
            </View>
            <View style={styles.tipsContent}>
              <Text
                style={[
                  styles.tipsTitle,
                  { color: isDark ? "#D4C4A0" : "#7A6B55" },
                ]}
              >
                Quick Tip
              </Text>
              <Text
                style={[
                  styles.tipsText,
                  { color: isDark ? "rgba(212,196,160,0.70)" : "#9D8660" },
                ]}
              >
                Long-press custom emotions to move them between categories. Tap
                the edit icon to rename.
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Floating Add Button */}
      <Animated.View
        entering={FadeInUp.delay(600).springify()}
        style={styles.fabContainer}
      >
        <Pressable
          onPress={() => handleOpenAddModal("positive")}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: isDark ? "#5B8A5B" : "#5B8A5B",
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

// ─── HeroStats Component ─────────────────────────────────────────────────────

function HeroStats({
  counts,
  isDark,
}: {
  counts: { positive: number; negative: number; neutral: number; total: number };
  isDark: boolean;
}) {
  const total = counts.total || 1;
  const positivePct = (counts.positive / total) * 100;
  const negativePct = (counts.negative / total) * 100;
  const neutralPct = (counts.neutral / total) * 100;

  return (
    <View
      style={[
        styles.heroCard,
        {
          backgroundColor: isDark ? "rgba(30,45,38,0.60)" : "#FDFCFA",
          borderColor: isDark ? "rgba(58,84,72,0.40)" : "rgba(221,212,196,0.80)",
        },
      ]}
    >
      {/* Decorative corner accent */}
      <View
        style={[
          styles.heroCornerAccent,
          {
            backgroundColor: isDark
              ? "rgba(91,138,91,0.15)"
              : "rgba(91,138,91,0.08)",
          },
        ]}
      />

      {/* Header */}
      <View style={styles.heroHeader}>
        <View style={styles.heroTitleRow}>
          <View
            style={[
              styles.heroIconBg,
              {
                backgroundColor: isDark
                  ? "rgba(91,138,91,0.20)"
                  : "rgba(91,138,91,0.12)",
              },
            ]}
          >
            <Ionicons
              name="heart"
              size={16}
              color={isDark ? "#A8C5A8" : "#5B8A5B"}
            />
          </View>
          <Text
            style={[
              styles.heroTitle,
              { color: isDark ? "#F0EDE6" : "#3D352A" },
            ]}
          >
            Your Emotion Library
          </Text>
        </View>
        <View
          style={[
            styles.heroBadge,
            {
              backgroundColor: isDark
                ? "rgba(91,138,91,0.20)"
                : "rgba(91,138,91,0.12)",
            },
          ]}
        >
          <Text
            style={[
              styles.heroBadgeText,
              { color: isDark ? "#A8C5A8" : "#5B8A5B" },
            ]}
          >
            {counts.total}
          </Text>
        </View>
      </View>

      {/* Segmented Progress Bar */}
      <View style={styles.heroProgressContainer}>
        <View
          style={[
            styles.heroProgressTrack,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.04)",
            },
          ]}
        >
          {counts.total > 0 && (
            <>
              <Animated.View
                style={[
                  styles.heroProgressSegment,
                  {
                    width: `${positivePct}%`,
                    backgroundColor: isDark ? "#7BA87B" : "#5B8A5B",
                    borderTopLeftRadius: 4,
                    borderBottomLeftRadius: 4,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.heroProgressSegment,
                  {
                    width: `${negativePct}%`,
                    backgroundColor: isDark ? "#E88070" : "#C75441",
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.heroProgressSegment,
                  {
                    width: `${neutralPct}%`,
                    backgroundColor: isDark ? "#A396B3" : "#695C78",
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                  },
                ]}
              />
            </>
          )}
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.heroStatsRow}>
        <StatPill
          count={counts.positive}
          label="Positive"
          color={isDark ? "#A8C5A8" : "#5B8A5B"}
          bgColor={isDark ? "rgba(91,138,91,0.15)" : "rgba(91,138,91,0.10)"}
        />
        <StatPill
          count={counts.negative}
          label="Negative"
          color={isDark ? "#F5A899" : "#C75441"}
          bgColor={isDark ? "rgba(199,84,65,0.15)" : "rgba(199,84,65,0.08)"}
        />
        <StatPill
          count={counts.neutral}
          label="Neutral"
          color={isDark ? "#C4BBCF" : "#695C78"}
          bgColor={isDark ? "rgba(105,92,120,0.15)" : "rgba(105,92,120,0.08)"}
        />
      </View>
    </View>
  );
}

function StatPill({
  count,
  label,
  color,
  bgColor,
}: {
  count: number;
  label: string;
  color: string;
  bgColor: string;
}) {
  return (
    <View style={[styles.statPill, { backgroundColor: bgColor }]}>
      <Text style={[styles.statPillCount, { color }]}>{count}</Text>
      <Text style={[styles.statPillLabel, { color, opacity: 0.75 }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── CategorySection Component ───────────────────────────────────────────────

interface CategorySectionProps {
  category: Emotion["category"];
  chips: { name: string; isActive: boolean; isCustom: boolean }[];
  isDark: boolean;
  onToggle: (name: string) => void;
  onRemove: (name: string) => void;
  onEdit: (name: string, category: Emotion["category"]) => void;
  onUpdateCategory: (name: string, category: Emotion["category"]) => void;
  onOpenMoveDialog: (name: string, category: Emotion["category"]) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onAddNew: () => void;
}

function CategorySection({
  category,
  chips,
  isDark,
  onToggle,
  onRemove,
  onEdit,
  onUpdateCategory,
  onOpenMoveDialog,
  onSelectAll,
  onClearAll,
  onAddNew,
}: CategorySectionProps) {
  const config = CATEGORY_CONFIG[category];
  const activeCount = chips.filter((c) => c.isActive || c.isCustom).length;
  const totalCount = chips.length;
  const pct = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

  const primaryColor = isDark ? config.darkPrimary : config.lightPrimary;
  const bgColor = isDark ? config.darkBgSolid : config.lightBgSolid;
  const borderColor = isDark ? config.darkBorder : config.lightBorder;

  return (
    <View style={styles.categoryContainer}>
      <View
        style={[
          styles.categoryCard,
          { backgroundColor: bgColor, borderColor },
        ]}
      >
        {/* Category Header */}
        <View style={styles.categoryHeader}>
          <View style={styles.categoryTitleRow}>
            <View
              style={[
                styles.categoryIconBg,
                {
                  backgroundColor: isDark
                    ? config.darkAccentBg
                    : config.lightAccentBg,
                },
              ]}
            >
              <Ionicons name={config.icon} size={16} color={primaryColor} />
            </View>
            <View>
              <Text style={[styles.categoryLabel, { color: primaryColor }]}>
                {config.label}
              </Text>
              <Text
                style={[
                  styles.categoryDescription,
                  {
                    color: isDark
                      ? "rgba(255,255,255,0.45)"
                      : "rgba(0,0,0,0.40)",
                  },
                ]}
              >
                {config.description}
              </Text>
            </View>
          </View>

          <View style={styles.categoryActions}>
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor: isDark
                    ? "rgba(0,0,0,0.25)"
                    : "rgba(255,255,255,0.80)",
                },
              ]}
            >
              <Text style={[styles.countBadgeText, { color: primaryColor }]}>
                {activeCount}/{totalCount}
              </Text>
            </View>
            <Pressable onPress={onSelectAll} hitSlop={10}>
              <Text style={[styles.actionText, { color: primaryColor }]}>
                All
              </Text>
            </Pressable>
            <Text
              style={[
                styles.actionSep,
                { color: isDark ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.15)" },
              ]}
            >
              ·
            </Text>
            <Pressable onPress={onClearAll} hitSlop={10}>
              <Text
                style={[
                  styles.actionText,
                  {
                    color: isDark
                      ? "rgba(255,255,255,0.40)"
                      : "rgba(0,0,0,0.35)",
                  },
                ]}
              >
                None
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Progress Bar */}
        <View
          style={[
            styles.categoryProgressTrack,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.06)",
            },
          ]}
        >
          <View
            style={[
              styles.categoryProgressFill,
              { width: `${pct}%`, backgroundColor: primaryColor },
            ]}
          />
        </View>

        {/* Chips Grid */}
        <View style={styles.chipsGrid}>
          {chips.map((chip) => (
            <EmotionChip
              key={chip.name}
              name={chip.name}
              isActive={chip.isActive || chip.isCustom}
              isCustom={chip.isCustom}
              category={category}
              isDark={isDark}
              onPress={() =>
                chip.isCustom ? onRemove(chip.name) : onToggle(chip.name)
              }
              onLongPress={
                chip.isCustom
                  ? () => onOpenMoveDialog(chip.name, category)
                  : undefined
              }
              onEdit={chip.isCustom ? () => onEdit(chip.name, category) : undefined}
            />
          ))}

          {/* Add New Chip */}
          <Pressable
            onPress={onAddNew}
            style={[
              styles.addChip,
              {
                borderColor: isDark
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(0,0,0,0.10)",
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.02)",
              },
            ]}
          >
            <Ionicons
              name="add"
              size={16}
              color={isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.30)"}
            />
            <Text
              style={[
                styles.addChipText,
                {
                  color: isDark
                    ? "rgba(255,255,255,0.40)"
                    : "rgba(0,0,0,0.35)",
                },
              ]}
            >
              Add
            </Text>
          </Pressable>
        </View>

        {chips.length === 0 && (
          <Text
            style={[
              styles.emptyText,
              {
                color: isDark
                  ? "rgba(255,255,255,0.35)"
                  : "rgba(0,0,0,0.30)",
              },
            ]}
          >
            No emotions in this category yet
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── EmotionChip Component ───────────────────────────────────────────────────

interface EmotionChipProps {
  name: string;
  isActive: boolean;
  isCustom: boolean;
  category: Emotion["category"];
  isDark: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onEdit?: () => void;
}

function EmotionChip({
  name,
  isActive,
  isCustom,
  category,
  isDark,
  onPress,
  onLongPress,
  onEdit,
}: EmotionChipProps) {
  const config = CATEGORY_CONFIG[category];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 70 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 110 });
  };

  const chipBg = isActive
    ? isDark
      ? config.darkChipActive
      : config.lightChipActive
    : isDark
      ? "rgba(255,255,255,0.05)"
      : "rgba(255,255,255,0.80)";

  const chipBorder = isActive
    ? isDark
      ? config.darkChipBorder
      : config.lightChipBorder
    : isDark
      ? "rgba(255,255,255,0.10)"
      : "rgba(0,0,0,0.08)";

  const textColor = isActive
    ? isDark
      ? config.darkPrimary
      : config.lightPrimary
    : isDark
      ? "rgba(255,255,255,0.40)"
      : "rgba(0,0,0,0.35)";

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      delayLongPress={400}
      style={[
        animatedStyle,
        styles.chip,
        {
          backgroundColor: chipBg,
          borderColor: chipBorder,
          borderWidth: isActive ? 1.5 : 1,
        },
      ]}
    >
      {isActive && (
        <View
          style={[
            styles.chipIcon,
            {
              backgroundColor: isDark
                ? config.darkPrimary
                : config.lightPrimary,
            },
          ]}
        >
          <Ionicons
            name={isCustom ? "close" : "checkmark"}
            size={10}
            color="#FFFFFF"
          />
        </View>
      )}
      <Text
        style={[
          styles.chipText,
          { color: textColor, fontWeight: isActive ? "600" : "400" },
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {isCustom && onEdit && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onEdit();
          }}
          hitSlop={8}
          style={styles.chipEditBtn}
        >
          <Ionicons
            name="pencil"
            size={12}
            color={isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.35)"}
          />
        </Pressable>
      )}
    </AnimatedPressable>
  );
}

// ─── EmotionModal Component ──────────────────────────────────────────────────

interface EmotionModalProps {
  visible: boolean;
  editingEmotion: {
    name: string;
    category: Emotion["category"];
    isNew: boolean;
  } | null;
  isDark: boolean;
  onClose: () => void;
  onSave: (name: string, category: Emotion["category"], originalName?: string) => void;
}

interface RemoveEmotionDialogProps {
  visible: boolean;
  emotionName: string | null;
  isDark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

interface MoveEmotionDialogProps {
  visible: boolean;
  emotionName: string | null;
  currentCategory: Emotion["category"] | null;
  isDark: boolean;
  onCancel: () => void;
  onSelectCategory: (category: Emotion["category"]) => void;
}

function EmotionModal({
  visible,
  editingEmotion,
  isDark,
  onClose,
  onSave,
}: EmotionModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Emotion["category"]>("positive");
  const inputRef = useRef<TextInput>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (visible && editingEmotion) {
      setName(editingEmotion.name);
      setCategory(editingEmotion.category);
    } else if (!visible) {
      setName("");
    }
  }, [visible, editingEmotion]);

  React.useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  const handleModalShow = React.useCallback(() => {
    if (!visible) return;

    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }

    // Let the sheet settle before focusing so the keyboard doesn't fight
    // the entrance transition on iOS.
    focusTimeoutRef.current = setTimeout(() => {
      inputRef.current?.focus();
    }, 220);
  }, [visible]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(
      name,
      category,
      editingEmotion?.isNew ? undefined : editingEmotion?.name
    );
    setName("");
  };

  const cardBg = isDark ? "rgba(46,64,56,0.95)" : "#FFFFFF";
  const inputBg = isDark ? "rgba(0,0,0,0.25)" : "#F5F1E8";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={handleModalShow}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom + 12 : 0}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>

        <Animated.View
          entering={FadeInUp.duration(180)}
          exiting={SlideOutDown.duration(180)}
          style={[styles.modalCard, { backgroundColor: cardBg }]}
        >
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalCardContent}
          >
            {/* Modal Handle */}
            <View style={styles.modalHandle}>
              <View
                style={[
                  styles.handleBar,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.20)"
                      : "rgba(0,0,0,0.12)",
                  },
                ]}
              />
            </View>

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? "#F0EDE6" : "#3D352A" },
                ]}
              >
                {editingEmotion?.isNew ? "Add Emotion" : "Edit Emotion"}
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.40)"}
                />
              </Pressable>
            </View>

            {/* Category Selector */}
            <View style={styles.modalCategoryRow}>
              {CATEGORIES.map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                const isSelected = cat === category;
                const color = isDark ? config.darkPrimary : config.lightPrimary;

                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      haptics.light();
                      setCategory(cat);
                    }}
                    style={[
                      styles.modalCategoryPill,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? config.darkAccentBg
                            : config.lightAccentBg
                          : "transparent",
                        borderColor: isSelected
                          ? color
                          : isDark
                            ? "rgba(255,255,255,0.12)"
                            : "rgba(0,0,0,0.08)",
                      },
                    ]}
                  >
                    {isSelected && (
                      <View
                        style={[styles.modalCategoryDot, { backgroundColor: color }]}
                      />
                    )}
                    <Text
                      style={[
                        styles.modalCategoryText,
                        {
                          color: isSelected
                            ? color
                            : isDark
                              ? "rgba(255,255,255,0.50)"
                              : "rgba(0,0,0,0.45)",
                          fontWeight: isSelected ? "600" : "400",
                        },
                      ]}
                    >
                      {config.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Input */}
            <View style={styles.modalInputRow}>
              <TextInput
                ref={inputRef}
                value={name}
                onChangeText={setName}
                placeholder="Emotion name..."
                placeholderTextColor={
                  isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)"
                }
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: inputBg,
                    color: isDark ? "#F0EDE6" : "#3D352A",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(0,0,0,0.06)",
                  },
                ]}
                blurOnSubmit={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Pressable
                onPress={onClose}
                style={[
                  styles.modalBtn,
                  styles.modalCancelBtn,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.05)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalBtnText,
                    {
                      color: isDark
                        ? "rgba(255,255,255,0.60)"
                        : "rgba(0,0,0,0.50)",
                    },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!name.trim()}
                style={[
                  styles.modalBtn,
                  styles.modalSaveBtn,
                  {
                    backgroundColor: name.trim()
                      ? "#5B8A5B"
                      : isDark
                        ? "rgba(91,138,91,0.30)"
                        : "rgba(91,138,91,0.25)",
                  },
                ]}
              >
                <Ionicons
                  name={editingEmotion?.isNew ? "add" : "checkmark"}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.modalSaveBtnText}>
                  {editingEmotion?.isNew ? "Add" : "Save"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RemoveEmotionDialog({
  visible,
  emotionName,
  isDark,
  onCancel,
  onConfirm,
}: RemoveEmotionDialogProps) {
  if (!emotionName) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.confirmOverlay}>
        <Pressable style={styles.confirmBackdrop} onPress={onCancel}>
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(140)}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>

        <Animated.View
          entering={FadeInUp.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[
            styles.confirmCard,
            {
              backgroundColor: isDark ? "rgba(42, 38, 34, 0.98)" : "#FFFDFC",
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(199,84,65,0.12)",
            },
          ]}
        >
          <View
            style={[
              styles.confirmIconWrap,
              {
                backgroundColor: isDark
                  ? "rgba(199,84,65,0.16)"
                  : "rgba(199,84,65,0.10)",
              },
            ]}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={isDark ? "#F5A899" : "#C75441"}
            />
          </View>

          <Text
            style={[
              styles.confirmTitle,
              { color: isDark ? "#F0EDE6" : "#3D352A" },
            ]}
          >
            Remove Emotion?
          </Text>

          <Text
            style={[
              styles.confirmBody,
              {
                color: isDark
                  ? "rgba(240,237,230,0.72)"
                  : "rgba(61,53,42,0.72)",
              },
            ]}
          >
            {`Remove "${emotionName}" from your future emotion list? Past entries will keep their snapshots.`}
          </Text>

          <View style={styles.confirmActions}>
            <Pressable
              onPress={onCancel}
              style={[
                styles.confirmButton,
                styles.confirmCancelButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.07)"
                    : "rgba(0,0,0,0.045)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <Text
                style={[
                  styles.confirmCancelText,
                  {
                    color: isDark
                      ? "rgba(255,255,255,0.68)"
                      : "rgba(61,53,42,0.65)",
                  },
                ]}
              >
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              style={[
                styles.confirmButton,
                styles.confirmRemoveButton,
                {
                  backgroundColor: isDark ? "#B95747" : "#C75441",
                },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
              <Text style={styles.confirmRemoveText}>Remove</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MoveEmotionDialog({
  visible,
  emotionName,
  currentCategory,
  isDark,
  onCancel,
  onSelectCategory,
}: MoveEmotionDialogProps) {
  if (!emotionName || !currentCategory) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.confirmOverlay}>
        <Pressable style={styles.confirmBackdrop} onPress={onCancel}>
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(140)}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>

        <Animated.View
          entering={FadeInUp.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[
            styles.confirmCard,
            styles.moveCard,
            {
              backgroundColor: isDark ? "rgba(36, 34, 40, 0.98)" : "#FFFCFA",
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(105,92,120,0.12)",
            },
          ]}
        >
          <View
            style={[
              styles.confirmIconWrap,
              {
                backgroundColor: isDark
                  ? "rgba(105,92,120,0.18)"
                  : "rgba(105,92,120,0.10)",
              },
            ]}
          >
            <Ionicons
              name="swap-horizontal-outline"
              size={18}
              color={isDark ? "#C4BBCF" : "#695C78"}
            />
          </View>

          <Text
            style={[
              styles.confirmTitle,
              { color: isDark ? "#F0EDE6" : "#3D352A" },
            ]}
          >
            Move {emotionName}
          </Text>

          <Text
            style={[
              styles.confirmBody,
              styles.moveBody,
              {
                color: isDark
                  ? "rgba(240,237,230,0.72)"
                  : "rgba(61,53,42,0.72)",
              },
            ]}
          >
            Choose a new category for this custom emotion.
          </Text>

          <View style={styles.moveOptions}>
            {CATEGORIES.map((category) => {
              const config = CATEGORY_CONFIG[category];
              const isCurrent = category === currentCategory;
              const color = isDark ? config.darkPrimary : config.lightPrimary;

              return (
                <Pressable
                  key={category}
                  onPress={() => {
                    haptics.light();
                    onSelectCategory(category);
                  }}
                  style={[
                    styles.moveOption,
                    {
                      backgroundColor: isCurrent
                        ? isDark
                          ? config.darkAccentBg
                          : config.lightAccentBg
                        : isDark
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(0,0,0,0.025)",
                      borderColor: color,
                      opacity: isCurrent ? 0.72 : 1,
                    },
                  ]}
                  disabled={isCurrent}
                >
                  <View
                    style={[
                      styles.moveOptionDot,
                      { backgroundColor: color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.moveOptionLabel,
                      { color },
                    ]}
                  >
                    {config.label}
                  </Text>
                  <Text
                    style={[
                      styles.moveOptionHint,
                      {
                        color: isDark
                          ? "rgba(255,255,255,0.46)"
                          : "rgba(61,53,42,0.52)",
                      },
                    ]}
                  >
                    {isCurrent ? "Current" : "Move here"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onCancel}
            style={[
              styles.moveCancelButton,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.07)"
                  : "rgba(0,0,0,0.045)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Text
              style={[
                styles.confirmCancelText,
                {
                  color: isDark
                    ? "rgba(255,255,255,0.68)"
                    : "rgba(61,53,42,0.65)",
                },
              ]}
            >
              Cancel
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Hero Section
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    overflow: "hidden",
  },
  heroCornerAccent: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  heroBadgeText: {
    fontSize: 15,
    fontWeight: "800",
  },
  heroProgressContainer: {
    marginBottom: 16,
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: 4,
    flexDirection: "row",
    overflow: "hidden",
  },
  heroProgressSegment: {
    height: 8,
  },
  heroStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  statPillCount: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statPillLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Category Section
  categoryContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  categoryCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  categoryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  categoryDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  categoryActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 2,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  actionSep: {
    marginHorizontal: 6,
    fontSize: 14,
  },
  categoryProgressTrack: {
    height: 3,
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 14,
  },
  categoryProgressFill: {
    height: 3,
    borderRadius: 2,
  },
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: "italic",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Chips
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  chipIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    letterSpacing: -0.2,
    maxWidth: 100,
  },
  chipEditBtn: {
    marginLeft: 6,
    padding: 2,
  },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginRight: 8,
    marginBottom: 8,
  },
  addChipText: {
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 4,
  },

  // Tips Section
  tipsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tipsCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  tipsIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    lineHeight: 18,
  },

  // FAB
  fabContainer: {
    position: "absolute",
    bottom: 28,
    right: 20,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.50)",
  },
  modalCard: {
    marginTop: 80,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    maxHeight: "86%",
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  modalCardContent: {
    paddingBottom: 4,
  },
  modalHandle: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  modalCategoryRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  modalCategoryPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  modalCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  modalCategoryText: {
    fontSize: 14,
  },
  modalInputRow: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  modalInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
  },
  modalCancelBtn: {},
  modalBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalSaveBtn: {},
  modalSaveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 6,
  },

  // Confirm dialog
  confirmOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12, 10, 8, 0.46)",
  },
  confirmCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 16,
  },
  confirmIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  confirmBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderWidth: 1,
  },
  confirmCancelButton: {},
  confirmRemoveButton: {
    borderColor: "transparent",
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmRemoveText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 8,
  },
  moveCard: {
    maxWidth: 380,
  },
  moveBody: {
    marginBottom: 18,
  },
  moveOptions: {
    gap: 10,
    marginBottom: 14,
  },
  moveOption: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  moveOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginBottom: 10,
  },
  moveOptionLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 3,
  },
  moveOptionHint: {
    fontSize: 13,
    fontWeight: "500",
  },
  moveCancelButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
