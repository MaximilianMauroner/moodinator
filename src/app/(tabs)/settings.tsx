import React from "react";
import { TabSceneTransition } from "@/components/ui/TabSceneTransition";
import { SettingsScreen } from "@/features/settings/screens/SettingsScreen";

export default function SettingsRoute() {
  return (
    <TabSceneTransition>
      <SettingsScreen />
    </TabSceneTransition>
  );
}
