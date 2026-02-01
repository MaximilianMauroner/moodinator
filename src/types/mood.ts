export interface MoodScale {
    value: number;
    label: string;
    description: string;
    color: string;
    bg: string;
    borderColor?: string;
    bgHex?: string;
    textHex?: string;
    bgHexDark?: string;
    textHexDark?: string;
}

export type SwipeDirection = "left" | "right";
