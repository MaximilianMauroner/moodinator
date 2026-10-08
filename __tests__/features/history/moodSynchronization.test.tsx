import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createMockDb } from "../../db/mockClient";
import { useMoodsStore } from "@/shared/state/moodsStore";
import { useHistoryForecast } from "@/features/history/useHistoryForecast";
import { useCalendarData } from "@/components/calendar/useCalendarData";

const database = createMockDb();
vi.mock("../../../db/client", () => ({ getDb: vi.fn(async () => database) }));
vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}));
vi.mock("expo-router", () => ({ useFocusEffect: () => {} }));
vi.mock("@/services/moodService", async () => {
  const workflow = await import("../../../src/services/moodEntryWorkflow");
  const repository = await import("../../../db/moods/repository");
  return { ...workflow, moodService: {
    create: repository.insertMoodEntry,
    delete: async (id: number) => (await repository.deleteMood(id)).changes > 0,
    getInRange: repository.getMoodsWithinRange,
    getPaginated: repository.getMoodsPaginated,
    getByMonth: repository.getMoodsByMonth,
  } };
});

let forecast: ReturnType<typeof useHistoryForecast>;
let calendar: ReturnType<typeof useCalendarData>;
let renderer: ReactTestRenderer;
function Harness() {
  forecast = useHistoryForecast(7);
  calendar = useCalendarData(2026, 9);
  return <span>{forecast.selectedDay?.entries.length ?? "closed"}</span>;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T12:00:00"));
  database.__reset();
  useMoodsStore.setState({ filters: {}, status: "idle", total: 0 });
  useMoodsStore.getState().setLocal([]);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.useRealTimers();
});

test("delete and Undo update All entries, an open day detail and calendar through the production store", async () => {
  const store = useMoodsStore.getState();
  const original = await store.create({ mood: 2, note: "fabricated test", timestamp: new Date("2026-10-08T09:00:00").getTime(), utcOffsetMinutes: 0 });
  await store.ensureFresh();
  await act(async () => { renderer = create(<Harness />); });
  await act(async () => forecast.selectDay(forecast.days[0]));
  expect(renderer.root.findByType("span").children).toEqual(["1"]);
  expect(calendar.monthData?.days.get(8)?.entries).toHaveLength(1);

  await act(async () => { await store.remove(original.id); await store.ensureFresh(); });
  expect(useMoodsStore.getState().moods).toEqual([]);
  expect(useMoodsStore.getState().total).toBe(0);
  expect(renderer.root.findByType("span").children).toEqual(["0"]);
  expect(forecast.selectedDay?.dayKey).toBe("2026-10-08");
  expect(calendar.monthData?.days.has(8)).toBe(false);

  let restoredId = 0;
  await act(async () => { restoredId = (await store.restore(original)).id; await store.ensureFresh(); });
  expect(restoredId).not.toBe(original.id);
  expect(useMoodsStore.getState().moods.map((entry) => entry.id)).toEqual([restoredId]);
  expect(useMoodsStore.getState().total).toBe(1);
  expect(renderer.root.findByType("span").children).toEqual(["1"]);
  expect(forecast.selectedDay?.entries[0].id).toBe(restoredId);
  expect(calendar.monthData?.days.get(8)?.entries[0].id).toBe(restoredId);
});

test("filtered Undo confirms SQL membership without copying history filters into forecast or calendar", async () => {
  const store = useMoodsStore.getState();
  const timestamp = new Date("2026-10-08T09:00:00").getTime();
  const original = await store.create({ mood: 2, note: "match", timestamp });
  await store.create({ mood: 4, note: "other", timestamp: timestamp + 1000 });
  await store.ensureFresh();
  await store.setFilters({ text: "match" });
  await act(async () => { renderer = create(<Harness />); });
  expect(useMoodsStore.getState().moods).toHaveLength(1);
  expect(forecast.days[0].entries).toHaveLength(2);
  await act(async () => { await store.remove(original.id); await store.ensureFresh(); });
  await act(async () => { await store.restore(original); await store.ensureFresh(); });
  expect(useMoodsStore.getState().moods).toHaveLength(1);
  expect(useMoodsStore.getState().moods[0].note).toBe("match");
  expect(forecast.days[0].entries).toHaveLength(2);
  expect(calendar.monthData?.days.get(8)?.entries).toHaveLength(2);
});
