import React, { useMemo } from "react";
import { Image, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/useColorScheme";
import { typography } from "@/constants/typography";
import { colors, semanticToneColors } from "@/constants/colors";
import { useMoodsStore } from "@/shared/state/moodsStore";
import { calculateStreak } from "@/features/insights/utils/patternDetection";

function getGreeting(date: Date): string {
	const h = date.getHours();
	if (h < 5) return "Still up";
	if (h < 12) return "Good morning";
	if (h < 17) return "Good afternoon";
	if (h < 22) return "Good evening";
	return "Late night";
}

const APP_ICON_SIZE = 48;
const HALO_PAD = 8;

/**
 * Home is the front door: the app icon carries brand identity, the serif
 * greeting carries the moment, and a single streak chip sits in the trailing
 * slot only when there's something to celebrate. Date moves under the greeting
 * as a quiet caption so we don't double-stamp "Today".
 */
export function HomeHeader() {
	const isDark = useColorScheme() === "dark";

	const moods = useMoodsStore((s) => s.moods);
	const streak = useMemo(() => calculateStreak(moods), [moods]);

	const now = new Date();
	const greeting = getGreeting(now);
	const dateLabel = now.toLocaleDateString([], {
		weekday: "long",
		month: "short",
		day: "numeric",
	});

	const titleColor = isDark ? colors.text.dark : colors.text.light;
	const captionColor = isDark ? colors.textSubtle.dark : colors.textMuted.light;
	const accent = isDark ? colors.primary.dark : colors.primary.light;
	const haloFill = isDark
		? "rgba(166, 227, 155, 0.10)"
		: "rgba(123, 168, 123, 0.10)";
	const haloRing = isDark
		? "rgba(166, 227, 155, 0.18)"
		: "rgba(123, 168, 123, 0.20)";

	const streakPalette = isDark
		? semanticToneColors.sage.dark
		: semanticToneColors.sage.light;

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				paddingVertical: 4,
				marginBottom: 4,
			}}
		>
			<View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 12 }}>
				{/* Sage halo + app icon */}
				<View
					style={{
						width: APP_ICON_SIZE + HALO_PAD * 2,
						height: APP_ICON_SIZE + HALO_PAD * 2,
						borderRadius: (APP_ICON_SIZE + HALO_PAD * 2) / 4,
						backgroundColor: haloFill,
						borderWidth: 1,
						borderColor: haloRing,
						alignItems: "center",
						justifyContent: "center",
						marginRight: 14,
					}}
				>
					<Image
						source={require("../../../assets/images/app-icons/app-icon.png")}
						style={{
							width: APP_ICON_SIZE,
							height: APP_ICON_SIZE,
							borderRadius: 14,
						}}
						resizeMode="cover"
						accessible
						accessibilityLabel="Moodinator"
					/>
				</View>

				<View style={{ flex: 1 }}>
					<Text
						numberOfLines={1}
						style={[
							typography.titleMd,
							{ color: titleColor, fontSize: 24, lineHeight: 28 },
						]}
					>
						{greeting}
					</Text>
					<Text
						numberOfLines={1}
						style={[
							typography.bodySm,
							{ color: captionColor, marginTop: 2, letterSpacing: 0.1 },
						]}
					>
						{dateLabel}
					</Text>
				</View>
			</View>

			{streak.current > 0 ? (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						paddingHorizontal: 10,
						paddingVertical: 6,
						borderRadius: 999,
						backgroundColor: streakPalette.bg,
						borderWidth: 1,
						borderColor: streakPalette.border,
						gap: 5,
					}}
					accessibilityLabel={`Streak: ${streak.current} ${
						streak.current === 1 ? "day" : "days"
					}`}
				>
					<Ionicons name="leaf" size={11} color={accent} />
					<Text
						style={[
							typography.eyebrow,
							{
								fontSize: 11,
								letterSpacing: 0.6,
								color: streakPalette.fg,
								fontWeight: "700",
								textTransform: "none",
							},
						]}
					>
						{streak.current}
						{streak.current === 1 ? " day" : "d streak"}
					</Text>
				</View>
			) : null}
		</View>
	);
}

export default HomeHeader;
