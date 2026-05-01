import React from "react";
import { View, Text } from "react-native";
import { HapticTab } from "./HapticTab";
import { moodScale } from "@/constants/moodScale";
import {
	getMoodButtonLabel,
	getMoodButtonHint,
} from "@/constants/accessibility";
import { useThemeColors, colors } from "@/constants/colors";

const THREE_COLUMN_CARD_HEIGHT = 78;
const THREE_COLUMN_CARD_WIDTH = "31.5%";
const TWO_COLUMN_CARD_HEIGHT = 84;
const TWO_COLUMN_CARD_WIDTH = "48%";

interface MoodButtonsDetailedProps {
	onMoodPress: (mood: number) => void;
	onLongPress: (mood: number) => void;
}

export const MoodButtonsDetailed: React.FC<MoodButtonsDetailedProps> = ({
	onMoodPress,
	onLongPress,
}) => {
	const { isDark, get } = useThemeColors();

	const moodData = React.useMemo(() => {
		return moodScale.map((mood) => ({
			value: mood.value,
			label: mood.label,
			description: mood.description,
			color: mood.color,
			bg: mood.bg,
			borderColor: mood.borderColor,
			textHex: isDark ? mood.textHexDark : mood.textHex,
			bgHex: isDark ? mood.bgHexDark : mood.bgHex,
		}));
	}, [isDark]);

	const topRowMoods = moodData.slice(0, 3);
	const remainingMoods = moodData.slice(3);

	const renderMoodCard = (
		mood: (typeof moodData)[number],
		width: string,
		height: number,
	) => (
		<HapticTab
			key={mood.value}
			className="items-center justify-center rounded-2xl"
			style={{
				width,
				height,
				backgroundColor: mood.bgHex || "#F1F5F9",
				shadowColor: mood.textHex || "#64748B",
				shadowOffset: { width: 0, height: 4 },
				shadowOpacity: 0.15,
				shadowRadius: 8,
				elevation: 4,
			}}
			onPress={() => onMoodPress(mood.value)}
			onLongPress={() => onLongPress(mood.value)}
			delayLongPress={500}
			accessibilityRole="button"
			accessibilityLabel={getMoodButtonLabel(mood.value, mood.label)}
			accessibilityHint={getMoodButtonHint()}
		>
			<Text
				className="mb-0.5 text-[18px] font-bold"
				style={{ color: mood.textHex || "#64748B" }}
			>
				{mood.value}
			</Text>
			<Text
				className="mb-0.5 text-[10px] font-semibold"
				style={{ color: mood.textHex || "#64748B" }}
				numberOfLines={1}
			>
				{mood.label}
			</Text>
			<Text
				className="px-1.5 text-center text-[10px] leading-tight"
				style={{ color: mood.textHex || "#64748B", opacity: 0.7 }}
				numberOfLines={2}
			>
				{mood.description}
			</Text>
		</HapticTab>
	);

	return (
		<View className="mb-2">
			{/* Soft header */}
			<View className="mb-2 flex-row items-center justify-center">
				<View
					className="h-px flex-1"
					style={{ backgroundColor: get("border") }}
				/>
				<Text
					className="text-xs font-medium mx-3 tracking-wide"
					style={{ color: isDark ? colors.sand.textMuted.dark : "#6B5C4A" }}
				>
					How are you feeling?
				</Text>
				<View
					className="h-px flex-1"
					style={{ backgroundColor: get("border") }}
				/>
			</View>

			<View
				className="flex-row flex-wrap justify-between"
				style={{ rowGap: 8 }}
			>
				{topRowMoods.map((mood) =>
					renderMoodCard(
						mood,
						THREE_COLUMN_CARD_WIDTH,
						THREE_COLUMN_CARD_HEIGHT,
					),
				)}
				{remainingMoods.map((mood) =>
					renderMoodCard(mood, TWO_COLUMN_CARD_WIDTH, TWO_COLUMN_CARD_HEIGHT),
				)}
			</View>

			{/* Gentle scale indicator */}
			<View className="mx-1 mt-2">
				<View
					className="flex-row h-1 rounded-full overflow-hidden"
					style={{ backgroundColor: get("surfaceAlt") }}
				>
					{colors.moodGradient.map((color, index) => (
						<View
							key={index}
							className="flex-1"
							style={{ backgroundColor: color }}
						/>
					))}
				</View>
				<View
					className="flex-row justify-between px-0.5"
					style={{ marginTop: 6 }}
				>
					<Text
						className="text-[9px] font-medium"
						style={{
							color: isDark ? colors.primaryMuted.dark : colors.primary.light,
						}}
					>
						Great
					</Text>
					<Text
						className="text-[9px] font-medium"
						style={{
							color: isDark
								? colors.negative.text.dark
								: colors.negative.text.light,
						}}
					>
						Need support
					</Text>
				</View>
			</View>
		</View>
	);
};
