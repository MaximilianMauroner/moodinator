import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MoodEntry, MoodEntryInput } from "@db/types";
import { createMockMoodEntry } from "../db/mockClient";
import { SUPPORT_HANDOFF_MS, SUPPORT_SHEET_DELAY_MS } from "@/lib/keepMoodTap";

const mocks = vi.hoisted(() => ({
  blur: undefined as (() => void) | undefined,
  support: vi.fn<(options: { onDecline?: () => void }) => void>(),
  store: {
    create: vi.fn<(input: MoodEntryInput) => Promise<MoodEntry>>(),
    refreshMoods: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    updateTimestamp: vi.fn(async () => {}),
  },
}));

vi.mock("expo-router", () => ({
  useFocusEffect: (effect: () => (() => void) | void) => { mocks.blur = effect() || undefined; },
}));
vi.mock("react-native", () => ({
  View: "View", Pressable: "Pressable", RefreshControl: "RefreshControl", ScrollView: "ScrollView",
  Alert: { alert: vi.fn() },
  Platform: { OS: "android", select: (values: Record<string, unknown>) => values.android ?? values.default },
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("@react-navigation/bottom-tabs", () => ({ useBottomTabBarHeight: () => 56 }));
vi.mock("@shopify/flash-list", () => ({ FlashList: "FlashList" }));
vi.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: "GestureRoot" }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeArea",
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("react-native-reanimated", () => ({ default: { View: "AnimatedView" } }));
vi.mock("@/components/ErrorBoundary", () => ({ ErrorBoundary: "ErrorBoundary" }));
vi.mock("@/components/ScreenErrorFallback", () => ({ createScreenErrorFallback: () => "ScreenFallback" }));
vi.mock("@/components/DateTimePickerModal", () => ({ DateTimePickerModal: "DateTimePicker" }));
vi.mock("@/components/MoodEntryModal", () => ({
  DetailedMoodEntryModal: "DetailedEntry", EditMoodEntryModal: "EditEntry", KeptEntryDetailModal: "KeptDetail",
}));
vi.mock("@/components/DisplayMoodItem", () => ({ DisplayMoodItem: "MoodItem" }));
vi.mock("@/components/ui/EmptyState", () => ({ EmptyState: "EmptyState" }));
vi.mock("@/components/layout/ScreenBackgroundAccent", () => ({ ScreenBackgroundAccent: "Accent" }));
vi.mock("@/components/ui/TabSceneTransition", () => ({ TabSceneTransition: "Scene" }));
vi.mock("@/components/home", () => ({
  DetailedMoodButtonSelector: "DetailedPicker", CollapsedMoodSelector: "CollapsedPicker", UnifiedMoodSelector: "UnifiedPicker",
  HomeHeader: "HomeHeader", HistoryListHeader: "HistoryHeader", UNIFIED_COMPACT_EXPANDED_HEIGHT: 300,
}));
vi.mock("@/features/history/useRecentMoodEntries", () => ({
  useRecentMoodEntries: () => ({ entries: [], asOf: new Date(2026, 9, 4), loaded: true, error: null, reload: vi.fn() }),
}));
vi.mock("@/shared/state/moodsStore", () => ({
  useMoodsStore: <T,>(select: (state: typeof mocks.store) => T) => select(mocks.store),
}));
vi.mock("@/hooks/useEntrySettings", () => ({
  useEntrySettings: () => ({
    showDetailedLabels: true,
    quickEntryFieldConfig: { emotions: true, context: false, energy: false, notes: false },
    detailedFieldConfig: { emotions: true, context: false, energy: false, notes: false },
    emotionOptions: [], contextOptions: [], createEmotionOption: vi.fn(), createContextOption: vi.fn(),
  }),
}));
vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "dark" }));
vi.mock("@/hooks/usePullToRefresh", () => ({ usePullToRefresh: () => ({ refreshing: false, onRefresh: vi.fn() }) }));
vi.mock("@/hooks/useHomeHeaderCollapse", () => ({
  HOME_COLLAPSED_SELECTOR_HEIGHT: 100,
  useHomeHeaderCollapse: () => ({
    selectorCollapsed: false, jumpToTopVisible: false, collapseProgress: { value: 0 },
    scrollToTop: vi.fn(), schedulePostSaveTopResets: vi.fn(), scrollHandlers: {},
  }),
}));
vi.mock("@/lib/haptics", () => ({ haptics: { commit: vi.fn(), reject: vi.fn() } }));
vi.mock("@/lib/showCrisisSupportAlert", () => ({ showCrisisSupportAlert: mocks.support }));
vi.mock("@/services/toastService", () => ({ toastService: { showKeptMood: vi.fn(), error: vi.fn() } }));

import HomeScreen from "@/app/(tabs)/index";

let renderer: ReactTestRenderer;
const host = (type: string) => renderer.root.findAll((node) => node.type === type)[0]!;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  mocks.store.create.mockImplementation(async (input) => createMockMoodEntry({
    id: mocks.store.create.mock.calls.length, mood: input.mood,
  }));
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.useRealTimers();
});

it("does not reopen an old kept entry while a newer detailed form is being filled", async () => {
  await act(async () => { renderer = create(<HomeScreen />); });
  await act(async () => host("DetailedPicker").props.onMoodPress(9));
  await act(async () => { vi.advanceTimersByTime(SUPPORT_SHEET_DELAY_MS); });
  const oldDecline = mocks.support.mock.calls[0]![0].onDecline!;

  await act(async () => host("DetailedPicker").props.onLongPress(4));
  expect(host("DetailedEntry").props.visible).toBe(true);
  await act(async () => {
    oldDecline();
    vi.advanceTimersByTime(SUPPORT_HANDOFF_MS * 2);
  });

  expect(host("KeptDetail").props.visible).toBe(false);
  expect(host("DetailedEntry").props.visible).toBe(true);
  await act(async () => {
    await host("DetailedEntry").props.onSubmit({
      mood: 4, note: "", emotions: [], contextTags: [], energy: null, basedOnEntryId: null,
    });
    host("DetailedEntry").props.onClose();
  });
  expect(mocks.store.create).toHaveBeenCalledTimes(2);
  expect(host("DetailedEntry").props.visible).toBe(false);
  expect(host("KeptDetail").props.visible).toBe(false);
});


it.each(["date", "dateLongPress", "edit", "swipeEdit", "dateToEdit"])(
  "does not reopen an old kept entry after the %s history flow opens",
  async (flow) => {
    await act(async () => { renderer = create(<HomeScreen />); });
    await act(async () => host("DetailedPicker").props.onMoodPress(9));
    await act(async () => { vi.advanceTimersByTime(SUPPORT_SHEET_DELAY_MS); });
    const oldDecline = mocks.support.mock.calls[0]![0].onDecline!;
    const entry = createMockMoodEntry({ id: 100, mood: 4 });
    const item = host("FlashList").props.renderItem({ item: entry });
    await act(async () => {
      if (flow === "edit") item.props.onEdit(entry);
      else if (flow === "swipeEdit") item.props.onSwipeableWillOpen("left", entry);
      else if (flow === "dateLongPress") item.props.onLongPress(entry);
      else item.props.onPress(entry);
    });
    if (flow === "dateToEdit") {
      await act(async () => host("DateTimePicker").props.onEdit(entry));
    }
    const editing = flow === "edit" || flow === "swipeEdit" || flow === "dateToEdit";
    expect(host(editing ? "EditEntry" : "DateTimePicker").props.visible).toBe(true);
    await act(async () => {
      oldDecline();
      vi.advanceTimersByTime(SUPPORT_HANDOFF_MS * 2);
    });
    expect(host("KeptDetail").props.visible).toBe(false);
    expect(host(editing ? "EditEntry" : "DateTimePicker").props.visible).toBe(true);
  }
);


it("does not resume old support detail after Home loses focus", async () => {
  await act(async () => { renderer = create(<HomeScreen />); });
  await act(async () => host("DetailedPicker").props.onMoodPress(9));
  await act(async () => { vi.advanceTimersByTime(SUPPORT_SHEET_DELAY_MS); });
  const oldDecline = mocks.support.mock.calls[0]![0].onDecline!;
  await act(async () => {
    oldDecline();
    mocks.blur!();
    vi.advanceTimersByTime(SUPPORT_HANDOFF_MS * 2);
  });
  expect(host("KeptDetail").props.visible).toBe(false);
});
