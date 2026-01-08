import React from "react";
import { SectionHeader } from "../components/SectionHeader";
import { SettingCard } from "../components/SettingCard";
import { ToggleRow } from "../components/ToggleRow";
import { SettingRow } from "../components/SettingRow";

export function AdvancedSection({
  devOptionsEnabled,
  onToggleDevOptions,
  onSeedMoods,
  onTestNotification,
  onClearMoods,
}: {
  devOptionsEnabled: boolean;
  onToggleDevOptions: (value: boolean) => void;
  onSeedMoods: () => void;
  onTestNotification: () => void;
  onClearMoods: () => void;
}) {
  return (
    <>
      <SectionHeader title="Advanced" icon="🛠️" />
      <SettingCard>
        <ToggleRow
          title="Developer Mode"
          value={devOptionsEnabled}
          onChange={onToggleDevOptions}
          isLast={!devOptionsEnabled}
        />
        {devOptionsEnabled && (
          <>
            <SettingRow
              label="Add Sample Data"
              subLabel="Generate test entries"
              icon="flask-outline"
              onPress={onSeedMoods}
            />
            <SettingRow
              label="Test Notification"
              subLabel="Send a push in 2s"
              icon="notifications-circle-outline"
              onPress={onTestNotification}
            />
            <SettingRow
              label="Clear All Data"
              subLabel="Permanently delete everything"
              icon="trash-outline"
              destructive
              isLast
              onPress={onClearMoods}
            />
          </>
        )}
      </SettingCard>
    </>
  );
}

