import React from "react";
import { View } from "react-native";
import { MoodButtonsDetailed } from "@/components/MoodButtonsDetailed";
import { MoodButtonsCompact } from "@/components/MoodButtonsCompact";

interface MoodButtonSelectorSharedProps {
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

function MoodButtonSelectorContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return <View>{children}</View>;
}

export function CompactMoodButtonSelector({
  onMoodPress,
  onLongPress,
}: MoodButtonSelectorSharedProps) {
  return (
    <MoodButtonSelectorContainer>
      <MoodButtonsCompact
        onMoodPress={onMoodPress}
        onLongPress={onLongPress}
      />
    </MoodButtonSelectorContainer>
  );
}

export function DetailedMoodButtonSelector({
  onMoodPress,
  onLongPress,
}: MoodButtonSelectorSharedProps) {
  return (
    <MoodButtonSelectorContainer>
      <MoodButtonsDetailed
        onMoodPress={onMoodPress}
        onLongPress={onLongPress}
      />
    </MoodButtonSelectorContainer>
  );
}
