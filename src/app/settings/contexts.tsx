import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
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
import { DEFAULT_CONTEXTS } from "@/lib/entrySettings";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import {
  hasPresetValue,
  normalizePresetKey,
  toggleContextPreset,
} from "@/features/settings/utils/defaultPresetSelection";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { useColorScheme } from "@/hooks/useColorScheme";
import { haptics } from "@/lib/haptics";

const DEFAULT_CONTEXT_COUNT = DEFAULT_CONTEXTS.length;

const CONTEXT_THEME = {
  lightPrimary: "#695C78",
  darkPrimary: "#C4BBCF",
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
  lightCustomBg: "#FDFCFA",
  darkCustomBg: "rgba(255,255,255,0.05)",
  lightCustomBorder: "rgba(0,0,0,0.08)",
  darkCustomBorder: "rgba(255,255,255,0.10)",
} as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ContextsSettingsScreen() {
  const isDark = useColorScheme() === "dark";
  const contexts = useSettingsStore((state) => state.contexts);
  const setContexts = useSettingsStore((state) => state.setContexts);

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [contextPendingRemoval, setContextPendingRemoval] = useState<string | null>(
    null
  );

  const normalizedDefaultKeys = useMemo(
    () => new Set(DEFAULT_CONTEXTS.map((context) => normalizePresetKey(context))),
    []
  );

  const counts = useMemo(() => {
    const activeDefaults = DEFAULT_CONTEXTS.filter((context) =>
      hasPresetValue(contexts, context)
    ).length;
    const customCount = contexts.filter(
      (context) => !normalizedDefaultKeys.has(normalizePresetKey(context))
    ).length;

    return {
      activeDefaults,
      customCount,
      total: activeDefaults + customCount,
    };
  }, [contexts, normalizedDefaultKeys]);

  const defaultChips = useMemo(
    () =>
      DEFAULT_CONTEXTS.map((context) => ({
        name: context,
        isActive: hasPresetValue(contexts, context),
      })),
    [contexts]
  );

  const customContexts = useMemo(
    () =>
      contexts.filter(
        (context) => !normalizedDefaultKeys.has(normalizePresetKey(context))
      ),
    [contexts, normalizedDefaultKeys]
  );

  const handleToggleDefaultContext = useCallback(
    async (name: string) => {
      haptics.light();
      const defaultContext = DEFAULT_CONTEXTS.find(
        (context) => normalizePresetKey(context) === normalizePresetKey(name)
      );

      if (!defaultContext) return;
      await setContexts(toggleContextPreset(contexts, defaultContext));
    },
    [contexts, setContexts]
  );

  const handleSelectAllDefaults = useCallback(async () => {
    haptics.light();
    const have = new Set(contexts.map((context) => normalizePresetKey(context)));
    const additions = DEFAULT_CONTEXTS.filter(
      (context) => !have.has(normalizePresetKey(context))
    );
    if (additions.length) {
      await setContexts([...contexts, ...additions]);
    }
  }, [contexts, setContexts]);

  const handleClearAllDefaults = useCallback(async () => {
    haptics.light();
    await setContexts(
      contexts.filter(
        (context) => !normalizedDefaultKeys.has(normalizePresetKey(context))
      )
    );
  }, [contexts, normalizedDefaultKeys, setContexts]);

  const handleOpenAddModal = useCallback(() => {
    haptics.light();
    setIsAddModalVisible(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalVisible(false);
  }, []);

  const handleAddContext = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      if (hasPresetValue(contexts, trimmed)) {
        Alert.alert("Duplicate Context", "This context already exists.");
        return;
      }

      haptics.medium();
      await setContexts([...contexts, trimmed]);
      setIsAddModalVisible(false);
    },
    [contexts, setContexts]
  );

  const handleRemoveContext = useCallback((name: string) => {
    haptics.light();
    setContextPendingRemoval(name);
  }, []);

  const handleCancelRemoveContext = useCallback(() => {
    setContextPendingRemoval(null);
  }, []);

  const handleConfirmRemoveContext = useCallback(async () => {
    if (!contextPendingRemoval) return;

    haptics.destructive();
    const target = normalizePresetKey(contextPendingRemoval);
    await setContexts(
      contexts.filter((context) => normalizePresetKey(context) !== target)
    );
    setContextPendingRemoval(null);
  }, [contextPendingRemoval, contexts, setContexts]);

  return (
    <SafeAreaView
      className="flex-1 bg-paper-100 dark:bg-paper-900"
      edges={["top"]}
    >
      <SettingsPageHeader
        title="Context Tags"
        subtitle="Customization"
        icon="pricetag-outline"
        accentColor="dusk"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={styles.heroSection}
        >
          <ContextHeroStats counts={counts} isDark={isDark} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <DefaultContextsSection
            chips={defaultChips}
            isDark={isDark}
            onToggle={handleToggleDefaultContext}
            onSelectAll={handleSelectAllDefaults}
            onClearAll={handleClearAllDefaults}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).springify()}>
          <CustomContextsSection
            contexts={customContexts}
            isDark={isDark}
            onAddNew={handleOpenAddModal}
            onRemove={handleRemoveContext}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(340).springify()}
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
                Use context tags for places, social settings, and recurring
                routines you want to compare over time.
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(420).springify()}
        style={styles.fabContainer}
      >
        <Pressable
          onPress={handleOpenAddModal}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: CONTEXT_THEME.lightPrimary,
              transform: [{ scale: pressed ? 0.95 : 1 }],
              shadowColor: CONTEXT_THEME.lightPrimary,
            },
          ]}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      <AddContextModal
        visible={isAddModalVisible}
        isDark={isDark}
        onClose={handleCloseAddModal}
        onSave={handleAddContext}
      />

      <RemoveContextDialog
        visible={contextPendingRemoval !== null}
        contextName={contextPendingRemoval}
        isDark={isDark}
        onCancel={handleCancelRemoveContext}
        onConfirm={handleConfirmRemoveContext}
      />
    </SafeAreaView>
  );
}

function ContextHeroStats({
  counts,
  isDark,
}: {
  counts: { activeDefaults: number; customCount: number; total: number };
  isDark: boolean;
}) {
  const builtInPct = counts.total > 0 ? (counts.activeDefaults / counts.total) * 100 : 0;
  const customPct = counts.total > 0 ? (counts.customCount / counts.total) * 100 : 0;
  const mutedPct = counts.total > 0 ? Math.max(0, 100 - builtInPct - customPct) : 100;

  return (
    <View
      style={[
        styles.heroCard,
        {
          backgroundColor: isDark ? "rgba(32,30,42,0.62)" : "#FDFCFA",
          borderColor: isDark ? "rgba(80,70,98,0.42)" : "rgba(221,212,196,0.80)",
        },
      ]}
    >
      <View
        style={[
          styles.heroCornerAccent,
          {
            backgroundColor: isDark
              ? "rgba(105,92,120,0.16)"
              : "rgba(105,92,120,0.08)",
          },
        ]}
      />

      <View style={styles.heroHeader}>
        <View style={styles.heroTitleRow}>
          <View
            style={[
              styles.heroIconBg,
              {
                backgroundColor: isDark
                  ? "rgba(105,92,120,0.20)"
                  : "rgba(105,92,120,0.12)",
              },
            ]}
          >
            <Ionicons
              name="pricetag"
              size={16}
              color={isDark ? CONTEXT_THEME.darkPrimary : CONTEXT_THEME.lightPrimary}
            />
          </View>
          <Text
            style={[
              styles.heroTitle,
              { color: isDark ? "#F0EDE6" : "#3D352A" },
            ]}
          >
            Your Context Library
          </Text>
        </View>

        <View
          style={[
            styles.heroBadge,
            {
              backgroundColor: isDark
                ? "rgba(105,92,120,0.20)"
                : "rgba(105,92,120,0.12)",
            },
          ]}
        >
          <Text
            style={[
              styles.heroBadgeText,
              {
                color: isDark
                  ? CONTEXT_THEME.darkPrimary
                  : CONTEXT_THEME.lightPrimary,
              },
            ]}
          >
            {counts.total}
          </Text>
        </View>
      </View>

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
              <View
                style={[
                  styles.heroProgressSegment,
                  {
                    width: `${builtInPct}%`,
                    backgroundColor: isDark ? "#A396B3" : "#695C78",
                    borderTopLeftRadius: 4,
                    borderBottomLeftRadius: 4,
                  },
                ]}
              />
              <View
                style={[
                  styles.heroProgressSegment,
                  {
                    width: `${customPct}%`,
                    backgroundColor: isDark ? "#D4C4A0" : "#BDA77D",
                  },
                ]}
              />
              <View
                style={[
                  styles.heroProgressSegment,
                  {
                    width: `${mutedPct}%`,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.09)"
                      : "rgba(0,0,0,0.06)",
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                  },
                ]}
              />
            </>
          )}
        </View>
      </View>

      <View style={styles.heroStatsRow}>
        <StatPill
          count={counts.activeDefaults}
          label="Built-in"
          color={isDark ? "#C4BBCF" : "#695C78"}
          bgColor={isDark ? "rgba(105,92,120,0.15)" : "rgba(105,92,120,0.08)"}
        />
        <StatPill
          count={counts.customCount}
          label="Custom"
          color={isDark ? "#D9CCB0" : "#9D8660"}
          bgColor={isDark ? "rgba(157,134,96,0.16)" : "rgba(157,134,96,0.10)"}
        />
        <StatPill
          count={DEFAULT_CONTEXT_COUNT}
          label="Presets"
          color={isDark ? "#A8C5A8" : "#5B8A5B"}
          bgColor={isDark ? "rgba(91,138,91,0.15)" : "rgba(91,138,91,0.10)"}
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
      <Text style={[styles.statPillLabel, { color, opacity: 0.78 }]}>
        {label}
      </Text>
    </View>
  );
}

function DefaultContextsSection({
  chips,
  isDark,
  onToggle,
  onSelectAll,
  onClearAll,
}: {
  chips: { name: string; isActive: boolean }[];
  isDark: boolean;
  onToggle: (name: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const activeCount = chips.filter((chip) => chip.isActive).length;
  const pct = chips.length > 0 ? Math.round((activeCount / chips.length) * 100) : 0;
  const primaryColor = isDark ? CONTEXT_THEME.darkPrimary : CONTEXT_THEME.lightPrimary;

  return (
    <View style={styles.sectionContainer}>
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: isDark
              ? CONTEXT_THEME.darkBgSolid
              : CONTEXT_THEME.lightBgSolid,
            borderColor: isDark
              ? CONTEXT_THEME.darkBorder
              : CONTEXT_THEME.lightBorder,
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View
              style={[
                styles.sectionIconBg,
                {
                  backgroundColor: isDark
                    ? CONTEXT_THEME.darkAccentBg
                    : CONTEXT_THEME.lightAccentBg,
                },
              ]}
            >
              <Ionicons name="albums-outline" size={16} color={primaryColor} />
            </View>
            <View>
              <Text style={[styles.sectionLabel, { color: primaryColor }]}>
                Built-In
              </Text>
              <Text
                style={[
                  styles.sectionDescription,
                  {
                    color: isDark
                      ? "rgba(255,255,255,0.45)"
                      : "rgba(0,0,0,0.40)",
                  },
                ]}
              >
                Core tags for common environments and routines
              </Text>
            </View>
          </View>

          <View style={styles.sectionActions}>
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
                {activeCount}/{chips.length}
              </Text>
            </View>
            <Pressable onPress={onSelectAll} hitSlop={10}>
              <Text style={[styles.actionText, { color: primaryColor }]}>All</Text>
            </Pressable>
            <Text
              style={[
                styles.actionSep,
                {
                  color: isDark
                    ? "rgba(255,255,255,0.20)"
                    : "rgba(0,0,0,0.15)",
                },
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

        <View
          style={[
            styles.sectionProgressTrack,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.06)",
            },
          ]}
        >
          <View
            style={[
              styles.sectionProgressFill,
              { width: `${pct}%`, backgroundColor: primaryColor },
            ]}
          />
        </View>

        <View style={styles.chipsGrid}>
          {chips.map((chip) => (
            <ContextChip
              key={chip.name}
              name={chip.name}
              isDark={isDark}
              variant="default"
              isActive={chip.isActive}
              onPress={() => onToggle(chip.name)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function CustomContextsSection({
  contexts,
  isDark,
  onAddNew,
  onRemove,
}: {
  contexts: string[];
  isDark: boolean;
  onAddNew: () => void;
  onRemove: (name: string) => void;
}) {
  const primaryColor = isDark ? "#D9CCB0" : "#9D8660";

  return (
    <View style={styles.sectionContainer}>
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: isDark ? "rgba(46,40,32,0.64)" : "#FDFCFA",
            borderColor: isDark
              ? "rgba(157,134,96,0.26)"
              : "rgba(189,167,125,0.24)",
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View
              style={[
                styles.sectionIconBg,
                {
                  backgroundColor: isDark
                    ? "rgba(157,134,96,0.20)"
                    : "rgba(189,167,125,0.14)",
                },
              ]}
            >
              <Ionicons name="sparkles-outline" size={16} color={primaryColor} />
            </View>
            <View>
              <Text style={[styles.sectionLabel, { color: primaryColor }]}>
                Custom
              </Text>
              <Text
                style={[
                  styles.sectionDescription,
                  {
                    color: isDark
                      ? "rgba(255,255,255,0.45)"
                      : "rgba(0,0,0,0.40)",
                  },
                ]}
              >
                Personal tags for recurring places, people, and routines
              </Text>
            </View>
          </View>

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
              {contexts.length}
            </Text>
          </View>
        </View>

        <View style={styles.chipsGrid}>
          {contexts.map((context) => (
            <ContextChip
              key={context}
              name={context}
              isDark={isDark}
              variant="custom"
              isActive
              onPress={() => onRemove(context)}
            />
          ))}

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

        {contexts.length === 0 && (
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
            No custom contexts yet
          </Text>
        )}
      </View>
    </View>
  );
}

function ContextChip({
  name,
  isDark,
  isActive,
  variant,
  onPress,
}: {
  name: string;
  isDark: boolean;
  isActive: boolean;
  variant: "default" | "custom";
  onPress: () => void;
}) {
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

  const chipBg =
    variant === "custom"
      ? isDark
        ? "rgba(157,134,96,0.14)"
        : "rgba(189,167,125,0.10)"
      : isActive
        ? isDark
          ? CONTEXT_THEME.darkChipActive
          : CONTEXT_THEME.lightChipActive
        : isDark
          ? CONTEXT_THEME.darkCustomBg
          : CONTEXT_THEME.lightCustomBg;

  const chipBorder =
    variant === "custom"
      ? isDark
        ? "rgba(157,134,96,0.32)"
        : "rgba(189,167,125,0.42)"
      : isActive
        ? isDark
          ? CONTEXT_THEME.darkChipBorder
          : CONTEXT_THEME.lightChipBorder
        : isDark
          ? CONTEXT_THEME.darkCustomBorder
          : CONTEXT_THEME.lightCustomBorder;

  const textColor =
    variant === "custom"
      ? isDark
        ? "#D9CCB0"
        : "#9D8660"
      : isActive
        ? isDark
          ? CONTEXT_THEME.darkPrimary
          : CONTEXT_THEME.lightPrimary
        : isDark
          ? "rgba(255,255,255,0.40)"
          : "rgba(0,0,0,0.35)";

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        animatedStyle,
        styles.chip,
        {
          backgroundColor: chipBg,
          borderColor: chipBorder,
          borderWidth: isActive || variant === "custom" ? 1.5 : 1,
        },
      ]}
    >
      {(isActive || variant === "custom") && (
        <View
          style={[
            styles.chipIcon,
            {
              backgroundColor:
                variant === "custom"
                  ? isDark
                    ? "#9D8660"
                    : "#BDA77D"
                  : isDark
                    ? CONTEXT_THEME.darkPrimary
                    : CONTEXT_THEME.lightPrimary,
            },
          ]}
        >
          <Ionicons
            name={variant === "custom" ? "close" : "checkmark"}
            size={10}
            color="#FFFFFF"
          />
        </View>
      )}
      <Text
        style={[
          styles.chipText,
          {
            color: textColor,
            fontWeight: isActive || variant === "custom" ? "600" : "400",
          },
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </AnimatedPressable>
  );
}

function AddContextModal({
  visible,
  isDark,
  onClose,
  onSave,
}: {
  visible: boolean;
  isDark: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<TextInput>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (!visible) {
      setName("");
    }
  }, [visible]);

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

    focusTimeoutRef.current = setTimeout(() => {
      inputRef.current?.focus();
    }, 220);
  }, [visible]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name);
  };

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
          style={[
            styles.modalCard,
            { backgroundColor: isDark ? "rgba(44,40,56,0.95)" : "#FFFFFF" },
          ]}
        >
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalCardContent}
          >
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

            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? "#F0EDE6" : "#3D352A" },
                ]}
              >
                Add Context Tag
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.40)"}
                />
              </Pressable>
            </View>

            <View style={styles.modalTaglineRow}>
              <View
                style={[
                  styles.modalTaglineIcon,
                  {
                    backgroundColor: isDark
                      ? "rgba(105,92,120,0.20)"
                      : "rgba(105,92,120,0.12)",
                  },
                ]}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={16}
                  color={isDark ? CONTEXT_THEME.darkPrimary : CONTEXT_THEME.lightPrimary}
                />
              </View>
              <Text
                style={[
                  styles.modalTagline,
                  {
                    color: isDark
                      ? "rgba(240,237,230,0.70)"
                      : "rgba(61,53,42,0.70)",
                  },
                ]}
              >
                Add a custom label for places, people, or situations you log often.
              </Text>
            </View>

            <View style={styles.modalInputRow}>
              <TextInput
                ref={inputRef}
                value={name}
                onChangeText={setName}
                placeholder="Context name..."
                placeholderTextColor={
                  isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)"
                }
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "#F5F1E8",
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

            <View style={styles.modalActions}>
              <Pressable
                onPress={onClose}
                style={[
                  styles.modalBtn,
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
                  {
                    backgroundColor: name.trim()
                      ? CONTEXT_THEME.lightPrimary
                      : isDark
                        ? "rgba(105,92,120,0.30)"
                        : "rgba(105,92,120,0.25)",
                  },
                ]}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.modalSaveBtnText}>Add</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RemoveContextDialog({
  visible,
  contextName,
  isDark,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  contextName: string | null;
  isDark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!contextName) return null;

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
                : "rgba(157,134,96,0.14)",
            },
          ]}
        >
          <View
            style={[
              styles.confirmIconWrap,
              {
                backgroundColor: isDark
                  ? "rgba(157,134,96,0.16)"
                  : "rgba(189,167,125,0.10)",
              },
            ]}
          >
            <Ionicons
              name="close-outline"
              size={18}
              color={isDark ? "#D9CCB0" : "#9D8660"}
            />
          </View>

          <Text
            style={[
              styles.confirmTitle,
              { color: isDark ? "#F0EDE6" : "#3D352A" },
            ]}
          >
            Remove Context?
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
            {`Remove "${contextName}" from your context list?`}
          </Text>

          <View style={styles.confirmActions}>
            <Pressable
              onPress={onCancel}
              style={[
                styles.confirmButton,
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
                {
                  backgroundColor: isDark ? "#9D8660" : "#BDA77D",
                  borderColor: "transparent",
                },
              ]}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
              <Text style={styles.confirmRemoveText}>Remove</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  sectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 16,
  },
  sectionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  sectionDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionActions: {
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
  sectionProgressTrack: {
    height: 3,
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 14,
  },
  sectionProgressFill: {
    height: 3,
    borderRadius: 2,
  },
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
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
    maxWidth: 110,
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
  emptyText: {
    fontSize: 13,
    fontStyle: "italic",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
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
    maxHeight: "86%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
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
  modalTaglineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  modalTaglineIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  modalTagline: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    paddingTop: 5,
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
  modalBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalSaveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 6,
  },
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
});
