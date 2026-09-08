import { beforeEach, describe, expect, test, vi } from "vitest";
import type { MoodEntry, MoodEntryInput } from "../../../db/types";

import { useMoodsStore } from "../../../src/shared/state/moodsStore";

const moodServiceMock = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateTimestamp: vi.fn(),
  getAll: vi.fn(),
}));

vi.mock("@/services/moodService", async () => {
  const actual = await vi.importActual<typeof import("../../../src/services/moodEntryWorkflow")>(
    "../../../src/services/moodEntryWorkflow"
  );

  return {
    createMoodEntryWorkflow: actual.createMoodEntryWorkflow,
    moodService: moodServiceMock,
  };
});

function makeMood(id: number, timestamp: number, overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id,
    mood: 4,
    note: null,
    timestamp,
    emotions: [],
    contextTags: [],
    energy: null,
    moodScale: {
      version: 1,
      min: 0,
      max: 10,
      lowerIsBetter: true,
    },
    basedOnEntryId: null,
    ...overrides,
  };
}

function resetStore() {
  useMoodsStore.setState({
    moods: [],
    status: "idle",
    error: null,
    lastLoadedAt: null,
    isStale: true,
  });
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useMoodsStore", () => {
  beforeEach(() => {
    resetStore();
    Object.values(moodServiceMock).forEach((mock) => mock.mockReset());
  });

  test("confirmed mutations keep a fresh collection without rereading history", async () => {
    const original = makeMood(1, 100);
    const created = makeMood(2, 200);
    useMoodsStore.getState().setLocal([original]);
    moodServiceMock.create.mockResolvedValue(created);
    await useMoodsStore.getState().create({ mood: 4 } satisfies MoodEntryInput);
    expect(useMoodsStore.getState().moods).toEqual([created, original]);

    const updated = { ...created, note: "Updated" };
    moodServiceMock.update.mockResolvedValue(updated);
    await useMoodsStore.getState().update(2, { note: "Updated" });
    expect(useMoodsStore.getState().moods).toEqual([updated, original]);
    moodServiceMock.delete.mockResolvedValue(undefined);
    expect(await useMoodsStore.getState().remove(2)).toEqual(updated);
    expect(useMoodsStore.getState().moods).toEqual([original]);
    await useMoodsStore.getState().restore({ mood: 4 });
    expect(useMoodsStore.getState().moods).toEqual([created, original]);
    expect(useMoodsStore.getState().isStale).toBe(false);
    expect(moodServiceMock.getAll).not.toHaveBeenCalled();
  });

  test("a write before initial hydration still loads missing history", async () => {
    const original = makeMood(1, 100);
    const created = makeMood(2, 200);
    moodServiceMock.create.mockResolvedValue(created);
    moodServiceMock.getAll.mockResolvedValue([created, original]);
    await useMoodsStore.getState().create({ mood: 4 });
    await flushMicrotasks();
    expect(useMoodsStore.getState().moods).toEqual([created, original]);
    expect(useMoodsStore.getState().isStale).toBe(false);
  });

  test("a stale hydration cannot overwrite an intervening confirmed mutation", async () => {
    const original = makeMood(1, 100);
    const created = makeMood(2, 200);
    let resolveRead!: (moods: MoodEntry[]) => void;
    let resolveRetry!: (moods: MoodEntry[]) => void;
    moodServiceMock.getAll
      .mockImplementationOnce(() => new Promise<MoodEntry[]>((resolve) => { resolveRead = resolve; }))
      .mockImplementationOnce(() => new Promise<MoodEntry[]>((resolve) => { resolveRetry = resolve; }));
    const loading = useMoodsStore.getState().loadAll();
    moodServiceMock.create.mockResolvedValue(created);
    await useMoodsStore.getState().create({ mood: 4 });
    resolveRead([original]);
    await flushMicrotasks();
    expect(useMoodsStore.getState().moods).toEqual([created]);
    expect(useMoodsStore.getState().isStale).toBe(true);
    resolveRetry([created, original]);
    await loading;
    expect(useMoodsStore.getState().moods).toEqual([created, original]);
    expect(useMoodsStore.getState().isStale).toBe(false);
    expect(moodServiceMock.getAll).toHaveBeenCalledTimes(2);
  });

  test("an invalidation during hydration requires a new snapshot", async () => {
    let resolveRead!: (moods: MoodEntry[]) => void;
    const latest = makeMood(1, 200);
    moodServiceMock.getAll
      .mockImplementationOnce(() => new Promise<MoodEntry[]>((resolve) => { resolveRead = resolve; }))
      .mockResolvedValueOnce([latest]);
    const loading = useMoodsStore.getState().loadAll();
    useMoodsStore.getState().invalidate();
    resolveRead([]);
    await loading;
    expect(useMoodsStore.getState().moods).toEqual([latest]);
    expect(moodServiceMock.getAll).toHaveBeenCalledTimes(2);
  });

  test("setLocal replaces an in-flight snapshot without a redundant read", async () => {
    let resolveRead!: (moods: MoodEntry[]) => void;
    moodServiceMock.getAll.mockImplementationOnce(() => new Promise<MoodEntry[]>((resolve) => { resolveRead = resolve; }));
    const loading = useMoodsStore.getState().loadAll();
    useMoodsStore.getState().setLocal([]);
    resolveRead([makeMood(1, 100)]);
    await loading;
    expect(useMoodsStore.getState().moods).toEqual([]);
    expect(useMoodsStore.getState().isStale).toBe(false);
    expect(moodServiceMock.getAll).toHaveBeenCalledTimes(1);
  });

  test("failed initial hydration reports an error and remains stale", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    moodServiceMock.getAll.mockRejectedValue(new Error("read failed"));
    await useMoodsStore.getState().loadAll();
    expect(useMoodsStore.getState()).toMatchObject({ status: "error", error: "read failed", isStale: true });
    log.mockRestore();
  });

  test("updateTimestamp reorders entries without a refresh", async () => {
    const older = makeMood(1, 100);
    const newer = makeMood(2, 200);
    const moved = makeMood(1, 300);
    useMoodsStore.getState().setLocal([newer, older]);
    moodServiceMock.updateTimestamp.mockResolvedValue(moved);
    expect(await useMoodsStore.getState().updateTimestamp(1, 300)).toEqual(moved);
    expect(useMoodsStore.getState().moods).toEqual([moved, newer]);
    expect(moodServiceMock.getAll).not.toHaveBeenCalled();
  });

  test("refreshMoods reuses an in-flight refresh request", async () => {
    const moods = [makeMood(1, 100)];
    let resolveRefresh: ((value: MoodEntry[]) => void) | null = null;

    moodServiceMock.getAll.mockReturnValue(
      new Promise<MoodEntry[]>((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const firstRefresh = useMoodsStore.getState().refreshMoods();
    const secondRefresh = useMoodsStore.getState().refreshMoods();

    expect(firstRefresh).toBe(secondRefresh);
    expect(moodServiceMock.getAll).toHaveBeenCalledTimes(1);
    expect(useMoodsStore.getState().status).toBe("refreshing");

    resolveRefresh?.(moods);
    await Promise.all([firstRefresh, secondRefresh]);

    expect(useMoodsStore.getState()).toMatchObject({
      moods,
      status: "idle",
      isStale: false,
    });
  });
});
