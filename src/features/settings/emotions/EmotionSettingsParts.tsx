import React from "react";
import type { Emotion } from "@db/types";
import { CATEGORY_CONFIG } from "./emotionSettingsConfig";
import {
  PresetAddChip,
  PresetChip,
  PresetChipsGrid,
  PresetEmptyText,
  PresetHeroStats,
  PresetSectionCard,
  type PresetTone,
} from "@/features/settings/presets/PresetListPrimitives";

function categoryTone(
  category: Emotion["category"],
  isDark: boolean
): PresetTone {
  const config = CATEGORY_CONFIG[category];
  return {
    primary: isDark ? config.darkPrimary : config.lightPrimary,
    cardBg: isDark ? config.darkBgSolid : config.lightBgSolid,
    border: isDark ? config.darkBorder : config.lightBorder,
    accentBg: isDark ? config.darkAccentBg : config.lightAccentBg,
    chipActive: isDark ? config.darkChipActive : config.lightChipActive,
    chipBorder: isDark ? config.darkChipBorder : config.lightChipBorder,
  };
}

function HeroStats({
  counts,
  isDark,
}: {
  counts: { positive: number; negative: number; neutral: number; total: number };
  isDark: boolean;
}) {
  return (
    <PresetHeroStats
      title="Your Emotion Library"
      icon="heart"
      total={counts.total}
      isDark={isDark}
      tone={{
        primary: isDark ? "#A8C5A8" : "#5B8A5B",
        cardBg: isDark ? "rgba(30,45,38,0.60)" : "#FDFCFA",
        border: isDark ? "rgba(58,84,72,0.40)" : "rgba(221,212,196,0.80)",
        accentBg: isDark ? "rgba(91,138,91,0.20)" : "rgba(91,138,91,0.12)",
        chipActive: isDark ? "rgba(91,138,91,0.45)" : "#C8E0C8",
        chipBorder: isDark ? "#7BA87B" : "#5B8A5B",
      }}
      segments={[
        {
          count: counts.positive,
          label: "Positive",
          color: isDark ? "#A8C5A8" : "#5B8A5B",
          bgColor: isDark ? "rgba(91,138,91,0.15)" : "rgba(91,138,91,0.10)",
          progressColor: isDark ? "#7BA87B" : "#5B8A5B",
        },
        {
          count: counts.negative,
          label: "Negative",
          color: isDark ? "#F5A899" : "#C75441",
          bgColor: isDark ? "rgba(199,84,65,0.15)" : "rgba(199,84,65,0.08)",
          progressColor: isDark ? "#E88070" : "#C75441",
        },
        {
          count: counts.neutral,
          label: "Neutral",
          color: isDark ? "#C4BBCF" : "#695C78",
          bgColor: isDark ? "rgba(105,92,120,0.15)" : "rgba(105,92,120,0.08)",
          progressColor: isDark ? "#A396B3" : "#695C78",
        },
      ]}
    />
  );
}

interface CategorySectionProps {
  category: Emotion["category"];
  chips: { name: string; isActive: boolean; isCustom: boolean }[];
  isDark: boolean;
  onToggle: (name: string) => void;
  onRemove: (name: string) => void;
  onEdit: (name: string, category: Emotion["category"]) => void;
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
  onOpenMoveDialog,
  onSelectAll,
  onClearAll,
  onAddNew,
}: CategorySectionProps) {
  const config = CATEGORY_CONFIG[category];
  const activeCount = chips.filter((chip) => chip.isActive || chip.isCustom).length;
  const totalCount = chips.length;
  const pct = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;
  const tone = categoryTone(category, isDark);

  return (
    <PresetSectionCard
      title={config.label}
      description={config.description}
      icon={config.icon}
      countLabel={`${activeCount}/${totalCount}`}
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
            isActive={chip.isActive || chip.isCustom}
            isCustom={chip.isCustom}
            isDark={isDark}
            tone={tone}
            onPress={() => (chip.isCustom ? onRemove(chip.name) : onToggle(chip.name))}
            onLongPress={
              chip.isCustom ? () => onOpenMoveDialog(chip.name, category) : undefined
            }
            onEdit={chip.isCustom ? () => onEdit(chip.name, category) : undefined}
          />
        ))}
        <PresetAddChip
          isDark={isDark}
          onPress={onAddNew}
          accessibilityLabel="Add custom emotion"
        />
      </PresetChipsGrid>

      {chips.length === 0 && (
        <PresetEmptyText isDark={isDark}>
          No emotions in this category yet
        </PresetEmptyText>
      )}
    </PresetSectionCard>
  );
}

export { HeroStats, CategorySection };
