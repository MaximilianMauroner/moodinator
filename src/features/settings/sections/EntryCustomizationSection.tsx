import React from "react";
import type { QuickEntryPrefs } from "@/lib/entrySettings";
import type { Emotion } from "@db/types";
import { SectionHeader } from "../components/SectionHeader";
import { SettingCard } from "../components/SettingCard";
import { SettingRow } from "../components/SettingRow";
import { ToggleRow } from "../components/ToggleRow";
import { EmotionListEditor } from "../components/EmotionListEditor";
import { ListEditor } from "../components/ListEditor";

export function EntryCustomizationSection({
  quickEntryPrefs,
  onQuickEntryToggle,
  emotions,
  contexts,
  newEmotion,
  newEmotionCategory,
  setNewEmotion,
  setNewEmotionCategory,
  newContext,
  setNewContext,
  onAddEmotion,
  onRemoveEmotion,
  onUpdateEmotionCategory,
  onImportEmotionsFromEntries,
  onAddContext,
  onRemoveContext,
}: {
  quickEntryPrefs: QuickEntryPrefs;
  onQuickEntryToggle: (key: keyof QuickEntryPrefs, value: boolean) => void;
  emotions: Emotion[];
  contexts: string[];
  newEmotion: string;
  newEmotionCategory: Emotion["category"];
  setNewEmotion: (value: string) => void;
  setNewEmotionCategory: (value: Emotion["category"]) => void;
  newContext: string;
  setNewContext: (value: string) => void;
  onAddEmotion: () => void;
  onRemoveEmotion: (value: string) => void;
  onUpdateEmotionCategory: (name: string, category: Emotion["category"]) => void;
  onImportEmotionsFromEntries: () => void;
  onAddContext: () => void;
  onRemoveContext: (value: string) => void;
}) {
  return (
    <>
      <SectionHeader title="Entry Customization" icon="✨" />
      <SettingCard>
        <ToggleRow
          title="Quick Entry: Emotions"
          value={quickEntryPrefs.showEmotions}
          onChange={(v) => onQuickEntryToggle("showEmotions", v)}
        />
        <ToggleRow
          title="Quick Entry: Context"
          value={quickEntryPrefs.showContext}
          onChange={(v) => onQuickEntryToggle("showContext", v)}
        />
        <ToggleRow
          title="Quick Entry: Energy"
          value={quickEntryPrefs.showEnergy}
          onChange={(v) => onQuickEntryToggle("showEnergy", v)}
        />
        <ToggleRow
          title="Quick Entry: Notes"
          value={quickEntryPrefs.showNotes}
          onChange={(v) => onQuickEntryToggle("showNotes", v)}
        />
        <EmotionListEditor
          title="Emotions"
          description="Custom emotions for entries"
          placeholder="Add emotion..."
          emotions={emotions}
          newValue={newEmotion}
          newCategory={newEmotionCategory}
          onChangeNewValue={setNewEmotion}
          onChangeNewCategory={setNewEmotionCategory}
          onAdd={onAddEmotion}
          onRemove={onRemoveEmotion}
          onUpdateCategory={onUpdateEmotionCategory}
        />
        <SettingRow
          label="Import emotions from entries"
          subLabel="Adds any emotions found in past entries as neutral presets."
          onPress={onImportEmotionsFromEntries}
        />
        <ListEditor
          title="Contexts"
          description="Tags for where/who/what"
          placeholder="Add context..."
          items={contexts}
          newValue={newContext}
          onChangeNewValue={setNewContext}
          onAdd={onAddContext}
          onRemove={onRemoveContext}
          isLast
        />
      </SettingCard>
    </>
  );
}
