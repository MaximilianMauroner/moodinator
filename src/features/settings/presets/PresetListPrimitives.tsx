import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/constants/colors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PresetTone = {
  primary: string;
  cardBg: string;
  border: string;
  accentBg: string;
  chipActive: string;
  chipBorder: string;
};

export type PresetHeroSegment = {
  count: number;
  label: string;
  color: string;
  bgColor: string;
  progressColor: string;
};

export function PresetHeroStats({
  title,
  icon,
  total,
  progressTotal,
  isDark,
  tone,
  segments,
  progressSegments = segments,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  total: number;
  progressTotal?: number;
  isDark: boolean;
  tone: PresetTone;
  segments: PresetHeroSegment[];
  progressSegments?: PresetHeroSegment[];
}) {
  const progressDenominator = progressTotal ?? total;
  const safeProgressTotal = progressDenominator || 1;
  const visibleProgressSegments = progressSegments.filter(
    (segment) => segment.count > 0
  );

  return (
    <View
      style={[
        styles.heroCard,
        {
          backgroundColor: tone.cardBg,
          borderColor: tone.border,
        },
      ]}
    >
      <View style={[styles.heroCornerAccent, { backgroundColor: tone.accentBg }]} />

      <View style={styles.heroHeader}>
        <View style={styles.heroTitleRow}>
          <View style={[styles.heroIconBg, { backgroundColor: tone.accentBg }]}>
            <Ionicons name={icon} size={16} color={tone.primary} />
          </View>
          <Text
            style={[
              styles.heroTitle,
              { color: isDark ? "#F0EDE6" : "#3D352A" },
            ]}
          >
            {title}
          </Text>
        </View>
        <View style={[styles.heroBadge, { backgroundColor: tone.accentBg }]}>
          <Text style={[styles.heroBadgeText, { color: tone.primary }]}>
            {total}
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
          {progressDenominator > 0 &&
            visibleProgressSegments.map((segment, index) => (
              <View
                key={segment.label}
                style={[
                  styles.heroProgressSegment,
                  {
                    width: `${Math.min(
                      100,
                      Math.max(0, (segment.count / safeProgressTotal) * 100)
                    )}%`,
                    backgroundColor: segment.progressColor,
                    borderTopLeftRadius: index === 0 ? 4 : 0,
                    borderBottomLeftRadius: index === 0 ? 4 : 0,
                    borderTopRightRadius:
                      index === visibleProgressSegments.length - 1 ? 4 : 0,
                    borderBottomRightRadius:
                      index === visibleProgressSegments.length - 1 ? 4 : 0,
                  },
                ]}
              />
            ))}
        </View>
      </View>

      <View style={styles.heroStatsRow}>
        {segments.map((segment) => (
          <PresetStatPill
            key={segment.label}
            count={segment.count}
            label={segment.label}
            color={segment.color}
            bgColor={segment.bgColor}
          />
        ))}
      </View>
    </View>
  );
}

export function PresetStatPill({
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
      <Text style={[styles.statPillLabel, { color, opacity: 0.76 }]}>
        {label}
      </Text>
    </View>
  );
}

export function PresetSectionCard({
  title,
  description,
  icon,
  countLabel,
  progressPct,
  isDark,
  tone,
  onSelectAll,
  onClearAll,
  children,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  countLabel?: string;
  progressPct?: number;
  isDark: boolean;
  tone: PresetTone;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionContainer}>
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: tone.cardBg, borderColor: tone.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBg, { backgroundColor: tone.accentBg }]}>
              <Ionicons name={icon} size={16} color={tone.primary} />
            </View>
            <View style={styles.sectionTitleText}>
              <Text style={[styles.sectionLabel, { color: tone.primary }]}>
                {title}
              </Text>
              <Text
                style={[
                  styles.sectionDescription,
                  {
                    color: isDark
                      ? colors.textMuted.dark
                      : colors.textMuted.light,
                  },
                ]}
              >
                {description}
              </Text>
            </View>
          </View>

          <View style={styles.sectionActions}>
            {countLabel && (
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
                <Text style={[styles.countBadgeText, { color: tone.primary }]}>
                  {countLabel}
                </Text>
              </View>
            )}
            {onSelectAll && (
              <Pressable onPress={onSelectAll} hitSlop={10}>
                <Text style={[styles.actionText, { color: tone.primary }]}>
                  All
                </Text>
              </Pressable>
            )}
            {onSelectAll && onClearAll && (
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
            )}
            {onClearAll && (
              <Pressable onPress={onClearAll} hitSlop={10}>
                <Text
                  style={[
                    styles.actionText,
                    {
                      color: isDark
                        ? colors.textSubtle.dark
                        : colors.textSubtle.light,
                    },
                  ]}
                >
                  None
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {progressPct !== undefined && (
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
                {
                  width: `${progressPct}%`,
                  backgroundColor: tone.primary,
                },
              ]}
            />
          </View>
        )}

        {children}
      </View>
    </View>
  );
}

export function PresetChipsGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipsGrid}>{children}</View>;
}

export function PresetChip({
  label,
  isDark,
  isActive,
  isCustom,
  tone,
  customTone,
  onPress,
  onLongPress,
  onEdit,
}: {
  label: string;
  isDark: boolean;
  isActive: boolean;
  isCustom: boolean;
  tone: PresetTone;
  customTone?: PresetTone;
  onPress: () => void;
  onLongPress?: () => void;
  onEdit?: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const activeTone = isCustom && customTone ? customTone : tone;
  const chipBg = isActive
    ? activeTone.chipActive
    : isDark
      ? "rgba(255,255,255,0.05)"
      : "rgba(255,255,255,0.80)";
  const chipBorder = isActive
    ? activeTone.chipBorder
    : isDark
      ? "rgba(255,255,255,0.10)"
      : "rgba(0,0,0,0.08)";
  const textColor = isActive
    ? activeTone.primary
    : isDark
      ? colors.textMuted.dark
      : colors.textMuted.light;

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 70 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 110 });
      }}
      delayLongPress={400}
      style={[
        animatedStyle,
        styles.chip,
        {
          backgroundColor: chipBg,
          borderColor: chipBorder,
          borderWidth: isActive ? 1.5 : 1,
        },
      ]}
    >
      {isActive && (
        <View
          style={[styles.chipIcon, { backgroundColor: activeTone.primary }]}
        >
          <Ionicons
            name={isCustom ? "close" : "checkmark"}
            size={10}
            color={isDark ? colors.background.dark : colors.textInverse.light}
          />
        </View>
      )}
      <Text
        style={[
          styles.chipText,
          { color: textColor, fontWeight: isActive ? "600" : "400" },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {isCustom && onEdit && (
        <Pressable
          onPress={(event) => {
            event.stopPropagation?.();
            onEdit();
          }}
          hitSlop={8}
          style={styles.chipEditBtn}
        >
          <Ionicons
            name="pencil"
            size={12}
            color={isDark ? colors.textSubtle.dark : colors.textSubtle.light}
          />
        </Pressable>
      )}
    </AnimatedPressable>
  );
}

export function PresetAddChip({
  isDark,
  onPress,
  accessibilityLabel = "Add custom preset",
}: {
  isDark: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  // Keep the affordance legible on both the warm paper cards and dark theme
  // surfaces. The previous low-opacity foreground made this control read as
  // disabled, especially on the preset screens' light cards.
  const color = isDark ? "#C8F5BE" : "#31543A";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.addChip,
        {
          borderColor: isDark ? "#A6E39B" : "#5B8A5B",
          backgroundColor: isDark ? "#1B3423" : "#E6EEE1",
        },
      ]}
    >
      <Ionicons name="add" size={16} color={color} />
      <Text style={[styles.addChipText, { color }]}>Add</Text>
    </Pressable>
  );
}

export function PresetEmptyText({
  children,
  isDark,
}: {
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <Text
      style={[
        styles.emptyText,
        { color: isDark ? colors.textSubtle.dark : colors.textSubtle.light },
      ]}
    >
      {children}
    </Text>
  );
}

export function PresetTipCard({
  children,
  isDark,
}: {
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <View style={styles.tipsSection}>
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
            {children}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function PresetHistorySyncCard({
  title,
  description,
  icon,
  isDark,
  tone,
  loading,
  onPress,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  isDark: boolean;
  tone: PresetTone;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <View className="px-4 pt-2">
      <Pressable
        onPress={onPress}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${description}`}
        className="flex-row items-center rounded-2xl border p-3.5"
        style={({ pressed }) => ({
          backgroundColor: tone.cardBg,
          borderColor: tone.border,
          opacity: loading ? 0.72 : pressed ? 0.86 : 1,
        })}
      >
        <View
          className="w-9 h-9 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: tone.accentBg }}
        >
          <Ionicons name={icon} size={17} color={tone.primary} />
        </View>
        <View className="flex-1 pr-3">
          <Text
            className="text-sm font-bold"
            style={{ color: isDark ? "#F0EDE6" : "#3D352A" }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            className="text-xs mt-0.5"
            style={{
              color: isDark ? "rgba(255,255,255,0.48)" : "rgba(0,0,0,0.44)",
            }}
            numberOfLines={2}
          >
            {description}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={tone.primary} />
        ) : (
          <Ionicons name="add-circle" size={22} color={tone.primary} />
        )}
      </Pressable>
    </View>
  );
}

export const presetListStyles = StyleSheet.create({
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
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
});

const styles = StyleSheet.create({
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
    letterSpacing: 0,
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
    letterSpacing: 0,
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
  sectionTitleText: {
    flex: 1,
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
    letterSpacing: 0,
    maxWidth: 110,
  },
  chipEditBtn: {
    marginLeft: 6,
    padding: 2,
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
});
