import { Platform, TextStyle } from "react-native";

const fontFamilies = {
  display: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "serif",
  }),
  body: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif",
    default: undefined,
  }),
  bodyMedium: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif-medium",
    default: undefined,
  }),
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
} as const;

export const typography = {
  eyebrow: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  } satisfies TextStyle,
  titleLg: {
    fontFamily: fontFamilies.display,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
  } satisfies TextStyle,
  titleMd: {
    fontFamily: fontFamilies.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
  } satisfies TextStyle,
  subtitle: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,
  bodySm: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
  } satisfies TextStyle,
  bodyMd: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 22,
  } satisfies TextStyle,
  metricLg: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.1,
    fontVariant: ["tabular-nums"],
  } satisfies TextStyle,
  metricMd: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
  } satisfies TextStyle,
  monoSm: {
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
  } satisfies TextStyle,
};

export type TypographyKey = keyof typeof typography;

export { fontFamilies };

