import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MoodEntry } from "@db/types";
import { createMoodEntryWorkflow } from "@/services/moodEntryWorkflow";
import { updateMoodTimestampOrThrow } from "@/lib/moodEntryPersistence";

const nativePlatform = vi.hoisted(() => ({ OS: "ios" }));
const alertMock = vi.hoisted(() => vi.fn());
const dateFeedback = vi.hoisted(() => ({
  commit: vi.fn(),
  reject: vi.fn(),
}));

vi.mock("react-native", () => ({
  Modal: "Modal",
  Platform: {
    get OS() {
      return nativePlatform.OS;
    },
  },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
}));
vi.mock("@react-native-community/datetimepicker", () => ({ default: "DateTimePicker" }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("@/components/ui/AppAlert", () => ({ Alert: { alert: alertMock } }));
vi.mock("@/lib/haptics", () => ({
  haptics: { ...dateFeedback, tap: vi.fn() },
}));
vi.mock("@/constants/moodScaleInterpretation", () => ({
  getMoodRatingDisplay: () => ({
    color: "#000",
    colorHex: "#000",
    label: "Neutral",
    backgroundHex: "#fff",
    value: 4,
  }),
}));
vi.mock("@/constants/colors", () => ({
  colors: {
    overlay: "rgba(0,0,0,0.5)",
    primary: { dark: "#000", light: "#000" },
    primaryBg: { dark: "#fff", light: "#fff" },
    positive: { textDark: { light: "#000" } },
    sand: { text: { dark: "#000", light: "#000" } },
  },
  useThemeColors: () => ({
    isDark: false,
    get: () => "#000",
    getCategoryColors: () => ({ bg: "#fff", text: "#000" }),
  }),
}));

import { DateTimePickerModal } from "@/components/DateTimePickerModal";

const originalTimezone = process.env.TZ;
let renderer: ReactTestRenderer;

const entry = (timestamp: number, utcOffsetMinutes: number | null): MoodEntry => ({
  id: 7,
  mood: 4,
  note: null,
  timestamp,
  utcOffsetMinutes,
  emotions: [],
  contextTags: [],
  energy: null,
  moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true },
  basedOnEntryId: null,
});

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  nativePlatform.OS = "ios";
  vi.clearAllMocks();
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

async function renderModal(
  mood: MoodEntry,
  onSave = vi.fn(async () => {}),
  onClose = vi.fn(),
) {
  await act(async () => {
    renderer = create(
      <DateTimePickerModal
        visible
        mood={mood}
        onClose={onClose}
        onSave={onSave}
      />,
    );
  });
  return { onSave, onClose };
}

function button(accessibilityLabel: string) {
  return renderer.root.findByProps({ accessibilityLabel });
}

function picker(mode: "date" | "time") {
  return renderer.root.findByProps({ mode });
}

function textValues() {
  return renderer.root
    .findAllByType("Text")
    .map((node) => node.children.join(""));
}

describe("DateTimePickerModal timestamp round trips", () => {
  it.each(["UTC", "Etc/GMT-2"])(
    "preserves an unchanged recorded-offset instant on a %s device",
    async (timezone) => {
      process.env.TZ = timezone;
      const timestamp = Date.parse("2026-03-31T12:00:56.789Z");
      const { onSave } = await renderModal(entry(timestamp, -120));

      expect(button("Change entry date")).toBeTruthy();
      expect(button("Save date and time changes").props.accessibilityState.disabled).toBe(false);
      await act(async () => button("Save date and time changes").props.onPress());

      expect(onSave).toHaveBeenCalledWith(7, timestamp, -120);
    },
  );

  it.each([
    ["reverse offset", Date.parse("2026-03-31T23:30:56.789Z"), 420],
    ["quarter-hour cross-midnight", Date.parse("2026-03-31T23:30:56.789Z"), -345],
    ["half-hour cross-midnight", Date.parse("2026-03-31T23:30:56.789Z"), -330],
  ] as const)("preserves %s wall time without a write shift", async (_label, timestamp, offset) => {
    process.env.TZ = "UTC";
    const { onSave } = await renderModal(entry(timestamp, offset));

    await act(async () => button("Save date and time changes").props.onPress());

    expect(onSave).toHaveBeenCalledWith(7, timestamp, offset);
  });

  it("keeps the Home date flow open when the workflow target disappeared", async () => {
    process.env.TZ = "UTC";
    const original = entry(Date.parse("2026-04-01T12:00:00.123Z"), -120);
    const repository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateTimestamp: vi.fn(async () => undefined),
    };
    const applyMutation = vi.fn();
    const workflow = createMoodEntryWorkflow(repository, {
      getMoods: () => [original],
      applyMutation,
    });
    const onClose = vi.fn();
    const onSave = async (id: number, timestamp: number, offset?: number | null) => {
      await updateMoodTimestampOrThrow(workflow.reschedule, id, timestamp, offset);
      onClose();
    };

    await renderModal(original, onSave, onClose);
    await act(async () => button("Save date and time changes").props.onPress());

    expect(repository.updateTimestamp).toHaveBeenCalledWith(7, original.timestamp, -120);
    expect(applyMutation).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(dateFeedback.commit).not.toHaveBeenCalled();
    expect(dateFeedback.reject).toHaveBeenCalledTimes(1);
    expect(alertMock).toHaveBeenCalledWith(
      "Error",
      "Could not update this entry's date and time.",
    );
  });

  it("converts an explicitly changed recorded wall date using the saved offset", async () => {
    process.env.TZ = "UTC";
    const timestamp = Date.parse("2026-03-31T23:30:56.789Z");
    const { onSave } = await renderModal(entry(timestamp, -120));

    await act(async () => button("Change entry date").props.onPress());
    await act(async () => {
      picker("date").props.onChange({}, new Date("2026-04-02T01:30:00.000Z"));
    });
    await act(async () => button("Save date and time changes").props.onPress());

    expect(onSave).toHaveBeenCalledWith(
      7,
      Date.parse("2026-04-01T23:30:56.789Z"),
      -120,
    );
  });

  it("does not write when cancelled", async () => {
    process.env.TZ = "UTC";
    const { onSave, onClose } = await renderModal(entry(Date.parse("2026-04-01T12:00:00Z"), 0));

    await act(async () => button("Cancel date and time changes").props.onPress());

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps an unreadable sentinel truthful and only assigns it after a picker choice", async () => {
    process.env.TZ = "UTC";
    const { onSave } = await renderModal(entry(0, -120));

    expect(textValues()).toContain("Unknown date");
    expect(textValues()).toContain("Unknown time");
    expect(button("Save date and time changes").props.accessibilityState.disabled).toBe(true);
    await act(async () => button("Save date and time changes").props.onPress());
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => button("Change entry date").props.onPress());
    await act(async () => {
      picker("date").props.onChange({}, new Date("2026-04-05T09:15:00.000Z"));
    });
    await act(async () => button("Save date and time changes").props.onPress());

    expect(onSave).toHaveBeenCalledWith(7, Date.parse("2026-04-05T07:15:00.000Z"), -120);
  });
});
