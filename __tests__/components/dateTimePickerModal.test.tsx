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
  vi.useRealTimers();
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

function pickerEvent(type: "set" | "dismissed", date: Date) {
  return {
    type,
    nativeEvent: { timestamp: date.getTime(), utcOffset: 0 },
  };
}

function setPickerValue(mode: "date" | "time", date: Date) {
  picker(mode).props.onChange(pickerEvent("set", date), date);
}

function textValues() {
  return renderer.root
    .findAllByType("Text")
    .map((node) => node.children.join(""));
}

describe("DateTimePickerModal timestamp round trips", () => {
  it.each(["UTC", "Etc/GMT-2"])(
    "does not write an unchanged recorded-offset entry on a %s device",
    async (timezone) => {
      process.env.TZ = timezone;
      const timestamp = Date.parse("2026-03-31T12:00:56.789Z");
      const original = entry(timestamp, -120);
      const { onSave } = await renderModal(original);

      expect(button("Change entry date")).toBeTruthy();
      expect(button("Save date and time changes").props.accessibilityState.disabled).toBe(true);
      await act(async () => button("Save date and time changes").props.onPress());

      expect(onSave).not.toHaveBeenCalled();
      expect(original.timestamp).toBe(timestamp);
      expect(original.utcOffsetMinutes).toBe(-120);
      expect(original.timestamp % 1000).toBe(789);
    },
  );

  it.each([
    ["reverse offset", Date.parse("2026-03-31T23:30:56.789Z"), 420],
    ["quarter-hour cross-midnight", Date.parse("2026-03-31T23:30:56.789Z"), -345],
    ["half-hour cross-midnight", Date.parse("2026-03-31T23:30:56.789Z"), -330],
  ] as const)("does not write an unchanged %s wall time", async (_label, timestamp, offset) => {
    process.env.TZ = "UTC";
    const { onSave } = await renderModal(entry(timestamp, offset));

    expect(button("Save date and time changes").props.accessibilityState.disabled).toBe(true);
    await act(async () => button("Save date and time changes").props.onPress());

    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the Home date flow open when the workflow target disappeared", async () => {
    process.env.TZ = "UTC";
    const original = entry(Date.parse("2026-03-31T23:30:56.123Z"), -120);
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
    await act(async () => button("Change entry date").props.onPress());
    await act(async () => setPickerValue("date", new Date("2026-04-02T01:30:00.000Z")));
    await act(async () => button("Save date and time changes").props.onPress());

    expect(repository.updateTimestamp).toHaveBeenCalledWith(
      7,
      Date.parse("2026-04-01T23:30:56.123Z"),
      -120,
    );
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
    await act(async () => setPickerValue("date", new Date("2026-04-02T01:30:00.000Z")));
    await act(async () => button("Save date and time changes").props.onPress());

    expect(onSave).toHaveBeenCalledWith(
      7,
      Date.parse("2026-04-01T23:30:56.789Z"),
      -120,
    );
  });

  it.each([
    [
      "summer device date to winter wall date",
      "2026-09-01T12:00:00-04:00",
      "2026-01-15T12:00:00-05:00",
      "2026-01-15T17:00:00.000Z",
    ],
    [
      "winter device date to summer wall date",
      "2026-01-15T12:00:00-05:00",
      "2026-07-15T12:00:00-04:00",
      "2026-07-15T16:00:00.000Z",
    ],
  ] as const)("derives a legacy edit offset from the selected %s", async (_label, now, selected, expected) => {
    process.env.TZ = "America/New_York";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const { onSave } = await renderModal(entry(Date.parse(now), null));

    await act(async () => button("Change entry date").props.onPress());
    await act(async () => setPickerValue("date", new Date(selected)));
    await act(async () => button("Save date and time changes").props.onPress());

    expect(onSave).toHaveBeenCalledWith(7, Date.parse(expected), expect.any(Number));
    expect(onSave.mock.calls[0][2]).toBe(selected.endsWith("-05:00") ? 300 : 240);
  });

  it("uses the selected device offset for unknown timestamp assignment", async () => {
    process.env.TZ = "America/New_York";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00-04:00"));
    const { onSave } = await renderModal(entry(0, null));

    await act(async () => button("Change entry date").props.onPress());
    await act(async () => setPickerValue("date", new Date("2026-01-15T12:00:00-05:00")));
    await act(async () => button("Save date and time changes").props.onPress());

    expect(onSave).toHaveBeenCalledWith(7, Date.parse("2026-01-15T17:00:00.000Z"), 300);
  });

  it("does not assign fallback dates when Android dismisses either picker", async () => {
    process.env.TZ = "UTC";
    nativePlatform.OS = "android";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
    const { onSave } = await renderModal(entry(0, null));

    expect(button("Save date and time changes").props.accessibilityState.disabled).toBe(true);

    await act(async () => button("Change entry date").props.onPress());
    const dismissedDate = picker("date").props.value;
    await act(async () => {
      picker("date").props.onChange(pickerEvent("dismissed", dismissedDate), dismissedDate);
    });

    await act(async () => button("Change entry time").props.onPress());
    const dismissedTime = picker("time").props.value;
    await act(async () => {
      picker("time").props.onChange(pickerEvent("dismissed", dismissedTime), dismissedTime);
    });

    expect(button("Save date and time changes").props.accessibilityState.disabled).toBe(true);
    expect(textValues()).not.toContain("Modified");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("preserves an existing draft when Android dismisses either picker with a date", async () => {
    process.env.TZ = "UTC";
    nativePlatform.OS = "android";
    const { onSave } = await renderModal(
      entry(Date.parse("2026-04-01T12:00:00.000Z"), 0),
    );
    const selectedDate = new Date("2026-04-02T12:00:00.000Z");

    await act(async () => button("Change entry date").props.onPress());
    await act(async () => setPickerValue("date", selectedDate));
    expect(button("Save date and time changes").props.accessibilityState.disabled).toBe(false);
    expect(textValues()).toContain("Modified");

    await act(async () => button("Change entry date").props.onPress());
    const dismissedDate = picker("date").props.value;
    await act(async () => {
      picker("date").props.onChange(pickerEvent("dismissed", dismissedDate), dismissedDate);
    });

    await act(async () => button("Change entry time").props.onPress());
    const dismissedTime = picker("time").props.value;
    await act(async () => {
      picker("time").props.onChange(pickerEvent("dismissed", dismissedTime), dismissedTime);
    });

    expect(button("Save date and time changes").props.accessibilityState.disabled).toBe(false);
    expect(textValues()).toContain("Modified");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("persists the normalized visible time when a legacy date edit crosses a spring DST gap", async () => {
    process.env.TZ = "America/New_York";
    const original = entry(Date.parse("2026-03-07T07:30:12.345Z"), null);
    const { onSave } = await renderModal(original);

    await act(async () => button("Change entry date").props.onPress());
    await act(async () => setPickerValue("date", new Date(2026, 2, 8, 3, 30, 12, 345)));
    await act(async () => button("Save date and time changes").props.onPress());

    expect(onSave).toHaveBeenCalledWith(
      7,
      Date.parse("2026-03-08T07:30:12.345Z"),
      240,
    );
  });

  it("follows JS/native normalization for a legacy fall-back ambiguity", async () => {
    process.env.TZ = "America/New_York";
    const original = entry(Date.parse("2026-10-31T05:30:12.345Z"), null);
    const selected = new Date(2026, 10, 1, 1, 30, 12, 345);
    const { onSave } = await renderModal(original);

    await act(async () => button("Change entry date").props.onPress());
    await act(async () => setPickerValue("date", selected));
    await act(async () => button("Save date and time changes").props.onPress());

    expect(onSave).toHaveBeenCalledWith(
      7,
      selected.getTime(),
      selected.getTimezoneOffset(),
    );
  });

  it("does not report a committed date write as failed when close throws", async () => {
    process.env.TZ = "UTC";
    const onClose = vi.fn(() => {
      throw new Error("close unavailable");
    });
    const onSave = vi.fn(async () => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await renderModal(entry(Date.parse("2026-04-01T12:00:00.000Z"), 0), onSave, onClose);
      await act(async () => button("Change entry date").props.onPress());
      await act(async () => setPickerValue("date", new Date("2026-04-02T12:00:00.000Z")));
      await act(async () => button("Save date and time changes").props.onPress());

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(dateFeedback.commit).toHaveBeenCalledTimes(1);
      expect(alertMock).not.toHaveBeenCalledWith(
        "Error",
        "Could not update this entry's date and time.",
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("follows device normalization for a legacy DST-gap selection", async () => {
    process.env.TZ = "America/New_York";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00-04:00"));
    const normalized = new Date(2026, 2, 8, 2, 30, 0, 0);
    const { onSave } = await renderModal(entry(0, null));

    await act(async () => button("Change entry date").props.onPress());
    await act(async () => setPickerValue("date", normalized));
    await act(async () => button("Save date and time changes").props.onPress());

    expect(normalized.getHours()).toBe(3);
    expect(onSave).toHaveBeenCalledWith(7, normalized.getTime(), 240);
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
    await act(async () => setPickerValue("date", new Date("2026-04-05T09:15:00.000Z")));
    await act(async () => button("Save date and time changes").props.onPress());

    expect(onSave).toHaveBeenCalledWith(7, Date.parse("2026-04-05T07:15:00.000Z"), -120);
  });
});
