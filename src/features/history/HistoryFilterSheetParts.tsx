import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/constants/colors";
import { typography } from "@/constants/typography";
import {
  MOOD_VALUES,
  collapseChoices,
  moodLabel,
  type MoodRange,
} from "./filterModel";

/** Shared surface colors for the filter sheet and the active-filter chip bar. */
export function filterPalette(isDark: boolean) {
  return {
    text: isDark ? colors.text.dark : colors.text.light,
    subtle: isDark ? colors.textSubtle.dark : colors.textSubtle.light,
    accent: isDark ? colors.primary.dark : colors.primary.light,
    onAccent: isDark ? colors.onPrimary.dark : colors.textInverse.light,
    chipBg: isDark ? colors.surfaceElevated.dark : colors.surfaceAlt.light,
    chipBorder: isDark ? colors.borderSubtle.dark : colors.border.light,
    band: isDark ? colors.primaryBgHover.dark : colors.primaryBg.light,
    surface: isDark ? colors.background.dark : colors.background.light,
    divider: isDark ? colors.borderSubtle.dark : colors.borderSubtle.light,
  };
}

export type FilterPalette = ReturnType<typeof filterPalette>;

// Chips are drawn at 32 and the press target is extended with hitSlop, the same
// trade the entry EmotionPicker makes: dense rows without shrinking the target.
const CHIP_HEIGHT = 32;
const CHIP_HIT_SLOP = { top: 7, bottom: 7, left: 4, right: 4 };

export function SheetSection({
  title,
  action,
  palette,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  palette: FilterPalette;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text style={[typography.eyebrow, { color: palette.subtle }]}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function SectionResetButton({
  label,
  palette,
  onPress,
}: {
  label: string;
  palette: FilterPalette;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={CHIP_HIT_SLOP}
      onPress={onPress}
    >
      <Text style={[typography.bodySm, { color: palette.accent, fontWeight: "600" }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChoiceChip({
  label,
  selected,
  accessibilityLabel,
  palette,
  onPress,
}: {
  label: string;
  selected: boolean;
  accessibilityLabel: string;
  palette: FilterPalette;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      hitSlop={CHIP_HIT_SLOP}
      onPress={onPress}
      className="justify-center rounded-full px-3"
      style={{
        minHeight: CHIP_HEIGHT,
        backgroundColor: selected ? palette.accent : palette.chipBg,
        borderWidth: 1,
        borderColor: selected ? palette.accent : palette.chipBorder,
      }}
    >
      <Text
        style={[
          typography.bodySm,
          {
            color: selected ? palette.onAccent : palette.text,
            fontWeight: selected ? "700" : "500",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A wrapping chip group that shows a couple of rows and hides the rest behind a
 * count. Selected names always stay visible, so an active filter is never
 * folded away.
 */
export function CollapsibleChoices({
  label,
  choices,
  selected,
  palette,
  onToggle,
}: {
  label: string;
  choices: string[];
  selected: string[];
  palette: FilterPalette;
  onToggle: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { visible, hidden } = collapseChoices(choices, selected, expanded);

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {visible.map((name) => (
        <ChoiceChip
          key={name}
          label={name}
          selected={selected.includes(name)}
          accessibilityLabel={`${label}: ${name}`}
          palette={palette}
          onPress={() => onToggle(name)}
        />
      ))}
      {hidden > 0 || expanded ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded
              ? `Show fewer ${label.toLowerCase()}`
              : `Show all ${choices.length} ${label.toLowerCase()}`
          }
          hitSlop={CHIP_HIT_SLOP}
          onPress={() => setExpanded((current) => !current)}
          className="justify-center rounded-full px-3"
          style={{
            minHeight: CHIP_HEIGHT,
            borderColor: palette.accent,
            borderStyle: "dashed",
            borderWidth: 1,
          }}
        >
          <Text
            style={[typography.bodySm, { color: palette.accent, fontWeight: "600" }]}
          >
            {expanded ? "Show fewer" : `+${hidden} more`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The 0–10 mood row. The number stays in neutral ink and the dot carries the
 * mood color, so every step keeps its contrast at both ends of the scale.
 */
export function MoodRangeRow({
  range,
  palette,
  onPick,
}: {
  range: MoodRange | null;
  palette: FilterPalette;
  onPick: (value: number) => void;
}) {
  return (
    <View className="flex-row">
      {MOOD_VALUES.map((value) => {
        const inRange = range !== null && value >= range.min && value <= range.max;
        const isStart = range?.min === value;
        const isEnd = range?.max === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`Mood ${value}, ${moodLabel(value)}`}
            accessibilityState={{ selected: inRange }}
            onPress={() => onPick(value)}
            className="flex-1 items-center justify-center gap-1"
            style={{
              height: 42,
              backgroundColor: inRange ? palette.band : "transparent",
              borderBottomLeftRadius: isStart ? 12 : 0,
              borderBottomRightRadius: isEnd ? 12 : 0,
              borderTopLeftRadius: isStart ? 12 : 0,
              borderTopRightRadius: isEnd ? 12 : 0,
            }}
          >
            <View
              style={{
                backgroundColor: colors.moodGradient[value],
                borderRadius: 3.5,
                height: 7,
                opacity: inRange ? 1 : 0.35,
                width: 7,
              }}
            />
            <Text
              style={[
                typography.bodySm,
                {
                  color: inRange ? palette.accent : palette.subtle,
                  fontWeight: inRange ? "700" : "400",
                },
              ]}
            >
              {value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
