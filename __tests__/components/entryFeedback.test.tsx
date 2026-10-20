import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Emotion, MoodEntry } from "@db/types";
import { EmotionPicker } from "@/components/entry/EmotionPicker";
import { EnergySlider } from "@/components/entry/EnergySlider";
import { CreatePresetModal } from "@/components/entry/CreatePresetModal";
import {
  DetailedMoodEntryModal,
  EditMoodEntryModal,
  KeptEntryDetailModal,
  type MoodEntryFormValues,
} from "@/components/MoodEntryModal";
import { setHapticsEnabled } from "@/lib/haptics";
import { updateMoodEntryOrThrow } from "@/lib/moodEntryPersistence";
import { createMoodEntryWorkflow } from "@/services/moodEntryWorkflow";
import { useMoodModals } from "@/hooks/useMoodModals";
import {
  CURRENT_MOOD_SCALE_SNAPSHOT,
  LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT,
} from "../../domain/moodScale";

const nativePlatform = vi.hoisted(() => ({ OS: "ios", Version: 18 }));
const nativeInsets = vi.hoisted(() => ({ top: 0, right: 0, bottom: 0, left: 0 }));
const keyboardListeners = vi.hoisted(() => new Map<
  string,
  (event: { endCoordinates: { height: number } }) => void
>());
const nativeFeedback = vi.hoisted(() => ({
  selectionAsync: vi.fn(async () => {}),
  performAndroidHapticsAsync: vi.fn(async () => {}),
  impactAsync: vi.fn(async () => {}),
}));
const entryFeedback = vi.hoisted(() => ({
  alert: vi.fn(),
  alertView: null as React.ReactNode,
  hasAlert: false,
  crisisSupport: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("expo-haptics", () => ({
  ...nativeFeedback,
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
  AndroidHaptics: {
    Gesture_End: "gesture-end",
    Context_Click: "context-click",
    Confirm: "confirm",
    Reject: "reject",
    Long_Press: "long-press",
  },
}));
vi.mock("react-native", () => ({
  Modal: "Modal",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  TextInput: "TextInput",
  Keyboard: {
    addListener: (event: string, listener: (event: { endCoordinates: { height: number } }) => void) => {
      keyboardListeners.set(event, listener);
      return { remove: () => keyboardListeners.delete(event) };
    },
    dismiss: vi.fn(),
  },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Platform: {
    get OS() { return nativePlatform.OS; },
    get Version() { return nativePlatform.Version; },
    select: (values: Record<string, unknown>) => values[nativePlatform.OS] ?? values.default,
  },
  useColorScheme: () => "dark",
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => nativeInsets }));
vi.mock("react-native-pager-view", () => ({ default: "PagerView" }));
vi.mock("@react-navigation/elements", () => ({ PlatformPressable: "Pressable" }));
vi.mock("@/components/entry", () => ({ SameAsYesterdayButton: "CopyLastEntry" }));
vi.mock("@/components/ui/AppAlert", () => ({
  useModalAlert: () => ({ alert: entryFeedback.alert, alertView: entryFeedback.alertView, hasAlert: entryFeedback.hasAlert }),
}));
vi.mock("@/lib/showCrisisSupportAlert", () => ({ showCrisisSupportAlert: entryFeedback.crisisSupport }));
vi.mock("@/services/toastService", () => ({
  toastService: { success: entryFeedback.toastSuccess },
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("react-native-reanimated", async () => {
  const { useRef } = await import("react");
  const transition = { duration: () => undefined };
  return {
    default: { View: "AnimatedView", Text: "AnimatedText" },
    useSharedValue: (value: number) => useRef({ value }).current,
    useAnimatedStyle: (style: () => unknown) => style(),
    withSpring: (value: number) => value,
    withTiming: (value: number) => value,
    withSequence: (...values: number[]) => values.at(-1),
    FadeIn: transition,
    FadeOut: transition,
  };
});

const options: Emotion[] = [
  { name: "Happy", category: "positive" },
  { name: "Calm", category: "positive" },
  { name: "Hopeful", category: "positive" },
  { name: "Sad", category: "negative" },
];

function EmotionForm() {
  const [selected, setSelected] = useState<Emotion[]>([]);
  return <EmotionPicker options={options} selected={selected} onChange={setSelected} />;
}

function EnergyForm() {
  const [value, setValue] = useState<number | null>(null);
  return <EnergySlider value={value} onChange={setValue} />;
}

let renderer: ReactTestRenderer;

async function render(element: React.ReactElement) {
  await act(async () => { renderer = create(element); });
}

function button(testID: string) {
  return renderer.root.findByProps({ testID });
}

async function press(testID: string) {
  await act(async () => {
    const target = button(testID);
    // Native Pressable suppresses onPress when disabled.
    if (!target.props.disabled) target.props.onPress();
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
  setHapticsEnabled(true);
  nativeInsets.bottom = 0;
  keyboardListeners.clear();
  entryFeedback.alertView = null;
  entryFeedback.hasAlert = false;
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
  setHapticsEnabled(true);
});

describe.each(["android", "ios"])("entry field feedback on %s", (platform) => {
  beforeEach(() => {
    nativePlatform.OS = platform;
    nativePlatform.Version = platform === "android" ? 35 : 18;
  });
  it("selects, deselects, and removes emotions with one feedback event per change", async () => {
    await render(<EmotionForm />);
    await press("emotion-option-Happy");
    expect(button("emotion-option-Happy").props.accessibilityState.selected).toBe(true);
    await press("emotion-option-Happy");
    expect(button("emotion-option-Happy").props.accessibilityState.selected).toBe(false);
    await press("emotion-option-Calm");
    await press("emotion-remove-Calm");
    expect(button("emotion-option-Calm").props.accessibilityState.selected).toBe(false);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(4);
  });

  it("blocks a fourth emotion without feedback and permits selection after removal", async () => {
    await render(<EmotionForm />);
    for (const emotion of options.slice(0, 3)) await press(`emotion-option-${emotion.name}`);
    expect(button("emotion-option-Sad").props.disabled).toBe(true);
    await press("emotion-option-Sad");
    expect(button("emotion-option-Sad").props.accessibilityState.selected).toBe(false);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(3);
    await press("emotion-remove-Happy");
    await press("emotion-option-Sad");
    expect(button("emotion-option-Sad").props.accessibilityState.selected).toBe(true);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(5);
  });

  it("sets energy including zero, toggles it off, and clears it with feedback", async () => {
    await render(<EnergyForm />);
    await press("energy-level-0");
    expect(button("energy-level-0").props.accessibilityState.selected).toBe(true);
    await press("energy-level-0");
    expect(renderer.root.findAllByProps({ testID: "energy-clear" })).toHaveLength(0);
    await press("energy-level-10");
    expect(button("energy-level-10").props.accessibilityState.selected).toBe(true);
    await press("energy-clear");
    expect(button("energy-level-10").props.accessibilityState.selected).toBe(false);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(4);
  });

  it("keeps fields usable when haptics are disabled", async () => {
    setHapticsEnabled(false);
    await render(<><EmotionForm /><EnergyForm /></>);
    await press("emotion-option-Happy");
    await press("energy-level-5");
    expect(button("emotion-option-Happy").props.accessibilityState.selected).toBe(true);
    expect(button("energy-level-5").props.accessibilityState.selected).toBe(true);
    await press("emotion-remove-Happy");
    await press("energy-clear");
    expect(button("emotion-option-Happy").props.accessibilityState.selected).toBe(false);
    expect(button("energy-level-5").props.accessibilityState.selected).toBe(false);
    expect(nativeFeedback.selectionAsync).not.toHaveBeenCalled();
  });
});

function EntryModal() {
  return (
    <KeptEntryDetailModal
      visible
      onUndo={() => {}}
      initialMood={4}
      emotionOptions={options}
      contextOptions={["Work", "Family"]}
      fieldConfig={{ emotions: true, context: true, energy: false, notes: false }}
      onClose={() => {}}
      onSubmit={() => {}}
      onCreateEmotion={() => null}
    />
  );
}

type SaveVariant = "kept" | "detailed" | "edit";

function SaveEntryModal({
  variant,
  mood = 4,
  fieldConfig = { emotions: false, context: false, energy: false, notes: false },
  onClose,
  onSubmit,
}: {
  variant: SaveVariant;
  mood?: number;
  fieldConfig?: { emotions: boolean; context: boolean; energy: boolean; notes: boolean };
  onClose: () => void;
  onSubmit: (values: MoodEntryFormValues) => Promise<void>;
}) {
  const shared = {
    visible: true,
    initialMood: mood,
    emotionOptions: options,
    contextOptions: ["Work", "Family"],
    fieldConfig,
    onClose,
    onSubmit,
    onCreateEmotion: () => null,
  };
  if (variant === "kept") {
    return <KeptEntryDetailModal {...shared} onUndo={() => {}} />;
  }
  const Modal = variant === "edit" ? EditMoodEntryModal : DetailedMoodEntryModal;
  return <Modal {...shared} />;
}

function labeledButton(accessibilityLabel: string) {
  return renderer.root.findByProps({ accessibilityLabel });
}

async function pressLabel(accessibilityLabel: string) {
  await act(async () => { labeledButton(accessibilityLabel).props.onPress(); });
}

const NOTES_ONLY = { emotions: false, context: false, energy: false, notes: true };

function StoredEntryModal({
  entry, variant, fieldConfig, onClose, onSubmit,
}: {
  entry: MoodEntry;
  variant: "kept" | "edit";
  fieldConfig: React.ComponentProps<typeof EditMoodEntryModal>["fieldConfig"];
  onClose: () => void;
  onSubmit: (values: MoodEntryFormValues) => Promise<void>;
}) {
  const { setKeptEntry, setEditingEntry, keptEntry, editingEntry, keptInitialValues, editingInitialValues } = useMoodModals();
  useEffect(() => {
    if (variant === "kept") setKeptEntry(entry);
    else setEditingEntry(entry);
  }, [entry, variant, setKeptEntry, setEditingEntry]);
  const initialValues = variant === "kept" ? keptInitialValues : editingInitialValues;
  const props = {
    visible: Boolean(variant === "kept" ? keptEntry : editingEntry),
    initialMood: initialValues?.mood ?? 5,
    initialValues,
    currentEntryId: entry.id,
    emotionOptions: options,
    contextOptions: ["Work"],
    fieldConfig,
    onClose,
    onSubmit,
  };
  return variant === "kept"
    ? <KeptEntryDetailModal {...props} onUndo={vi.fn()} />
    : <EditMoodEntryModal {...props} />;
}

async function addNoteAndPressDone() {
  await act(async () => button("entry-notes").props.onChangeText("a note"));
  await act(async () => {
    labeledButton("Done").props.onPress();
    await Promise.resolve();
  });
}

describe.each(["android", "ios"])("entry modal feedback on %s", (platform) => {
  beforeEach(() => {
    nativePlatform.OS = platform;
    nativePlatform.Version = platform === "android" ? 35 : 18;
  });

  it.each([0, 34])("reserves bottom inset %s for Done only while the keyboard is hidden", async (bottomInset) => {
    nativeInsets.bottom = bottomInset;
    await render(<SaveEntryModal variant="kept" onClose={vi.fn()} onSubmit={vi.fn(async () => {})} />);
    const footer = () => renderer.root.find((node) =>
      node.type === "View" &&
      node.props.style?.paddingBottom !== undefined &&
      node.findAllByProps({ accessibilityLabel: "Done" }).length === 1,
    );
    expect(footer().props.style.paddingBottom).toBe(20 + bottomInset);

    await act(async () => {
      keyboardListeners.get(platform === "android" ? "keyboardDidShow" : "keyboardWillShow")!(
        { endCoordinates: { height: 300 } },
      );
    });
    expect(footer().props.style.paddingBottom).toBe(20);

    await act(async () => {
      keyboardListeners.get(platform === "android" ? "keyboardDidHide" : "keyboardWillHide")!(
        { endCoordinates: { height: 0 } },
      );
    });
    expect(footer().props.style.paddingBottom).toBe(20 + bottomInset);
  });

  it.each([true, false])("toggles context through the modal with haptics enabled=%s", async (enabled) => {
    setHapticsEnabled(enabled);
    // Strict Mode replays state updaters, so feedback must belong to the press handler.
    await render(<React.StrictMode><EntryModal /></React.StrictMode>);
    expect(nativeFeedback.selectionAsync).not.toHaveBeenCalled();
    await pressLabel("Context: Work, not selected");
    expect(labeledButton("Context: Work, selected").props.accessibilityState.selected).toBe(true);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(enabled ? 1 : 0);
    await pressLabel("Context: Work, selected");
    expect(labeledButton("Context: Work, not selected").props.accessibilityState.selected).toBe(false);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(enabled ? 2 : 0);
    expect(nativeFeedback.performAndroidHapticsAsync).not.toHaveBeenCalled();
    expect(nativeFeedback.impactAsync).not.toHaveBeenCalled();
  });

  it("only gives category feedback when the category changes", async () => {
    await render(<EntryModal />);
    await pressLabel("Add new emotion");
    await pressLabel("Positive emotion category");
    expect(nativeFeedback.selectionAsync).not.toHaveBeenCalled();
    await pressLabel("Negative emotion category");
    expect(labeledButton("Negative emotion category").props.accessibilityState.selected).toBe(true);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(1);
    await pressLabel("Negative emotion category");
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(1);
    setHapticsEnabled(false);
    await pressLabel("Neutral emotion category");
    expect(labeledButton("Neutral emotion category").props.accessibilityState.selected).toBe(true);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(1);
  });
});

describe("kept entry detail", () => {
  it("shows all fields on one page and closes on Done without changes", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn(async () => {});
    await render(
      <SaveEntryModal
        variant="kept"
        fieldConfig={{ emotions: true, context: true, energy: false, notes: true }}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    expect(renderer.root.findAllByProps({ accessibilityLabel: "Next step" })).toHaveLength(0);
    expect(button("emotion-option-Happy")).toBeTruthy();
    expect(button("entry-notes")).toBeTruthy();

    await pressLabel("Done");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(entryFeedback.toastSuccess).not.toHaveBeenCalled();
  });

  it("removes the kept entry on Undo without saving the form", async () => {
    const onUndo = vi.fn();
    const onSubmit = vi.fn(async () => {});
    await render(
      <KeptEntryDetailModal
        visible
        initialMood={4}
        emotionOptions={options}
        contextOptions={["Work"]}
        fieldConfig={{ emotions: true, context: false, energy: false, notes: false }}
        onClose={() => {}}
        onSubmit={onSubmit}
        onUndo={onUndo}
      />,
    );

    await pressLabel("Undo this entry");

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(entryFeedback.toastSuccess).not.toHaveBeenCalled();
  });
});

describe("entry save acknowledgement", () => {
  it.each([
    ["kept", "Detail added"],
    ["detailed", "Entry saved"],
    ["edit", "Entry updated"],
  ] as const)("announces one committed %s result", async (variant, expectedTitle) => {
    const onClose = vi.fn();
    const onSubmit = vi.fn(async () => {});
    await render(
      <SaveEntryModal
        variant={variant}
        fieldConfig={variant === "kept" ? NOTES_ONLY : undefined}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    // Done on the kept sheet only writes when something was added.
    if (variant === "kept") {
      await addNoteAndPressDone();
    } else {
      await pressLabel("Save entry");
    }

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(entryFeedback.toastSuccess).toHaveBeenCalledTimes(1);
    expect(entryFeedback.toastSuccess).toHaveBeenCalledWith(expectedTitle);
  });

  it("does not duplicate a pending write on rapid taps", async () => {
    let resolveSubmit!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const onSubmit = vi.fn(() => pending);
    const onClose = vi.fn();
    await render(
      <SaveEntryModal variant="detailed" onClose={onClose} onSubmit={onSubmit} />,
    );

    await act(async () => {
      const save = renderer.root.findByProps({ accessibilityLabel: "Save entry" });
      save.props.onPress();
      save.props.onPress();
      await Promise.resolve();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(entryFeedback.toastSuccess).not.toHaveBeenCalled();

    await act(async () => {
      resolveSubmit();
      await pending;
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(entryFeedback.toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft and reports a rejected persistence callback", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn(async () => {
      throw new Error("storage rejected");
    });
    await render(
      <SaveEntryModal
        variant="kept"
        fieldConfig={{ emotions: false, context: false, energy: false, notes: true }}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    const notes = renderer.root.findByProps({ testID: "entry-notes" });
    await act(async () => notes.props.onChangeText("private draft"));
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: "Done" }).props.onPress();
      await Promise.resolve();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(entryFeedback.toastSuccess).not.toHaveBeenCalled();
    expect(entryFeedback.alert).toHaveBeenCalledWith(
      "Save failed",
      "Unable to save your entry. Please try again.",
    );
    expect(renderer.root.findByProps({ testID: "entry-notes" }).props.value).toBe("private draft");
  });

  it("does not turn a throwing success toast into a retryable save", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn(async () => {});
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    entryFeedback.toastSuccess.mockImplementationOnce(() => {
      throw new Error("toast unavailable");
    });

    try {
      await render(<SaveEntryModal variant="detailed" onClose={onClose} onSubmit={onSubmit} />);
      await act(async () => {
        renderer.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
        await Promise.resolve();
      });
      await act(async () => {
        renderer.root.findByProps({ accessibilityLabel: "Saving" }).props.onPress();
        await Promise.resolve();
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(entryFeedback.toastSuccess).toHaveBeenCalledTimes(1);
      expect(entryFeedback.alert).not.toHaveBeenCalledWith(
        "Save failed",
        "Unable to save your entry. Please try again.",
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("does not retry a committed write when closing the modal throws", async () => {
    const onClose = vi.fn(() => {
      throw new Error("close unavailable");
    });
    const onSubmit = vi.fn(async () => {});
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await render(<SaveEntryModal variant="detailed" onClose={onClose} onSubmit={onSubmit} />);
      await act(async () => {
        renderer.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
        await Promise.resolve();
      });
      await act(async () => {
        renderer.root.findByProps({ accessibilityLabel: "Saving" }).props.onPress();
        await Promise.resolve();
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(entryFeedback.toastSuccess).toHaveBeenCalledTimes(1);
      expect(entryFeedback.alert).not.toHaveBeenCalledWith(
        "Save failed",
        "Unable to save your entry. Please try again.",
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("keeps a disappeared edit open through the real workflow callback", async () => {
    const update = vi.fn(async () => undefined);
    const workflow = createMoodEntryWorkflow(
      {
        create: vi.fn(),
        update,
        delete: vi.fn(),
        updateTimestamp: vi.fn(),
      },
      {
        getMoods: () => [],
        applyMutation: vi.fn(),
      },
    );
    const onClose = vi.fn();
    await render(
      <SaveEntryModal
        variant="edit"
        onClose={onClose}
        onSubmit={async (values) => {
          await updateMoodEntryOrThrow(
            workflow.update, { id: 42, moodScale: CURRENT_MOOD_SCALE_SNAPSHOT }, values,
          );
        }}
      />,
    );

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
      await Promise.resolve();
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(entryFeedback.toastSuccess).not.toHaveBeenCalled();
    expect(entryFeedback.alert).toHaveBeenCalledWith(
      "Save failed",
      "Unable to save your entry. Please try again.",
    );
  });

  it("does not repeat support when adding detail to a severe entry already shown support", async () => {
    vi.useFakeTimers();
    try {
      const onSubmit = vi.fn(async () => {});
      await render(
        <SaveEntryModal variant="kept" mood={9} fieldConfig={NOTES_ONLY} onClose={vi.fn()} onSubmit={onSubmit} />,
      );

      await addNoteAndPressDone();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(entryFeedback.crisisSupport).not.toHaveBeenCalled();
      expect(entryFeedback.toastSuccess).toHaveBeenCalledWith("Detail added");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps crisis support primary after a successful high-distress write", async () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const onSubmit = vi.fn(async () => {});
      await render(
        <SaveEntryModal variant="detailed" mood={9} onClose={onClose} onSubmit={onSubmit} />,
      );

      await act(async () => {
        renderer.root.findByProps({ accessibilityLabel: "Save entry" }).props.onPress();
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(entryFeedback.toastSuccess).not.toHaveBeenCalled();
      expect(entryFeedback.crisisSupport).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});


describe("last-entry prefill", () => {
  const copied: MoodEntry = {
    id: 41, mood: 0, timestamp: 300, utcOffsetMinutes: 0,
    note: "  prior note \u0000 and café  ",
    emotions: [{ name: "Custom calm", category: "positive", icon: null }],
    contextTags: ["Custom place"], energy: 0,
    moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true },
    basedOnEntryId: null,
  };

  it.each([
    ["kept", true, copied, 0, "Elated"],
    ["edit", true, copied, 0, "Elated"],
    ["kept", false, copied, 0, "Elated"],
    ["edit", false, copied, 0, "Elated"],
    ["kept", false, { ...copied, mood: 10, moodScale: LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT }, 0, "Elated"],
    ["edit", true, { ...copied, mood: 9, moodScale: LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT }, 1, "Very Happy"],
  ] as const)("copies exact values in the %s form with all fields visible=%s (case %#)", async (
    variant, allFields, source, formMood, label,
  ) => {
    const onSubmit = vi.fn(async () => {});
    const props = {
      visible: true, initialMood: 5, currentEntryId: 77,
      emotionOptions: options, contextOptions: ["Work"],
      fieldConfig: { emotions: allFields, context: allFields, energy: allFields, notes: true },
      onClose: vi.fn(), onSubmit,
    };
    await render(variant === "kept"
      ? <KeptEntryDetailModal {...props} onUndo={vi.fn()} />
      : <EditMoodEntryModal {...props} />);
    const copy = renderer.root.find((node) => node.type === "CopyLastEntry");
    expect(copy.props.excludeEntryId).toBe(77);
    await act(async () => copy.props.onCopy(source));
    expect(renderer.root.findAll((node) => node.type === "Text" && (
      node.props.children === label ||
      (Array.isArray(node.props.children) && node.props.children.includes(label))
    )).length).toBeGreaterThan(0);
    while (renderer.root.findAllByProps({ accessibilityLabel: "Next step" }).length > 0) {
      await pressLabel("Next step");
    }
    await pressLabel(variant === "kept" ? "Done" : "Save entry");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      mood: formMood, emotions: source.emotions, contextTags: source.contextTags,
      energy: 0, note: source.note, basedOnEntryId: 41,
    });
    expect(entryFeedback.crisisSupport).not.toHaveBeenCalled();
  });

  it.each(["kept", "edit"] as const)("initializes a legacy %s row in the current scale and preserves its meaning on a note edit", async (variant) => {
    const entry: MoodEntry = {
      ...copied, id: 77, mood: 9, note: "original note", basedOnEntryId: 12,
      moodScale: LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT,
    };
    const update = vi.fn(async () => entry);
    await render(
      <StoredEntryModal
        entry={entry} variant={variant}
        fieldConfig={{ emotions: true, context: true, energy: true, notes: true }}
        onClose={vi.fn()}
        onSubmit={async (values) => { await updateMoodEntryOrThrow(update, entry, values); }}
      />,
    );
    const modal = renderer.root.findByType(variant === "kept" ? KeptEntryDetailModal : EditMoodEntryModal);
    expect(modal.props.initialMood).toBe(1);
    expect(modal.props.initialValues.mood).toBe(1);
    await act(async () => button("entry-notes").props.onChangeText("changed note"));
    while (renderer.root.findAllByProps({ accessibilityLabel: "Next step" }).length > 0) {
      await pressLabel("Next step");
    }
    await pressLabel(variant === "kept" ? "Done" : "Save entry");

    expect(update).toHaveBeenCalledExactlyOnceWith(77, {
      mood: 9, emotions: entry.emotions, contextTags: entry.contextTags,
      energy: 0, note: "changed note", basedOnEntryId: 12,
    });
  });

  it("saves the copied note even when notes are hidden", async () => {
    const onSubmit = vi.fn(async () => {});
    await render(
      <KeptEntryDetailModal
        visible initialMood={5} currentEntryId={77}
        emotionOptions={options} contextOptions={["Work"]}
        fieldConfig={{ emotions: false, context: false, energy: false, notes: false }}
        onClose={vi.fn()} onSubmit={onSubmit} onUndo={vi.fn()}
      />,
    );

    await act(async () => renderer.root.find((node) => node.type === "CopyLastEntry").props.onCopy(copied));
    expect(renderer.root.findAllByProps({ testID: "entry-notes" })).toHaveLength(0);
    await pressLabel("Done");

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      mood: 0, emotions: copied.emotions, contextTags: copied.contextTags,
      energy: 0, note: copied.note, basedOnEntryId: 41,
    });
  });

  it.each([null, 41])("restores normal submission after reopen with stored source ID %s", async (basedOnEntryId) => {
    const onSubmit = vi.fn(async () => {});
    const props = {
      initialMood: 5, currentEntryId: 77,
      initialValues: basedOnEntryId === null ? undefined : { basedOnEntryId },
      emotionOptions: options, contextOptions: ["Work"], fieldConfig: NOTES_ONLY,
      onClose: vi.fn(), onSubmit, onUndo: vi.fn(),
    };
    await render(<KeptEntryDetailModal {...props} visible />);
    await act(async () => renderer.root.find((node) => node.type === "CopyLastEntry").props.onCopy(copied));
    expect(button("entry-notes").props.value).toBe(copied.note);

    await act(async () => renderer.update(<KeptEntryDetailModal {...props} visible={false} />));
    await act(async () => renderer.update(<KeptEntryDetailModal {...props} visible />));
    expect(button("entry-notes").props.value).toBe("");
    await act(async () => button("entry-notes").props.onChangeText("  fresh note  "));
    await pressLabel("Done");

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      mood: 5, emotions: [], contextTags: [], energy: null,
      note: "fresh note", basedOnEntryId,
    });
  });

  it("keeps current-scale edits through a failed save and retry into a legacy destination", async () => {
    const entry: MoodEntry = {
      ...copied, id: 77, mood: 9,
      moodScale: LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT,
    };
    const update = vi.fn(async () => entry).mockRejectedValueOnce(new Error("storage rejected"));
    const onClose = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await render(
        <StoredEntryModal
          entry={entry} variant="edit" fieldConfig={NOTES_ONLY}
          onClose={onClose}
          onSubmit={async (values) => { await updateMoodEntryOrThrow(update, entry, values); }}
        />,
      );
      await act(async () => renderer.root.find((node) => node.type === "CopyLastEntry").props.onCopy(copied));
      await pressLabel("Increase mood to 1");
      await act(async () => button("entry-notes").props.onChangeText("  first edit  "));
      while (renderer.root.findAllByProps({ accessibilityLabel: "Next step" }).length > 0) {
        await pressLabel("Next step");
      }
      await pressLabel("Save entry");

      expect(onClose).not.toHaveBeenCalled();
      expect(button("entry-notes").props.value).toBe("  first edit  ");
      await pressLabel("Increase mood to 2");
      await act(async () => button("entry-notes").props.onChangeText("  retry edit  "));
      await pressLabel("Save entry");

      expect(update).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenNthCalledWith(1, 77, {
        mood: 9, emotions: copied.emotions, contextTags: copied.contextTags,
        energy: 0, note: "  first edit  ", basedOnEntryId: 41,
      });
      expect(update).toHaveBeenNthCalledWith(2, 77, {
        mood: 8, emotions: copied.emotions, contextTags: copied.contextTags,
        energy: 0, note: "  retry edit  ", basedOnEntryId: 41,
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

describe.each(["android", "ios"])("entry notes keyboard on %s", (platform) => {
  beforeEach(() => {
    nativePlatform.OS = platform;
    nativePlatform.Version = platform === "android" ? 35 : 18;
    nativeInsets.bottom = 24;
  });

  it("keeps Save reachable above the keyboard while Notes has focus", async () => {
    const onSubmit = vi.fn(async () => {});
    await render(
      <SaveEntryModal variant="detailed" fieldConfig={NOTES_ONLY} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    await act(async () => button("entry-notes").props.onFocus());
    await act(async () => {
      keyboardListeners.get(platform === "ios" ? "keyboardWillShow" : "keyboardDidShow")?.({
        endCoordinates: { height: 300 },
      });
    });
    await act(async () => button("entry-notes").props.onChangeText("typed with the keyboard open"));

    // Android reports the keyboard above the 24dp navigation inset; the
    // edge-to-edge sheet must clear both.
    expect(button("entry-sheet").props.style.marginBottom).toBe(platform === "android" ? 324 : 300);

    await act(async () => {
      labeledButton("Save entry").props.onPress();
      await Promise.resolve();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ note: "typed with the keyboard open" }));
  });
});

describe("inline entry alerts", () => {
  it("covers the sheet and the preset form and hides both from assistive tech", async () => {
    entryFeedback.hasAlert = true;
    entryFeedback.alertView = <View testID="entry-alert" />;
    await render(<SaveEntryModal variant="detailed" onClose={vi.fn()} onSubmit={vi.fn(async () => {})} />);

    const [content, alert] = renderer.root.findByType("Modal").children as ReactTestInstance[];
    expect(alert.props.testID).toBe("entry-alert");
    expect(content.props.accessibilityElementsHidden).toBe(true);
    expect(content.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(content.findAllByProps({ testID: "entry-sheet" })).toHaveLength(1);
    expect(content.findAllByType(CreatePresetModal)).toHaveLength(1);
  });
});
