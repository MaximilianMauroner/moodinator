import React, { useMemo } from "react";
import type { QuickEntryPrefs } from "@/lib/entrySettings";
import type { Emotion } from "@db/types";
import { SectionHeader } from "../components/SectionHeader";
import { SettingCard } from "../components/SettingCard";
import { ToggleRow } from "../components/ToggleRow";
import { ListEditor } from "../components/ListEditor";

export function EntryCustomizationSection({
  quickEntryPrefs,
  onQuickEntryToggle,
  emotions,
  contexts,
  newEmotion,
  setNewEmotion,
  newContext,
  setNewContext,
  onAddEmotion,
  onRemoveEmotion,
  onAddContext,
  onRemoveContext,
}: {
  quickEntryPrefs: QuickEntryPrefs;
  onQuickEntryToggle: (key: keyof QuickEntryPrefs, value: boolean) => void;
  emotions: Emotion[];
  contexts: string[];
  newEmotion: string;
  setNewEmotion: (value: string) => void;
  newContext: string;
  setNewContext: (value: string) => void;
  onAddEmotion: () => void;
  onRemoveEmotion: (value: string) => void;
  onAddContext: () => void;
  onRemoveContext: (value: string) => void;
}) {
  const emotionNames = useMemo(
    () => emotions.map((emotion) => emotion.name),
    [emotions]
  );

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
        <ListEditor
          title="Emotions"
          description="Custom emotions for entries"
          placeholder="Add emotion..."
          items={emotionNames}
          newValue={newEmotion}
          onChangeNewValue={setNewEmotion}
          onAdd={onAddEmotion}
          onRemove={onRemoveEmotion}
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
