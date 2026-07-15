import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { DEFAULT_CONTEXTS } from "@/lib/entrySettings";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import {
  createPresetListModel,
  normalizePresetKey,
} from "@/features/settings/utils/defaultPresetSelection";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { presetSyncService } from "@/services/presetSyncService";
import { useColorScheme } from "@/hooks/useColorScheme";
import { haptics } from "@/lib/haptics";
import { Alert } from "@/components/ui/AppAlert";
import {
  AddContextModal,
  RemoveContextDialog,
} from "@/features/settings/contexts/ContextSettingsDialogs";
import { CONTEXT_THEME } from "@/features/settings/contexts/contextSettingsConfig";
import {
  PresetAddChip,
  PresetChip,
  PresetChipsGrid,
  PresetEmptyText,
  PresetHistorySyncCard,
  PresetHeroStats,
  PresetSectionCard,
  PresetTipCard,
  presetListStyles,
  type PresetTone,
} from "@/features/settings/presets/PresetListPrimitives";

export default function ContextsSettingsScreen() {
  const isDark = useColorScheme() === "dark";
  const contexts = useSettingsStore((state) => state.contexts);
  const setContexts = useSettingsStore((state) => state.setContexts);

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [contextPendingRemoval, setContextPendingRemoval] = useState<string | null>(
    null
  );
  const [historySyncLoading, setHistorySyncLoading] = useState(false);

  const presetModel = useMemo(
    () =>
      createPresetListModel({
        values: contexts,
        defaults: DEFAULT_CONTEXTS,
        getLabel: (context) => context,
      }),
    [contexts]
  );

  const counts = presetModel.counts;
  const defaultChips = useMemo(
    () =>
      presetModel.defaultItems.map((item) => ({
        name: item.label,
        isActive: item.isActive,
      })),
    [presetModel]
  );
  const customContexts = useMemo(
    () => presetModel.customItems.map((item) => item.value),
    [presetModel]
  );

  const handleToggleDefaultContext = useCallback(
    async (name: string) => {
      haptics.light();
      const defaultContext = DEFAULT_CONTEXTS.find(
        (context) => normalizePresetKey(context) === normalizePresetKey(name)
      );

      if (!defaultContext) return;
      await setContexts(presetModel.toggleDefault(defaultContext));
    },
    [presetModel, setContexts]
  );

  const handleSelectAllDefaults = useCallback(async () => {
    haptics.light();
    await setContexts(presetModel.selectAllDefaults());
  }, [presetModel, setContexts]);

  const handleClearAllDefaults = useCallback(async () => {
    haptics.light();
    await setContexts(presetModel.clearDefaults());
  }, [presetModel, setContexts]);

  const handleOpenAddModal = useCallback(() => {
    haptics.light();
    setIsAddModalVisible(true);
  }, []);

  const handleAddFromHistory = useCallback(async () => {
    haptics.light();

    try {
      setHistorySyncLoading(true);
      const diff = await presetSyncService.previewMissingFromHistory("contexts");
      setHistorySyncLoading(false);

      if (diff.contexts.length === 0) {
        Alert.alert(
          "Nothing to Add",
          "Every context tag in your Mood Entry history is already in your Context Tag List."
        );
        return;
      }

      Alert.alert(
        "Add from History",
        `Add ${diff.contexts.length} context tag${diff.contexts.length === 1 ? "" : "s"} from past Mood Entries to your Context Tag List?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add",
            onPress: async () => {
              try {
                setHistorySyncLoading(true);
                const result =
                  await presetSyncService.addMissingFromHistory("contexts");
                haptics.success();
                Alert.alert(
                  "Added from History",
                  result.addedContexts.length > 0
                    ? `Added ${result.addedContexts.length} context tag${result.addedContexts.length === 1 ? "" : "s"}.`
                    : "No new context tags were found."
                );
              } catch {
                haptics.error();
                Alert.alert("Error", "Could not add context tags from history.");
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

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalVisible(false);
  }, []);

  const handleAddContext = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const result = presetModel.addCustom(trimmed);
      if (!result.ok && result.reason === "duplicate") {
        Alert.alert("Duplicate Context", "This context already exists.");
        return;
      }
      if (!result.ok) return;

      haptics.medium();
      await setContexts(result.values);
      setIsAddModalVisible(false);
    },
    [presetModel, setContexts]
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
    await setContexts(presetModel.removeByLabel(contextPendingRemoval));
    setContextPendingRemoval(null);
  }, [contextPendingRemoval, presetModel, setContexts]);

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
          entering={FadeInDown.delay(100).duration(260)}
          style={presetListStyles.heroSection}
        >
          <ContextHeroStats counts={counts} isDark={isDark} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(260)}>
          <DefaultContextsSection
            chips={defaultChips}
            isDark={isDark}
            onToggle={handleToggleDefaultContext}
            onSelectAll={handleSelectAllDefaults}
            onClearAll={handleClearAllDefaults}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(260)}>
          <CustomContextsSection
            contexts={customContexts}
            isDark={isDark}
            onAddNew={handleOpenAddModal}
            onRemove={handleRemoveContext}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(380).duration(260)}
        >
          <PresetTipCard isDark={isDark}>
            Use context tags for places, social settings, and recurring routines
            you want to compare over time.
          </PresetTipCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(440).duration(260)}>
          <PresetHistorySyncCard
            title="Add from History"
            description="Find logged context tags missing from this list"
            icon="time-outline"
            isDark={isDark}
            tone={contextTone(isDark)}
            loading={historySyncLoading}
            onPress={handleAddFromHistory}
          />
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(420).duration(260)}
        style={presetListStyles.fabContainer}
      >
        <Pressable
          onPress={handleOpenAddModal}
          style={({ pressed }) => [
            presetListStyles.fab,
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

function contextTone(isDark: boolean): PresetTone {
  return {
    primary: isDark ? CONTEXT_THEME.darkPrimary : CONTEXT_THEME.lightPrimary,
    cardBg: isDark ? CONTEXT_THEME.darkBgSolid : CONTEXT_THEME.lightBgSolid,
    border: isDark ? CONTEXT_THEME.darkBorder : CONTEXT_THEME.lightBorder,
    accentBg: isDark ? CONTEXT_THEME.darkAccentBg : CONTEXT_THEME.lightAccentBg,
    chipActive: isDark ? CONTEXT_THEME.darkChipActive : CONTEXT_THEME.lightChipActive,
    chipBorder: isDark ? CONTEXT_THEME.darkChipBorder : CONTEXT_THEME.lightChipBorder,
  };
}

function customContextTone(isDark: boolean): PresetTone {
  return {
    primary: isDark ? "#D9CCB0" : "#9D8660",
    cardBg: isDark ? "rgba(46,40,32,0.64)" : "#FDFCFA",
    border: isDark ? "rgba(157,134,96,0.26)" : "rgba(189,167,125,0.24)",
    accentBg: isDark ? "rgba(157,134,96,0.20)" : "rgba(189,167,125,0.14)",
    chipActive: isDark ? "rgba(157,134,96,0.14)" : "rgba(189,167,125,0.10)",
    chipBorder: isDark ? "rgba(157,134,96,0.32)" : "rgba(189,167,125,0.42)",
  };
}

function ContextHeroStats({
  counts,
  isDark,
}: {
  counts: { activeDefaults: number; customCount: number; total: number };
  isDark: boolean;
}) {
  const builtInSegment = {
    count: counts.activeDefaults,
    label: "Built-in",
    color: isDark ? "#C4BBCF" : "#695C78",
    bgColor: isDark ? "rgba(105,92,120,0.15)" : "rgba(105,92,120,0.08)",
    progressColor: isDark ? "#A396B3" : "#695C78",
  };
  const customSegment = {
    count: counts.customCount,
    label: "Custom",
    color: isDark ? "#D9CCB0" : "#9D8660",
    bgColor: isDark ? "rgba(157,134,96,0.16)" : "rgba(157,134,96,0.10)",
    progressColor: isDark ? "#D4C4A0" : "#BDA77D",
  };
  const presetsSegment = {
    count: DEFAULT_CONTEXTS.length,
    label: "Presets",
    color: isDark ? "#A8C5A8" : "#5B8A5B",
    bgColor: isDark ? "rgba(91,138,91,0.15)" : "rgba(91,138,91,0.10)",
    progressColor: isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.06)",
  };

  return (
    <PresetHeroStats
      title="Your Context Library"
      icon="pricetag"
      total={counts.total}
      isDark={isDark}
      tone={{
        ...contextTone(isDark),
        cardBg: isDark ? "rgba(32,30,42,0.62)" : "#FDFCFA",
        border: isDark ? "rgba(80,70,98,0.42)" : "rgba(221,212,196,0.80)",
      }}
      segments={[builtInSegment, customSegment, presetsSegment]}
      progressSegments={[builtInSegment, customSegment]}
    />
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
  const tone = contextTone(isDark);

  return (
    <PresetSectionCard
      title="Built-In"
      description="Core tags for common environments and routines"
      icon="albums-outline"
      countLabel={`${activeCount}/${chips.length}`}
      progressPct={pct}
      isDark={isDark}
      tone={tone}
      onSelectAll={onSelectAll}
      onClearAll={onClearAll}
    >
      <PresetChipsGrid>
        {chips.map((chip) => (
          <PresetChip
            key={chip.name}
            label={chip.name}
            isDark={isDark}
            isActive={chip.isActive}
            isCustom={false}
            tone={tone}
            onPress={() => onToggle(chip.name)}
          />
        ))}
      </PresetChipsGrid>
    </PresetSectionCard>
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
  const tone = customContextTone(isDark);

  return (
    <PresetSectionCard
      title="Custom"
      description="Personal tags for recurring places, people, and routines"
      icon="sparkles-outline"
      countLabel={String(contexts.length)}
      isDark={isDark}
      tone={tone}
    >
      <PresetChipsGrid>
        {contexts.map((context) => (
          <PresetChip
            key={context}
            label={context}
            isDark={isDark}
            isActive
            isCustom
            tone={tone}
            onPress={() => onRemove(context)}
          />
        ))}
        <PresetAddChip
          isDark={isDark}
          onPress={onAddNew}
          accessibilityLabel="Add custom context tag"
        />
      </PresetChipsGrid>

      {contexts.length === 0 && (
        <PresetEmptyText isDark={isDark}>
          No custom contexts yet
        </PresetEmptyText>
      )}
    </PresetSectionCard>
  );
}
