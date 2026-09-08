import { beforeEach, describe, expect, test, vi } from "vitest";
import type { MoodEntry, MoodEntryInput } from "../../../db/types";

import { useMoodsStore } from "../../../src/shared/state/moodsStore";

const moodServiceMock = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateTimestamp: vi.fn(),
  getAll: vi.fn(),
  getPaginated: vi.fn(),
}));

vi.mock("@/services/moodService", async () => {
  const actual = await vi.importActual<
    typeof import("../../../src/services/moodEntryWorkflow")
  >("../../../src/services/moodEntryWorkflow");

  return {
    createMoodEntryWorkflow: actual.createMoodEntryWorkflow,
    moodService: moodServiceMock,
  };
});

function makeMood(
  id: number,
  timestamp: number,
  overrides: Partial<MoodEntry> = {},
): MoodEntry {
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
    filters: {},
    hasMore: false,
    total: 0,
    loadingMore: false,
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
    moodServiceMock.getPaginated.mockImplementation(async () => {
      const data = await moodServiceMock.getAll();
      return { data: data ?? [], total: data?.length ?? 0, hasMore: false };
    });
  });

  test("confirmed mutations refresh the recent window after create, update, delete and undo", async () => {
    const original = makeMood(1, 100);
    const created = makeMood(2, 200);
    useMoodsStore.getState().setLocal([original]);
    moodServiceMock.create.mockResolvedValue(created);
    moodServiceMock.getAll.mockResolvedValue([created, original]);
    await useMoodsStore.getState().create({ mood: 4 } satisfies MoodEntryInput);
    expect(useMoodsStore.getState().moods).toEqual([created, original]);

    await useMoodsStore.getState().ensureFresh();
    const updated = { ...created, note: "Updated" };
    moodServiceMock.getAll.mockResolvedValue([updated, original]);
    moodServiceMock.update.mockResolvedValue(updated);
    await useMoodsStore.getState().update(2, { note: "Updated" });
    expect(useMoodsStore.getState().moods).toEqual([updated, original]);
    await useMoodsStore.getState().ensureFresh();
    moodServiceMock.getAll.mockResolvedValue([original]);
    moodServiceMock.delete.mockResolvedValue(undefined);
    expect(await useMoodsStore.getState().remove(2)).toEqual(updated);
    expect(useMoodsStore.getState().moods).toEqual([original]);
    await useMoodsStore.getState().ensureFresh();
    moodServiceMock.getAll.mockResolvedValue([created, original]);
    await useMoodsStore.getState().restore({ mood: 4 });
    expect(useMoodsStore.getState().moods).toEqual([created, original]);
    await useMoodsStore.getState().ensureFresh();
    expect(useMoodsStore.getState().isStale).toBe(false);
    expect(moodServiceMock.getPaginated).toHaveBeenCalledTimes(4);
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
      .mockImplementationOnce(
        () =>
          new Promise<MoodEntry[]>((resolve) => {
            resolveRead = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<MoodEntry[]>((resolve) => {
            resolveRetry = resolve;
          }),
      );
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
      .mockImplementationOnce(
        () =>
          new Promise<MoodEntry[]>((resolve) => {
            resolveRead = resolve;
          }),
      )
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
    moodServiceMock.getAll.mockImplementationOnce(
      () =>
        new Promise<MoodEntry[]>((resolve) => {
          resolveRead = resolve;
        }),
    );
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
    expect(useMoodsStore.getState()).toMatchObject({
      status: "error",
      error: "read failed",
      isStale: true,
    });
    log.mockRestore();
  });

  test("updateTimestamp reorders entries and refreshes the window", async () => {
    const older = makeMood(1, 100);
    const newer = makeMood(2, 200);
    const moved = makeMood(1, 300);
    useMoodsStore.getState().setLocal([newer, older]);
    moodServiceMock.updateTimestamp.mockResolvedValue(moved);
    moodServiceMock.getAll.mockResolvedValue([moved, newer]);
    expect(await useMoodsStore.getState().updateTimestamp(1, 300)).toEqual(
      moved,
    );
    expect(useMoodsStore.getState().moods).toEqual([moved, newer]);
    await useMoodsStore.getState().ensureFresh();
    expect(moodServiceMock.getPaginated).toHaveBeenCalledTimes(1);
  });

  test("refreshMoods reuses an in-flight refresh request", async () => {
    const moods = [makeMood(1, 100)];
    let resolveRefresh: ((value: MoodEntry[]) => void) | null = null;

    moodServiceMock.getAll.mockReturnValue(
      new Promise<MoodEntry[]>((resolve) => {
        resolveRefresh = resolve;
      }),
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

describe("windowed history", () => {
  beforeEach(() => {
    resetStore();
    Object.values(moodServiceMock).forEach((mock) => mock.mockReset());
  });

  test("loads a bounded page and appends tied timestamps without duplicates or gaps", async () => {
    const all = Array.from({ length: 123 }, (_, index) =>
      makeMood(123 - index, 100),
    );
    moodServiceMock.getPaginated.mockImplementation(
      async ({ offset, limit }) => ({
        data: all.slice(offset, offset + limit),
        total: all.length,
        hasMore: offset + limit < all.length,
      }),
    );
    await useMoodsStore.getState().loadAll();
    expect(useMoodsStore.getState().moods).toHaveLength(50);
    await Promise.all([
      useMoodsStore.getState().loadMore(),
      useMoodsStore.getState().loadMore(),
    ]);
    expect(useMoodsStore.getState().moods).toHaveLength(100);
    await useMoodsStore.getState().loadMore();
    expect(useMoodsStore.getState().moods).toEqual(all);
    expect(useMoodsStore.getState().hasMore).toBe(false);
    expect(moodServiceMock.getAll).not.toHaveBeenCalled();
  });

  test("a write while appending discards the obsolete page and refreshes the bounded window", async () => {
    const all = Array.from({ length: 100 }, (_, index) =>
      makeMood(100 - index, 100 - index),
    );
    let finishPage!: (value: unknown) => void;
    moodServiceMock.getPaginated.mockResolvedValueOnce({
      data: all.slice(0, 50),
      total: 100,
      hasMore: true,
    });
    await useMoodsStore.getState().loadAll();
    moodServiceMock.getPaginated.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPage = resolve;
        }),
    );
    const paging = useMoodsStore.getState().loadMore();
    const created = makeMood(101, 101);
    moodServiceMock.create.mockResolvedValue(created);
    const fresh = [created, ...all].slice(0, 50);
    moodServiceMock.getPaginated.mockResolvedValueOnce({
      data: fresh,
      total: 101,
      hasMore: true,
    });
    await useMoodsStore.getState().create({ mood: 4 });
    await useMoodsStore.getState().ensureFresh();
    finishPage({ data: all.slice(50), total: 100, hasMore: false });
    await paging;
    expect(useMoodsStore.getState().moods).toEqual(fresh);
    expect(useMoodsStore.getState().total).toBe(101);
    expect(useMoodsStore.getState().hasMore).toBe(true);
  });

  test("clearing filters restores the unfiltered first page even while a filter query is pending", async () => {
    let finishFilter!: (value: unknown) => void;
    const all = [makeMood(1, 100)];
    moodServiceMock.getPaginated
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFilter = resolve;
          }),
      )
      .mockResolvedValueOnce({ data: all, total: 1, hasMore: false });
    const filtering = useMoodsStore
      .getState()
      .setFilters({ contexts: ["Work"], minMood: 7 });
    const clearing = useMoodsStore.getState().clearFilters();
    finishFilter({ data: [], total: 0, hasMore: false });
    await Promise.all([filtering, clearing]);
    expect(useMoodsStore.getState()).toMatchObject({
      filters: {},
      moods: all,
      status: "idle",
      isStale: false,
    });
    expect(moodServiceMock.getPaginated).toHaveBeenLastCalledWith({
      offset: 0,
      limit: 50,
      filters: {},
    });
  });

  test("empty filters results settle to idle and filtered mutations requery SQL", async () => {
    moodServiceMock.getPaginated.mockResolvedValue({
      data: [],
      total: 0,
      hasMore: false,
    });
    await useMoodsStore.getState().setFilters({ minMood: 7 });
    expect(useMoodsStore.getState()).toMatchObject({
      status: "idle",
      moods: [],
      total: 0,
    });
    moodServiceMock.create.mockResolvedValue(makeMood(2, 200, { mood: 1 }));
    await useMoodsStore.getState().create({ mood: 1 });
    await useMoodsStore.getState().ensureFresh();
    expect(useMoodsStore.getState().moods).toEqual([]);
    expect(moodServiceMock.getPaginated).toHaveBeenCalledTimes(2);
  });
});

test("loadAll invalidates a page requested from the end of an older window", async () => {
  resetStore();
  moodServiceMock.getPaginated.mockReset();
  const all = Array.from({ length: 150 }, (_, index) =>
    makeMood(150 - index, 150 - index),
  );
  moodServiceMock.getPaginated.mockImplementation(
    async ({ offset, limit }) => ({
      data: all.slice(offset, offset + limit),
      total: 150,
      hasMore: offset + limit < 150,
    }),
  );
  await useMoodsStore.getState().loadAll();
  await useMoodsStore.getState().loadMore();
  let finishPage!: (value: unknown) => void;
  moodServiceMock.getPaginated.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishPage = resolve;
      }),
  );
  const paging = useMoodsStore.getState().loadMore();
  await useMoodsStore.getState().loadAll();
  finishPage({ data: all.slice(100), total: 150, hasMore: false });
  await paging;
  expect(useMoodsStore.getState().moods).toEqual(all.slice(0, 50));
  await useMoodsStore.getState().loadMore();
  expect(useMoodsStore.getState().moods).toEqual(all.slice(0, 100));
});

test("a filtered deletion stays removed if the subsequent refresh fails", async () => {
  resetStore();
  moodServiceMock.getPaginated.mockReset();
  const entry = makeMood(1, 100);
  moodServiceMock.getPaginated.mockResolvedValueOnce({
    data: [entry],
    total: 1,
    hasMore: false,
  });
  await useMoodsStore.getState().setFilters({ text: "work" });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  moodServiceMock.getPaginated.mockRejectedValue(new Error("read failed"));
  moodServiceMock.delete.mockResolvedValue(undefined);
  expect(await useMoodsStore.getState().remove(1)).toEqual(entry);
  await useMoodsStore.getState().ensureFresh();
  expect(useMoodsStore.getState().moods).toEqual([]);
  expect(useMoodsStore.getState().error).toBe("read failed");
  log.mockRestore();
});
