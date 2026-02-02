import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { DEFAULT_CONTEXTS } from "@/lib/entrySettings";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { ListEditor } from "@/features/settings/components/ListEditor";

export default function ContextsSettingsScreen() {
  const hydrate = useSettingsStore((state) => state.hydrate);
  const contexts = useSettingsStore((state) => state.contexts);
  const setContexts = useSettingsStore((state) => state.setContexts);

  const [newContext, setNewContext] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleAddContext = useCallback(async () => {
    const trimmed = newContext.trim();
    if (!trimmed) return;
    if (contexts.includes(trimmed)) {
      Alert.alert("Duplicate Context", "This context already exists.");
      return;
    }
    await setContexts([...contexts, trimmed]);
    setNewContext("");
  }, [contexts, newContext, setContexts]);

  const handleRemoveContext = useCallback(
    async (value: string) => {
      const updated = contexts.filter((item) => item !== value);
      await setContexts(updated.length > 0 ? updated : DEFAULT_CONTEXTS);
    },
    [contexts, setContexts]
  );

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Context Tags"
        subtitle="Customization"
        icon="pricetag-outline"
        accentColor="dusk"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info banner */}
        <View className="mx-4 mb-4 p-4 rounded-2xl bg-dusk-100 dark:bg-dusk-800">
          <View className="flex-row items-center mb-2">
            <Text className="text-2xl mr-2">🏷️</Text>
            <Text className="text-base font-bold text-dusk-500 dark:text-dusk-300">
              {contexts.length} context{contexts.length === 1 ? "" : "s"}
            </Text>
          </View>
          <Text className="text-xs text-sand-500 dark:text-sand-400">
            Context tags help you track where you are, who you're with, and what you're doing when logging your mood.
          </Text>
        </View>

        <SettingsSection>
          <ListEditor
            title="Your Contexts"
            description="Tap the X to remove a context"
            placeholder="Add context..."
            items={contexts}
            newValue={newContext}
            onChangeNewValue={setNewContext}
            onAdd={handleAddContext}
            onRemove={handleRemoveContext}
            isLast
          />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}
