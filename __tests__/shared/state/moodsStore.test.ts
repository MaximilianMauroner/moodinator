import { beforeEach, describe, expect, test, vi } from "vitest";
import type { MoodEntry, MoodEntryInput } from "../../../db/types";

const moodServiceMock = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateTimestamp: vi.fn(),
  getAll: vi.fn(),
  getPaginated: vi.fn(),
}));

vi.mock("@/services/moodService", () => ({
  moodService: moodServiceMock,
}));

import { useMoodsStore } from "../../../src/shared/state/moodsStore";

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
    photos: [],
    location: null,
    voiceMemos: [],
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
    lastTracked: null,
    totalCount: 0,
    hasMore: false,
    currentOffset: 0,
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

  test("create invalidates and revalidates", async () => {
    const created = makeMood(1, 100);
    let resolveRefresh: ((value: MoodEntry[]) => void) | null = null;

    moodServiceMock.create.mockResolvedValue(created);
    moodServiceMock.getAll.mockReturnValue(
      new Promise<MoodEntry[]>((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const result = await useMoodsStore.getState().create({
      mood: created.mood,
    } satisfies MoodEntryInput);

    await flushMicrotasks();

    expect(result).toEqual(created);
    expect(useMoodsStore.getState().moods).toEqual([created]);
    expect(useMoodsStore.getState().isStale).toBe(true);
    expect(useMoodsStore.getState().status).toBe("refreshing");
    expect(moodServiceMock.getAll).toHaveBeenCalledTimes(1);

    resolveRefresh?.([created]);
    await flushMicrotasks();

    expect(useMoodsStore.getState().isStale).toBe(false);
    expect(useMoodsStore.getState().status).toBe("idle");
  });

  test("update invalidates and revalidates", async () => {
    const original = makeMood(1, 100);
    const updated = makeMood(1, 100, { note: "Updated" });
    let resolveRefresh: ((value: MoodEntry[]) => void) | null = null;

    useMoodsStore.setState({
      ...useMoodsStore.getState(),
      moods: [original],
      isStale: false,
      lastLoadedAt: Date.now(),
      totalCount: 1,
      currentOffset: 1,
    });

    moodServiceMock.update.mockResolvedValue(updated);
    moodServiceMock.getAll.mockReturnValue(
      new Promise<MoodEntry[]>((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const result = await useMoodsStore.getState().update(1, { note: "Updated" });
    await flushMicrotasks();

    expect(result).toEqual(updated);
    expect(useMoodsStore.getState().moods).toEqual([updated]);
    expect(useMoodsStore.getState().isStale).toBe(true);
    expect(useMoodsStore.getState().status).toBe("refreshing");

    resolveRefresh?.([updated]);
    await flushMicrotasks();

    expect(useMoodsStore.getState().isStale).toBe(false);
  });

  test("remove invalidates and revalidates", async () => {
    const original = makeMood(1, 100);
    let resolveRefresh: ((value: MoodEntry[]) => void) | null = null;

    useMoodsStore.setState({
      ...useMoodsStore.getState(),
      moods: [original],
      isStale: false,
      lastLoadedAt: Date.now(),
      totalCount: 1,
      currentOffset: 1,
    });

    moodServiceMock.delete.mockResolvedValue(undefined);
    moodServiceMock.getAll.mockReturnValue(
      new Promise<MoodEntry[]>((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const removed = await useMoodsStore.getState().remove(1);
    await flushMicrotasks();

    expect(removed).toEqual(original);
    expect(useMoodsStore.getState().moods).toEqual([]);
    expect(useMoodsStore.getState().isStale).toBe(true);

    resolveRefresh?.([]);
    await flushMicrotasks();

    expect(useMoodsStore.getState().isStale).toBe(false);
  });

  test("restore invalidates and revalidates", async () => {
    const restored = makeMood(2, 200);
    let resolveRefresh: ((value: MoodEntry[]) => void) | null = null;

    moodServiceMock.create.mockResolvedValue(restored);
    moodServiceMock.getAll.mockReturnValue(
      new Promise<MoodEntry[]>((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const result = await useMoodsStore.getState().restore({
      mood: restored.mood,
      note: restored.note,
    });
    await flushMicrotasks();

    expect(result).toEqual(restored);
    expect(useMoodsStore.getState().moods).toEqual([restored]);
    expect(useMoodsStore.getState().status).toBe("refreshing");

    resolveRefresh?.([restored]);
    await flushMicrotasks();

    expect(useMoodsStore.getState().isStale).toBe(false);
  });

  test("setLocal recalculates derived collection state", () => {
    const older = makeMood(1, 100);
    const newer = makeMood(2, 200);

    useMoodsStore.getState().setLocal([older, newer]);

    expect(useMoodsStore.getState()).toMatchObject({
      moods: [older, newer],
      isStale: false,
      totalCount: 2,
      hasMore: false,
      currentOffset: 2,
      lastTracked: new Date(newer.timestamp),
    });
  });

  test("updateTimestamp reorders entries after refresh", async () => {
    const older = makeMood(1, 100);
    const newer = makeMood(2, 200);
    const moved = makeMood(1, 300);
    let resolveRefresh: ((value: MoodEntry[]) => void) | null = null;

    useMoodsStore.setState({
      ...useMoodsStore.getState(),
      moods: [newer, older],
      isStale: false,
      lastLoadedAt: Date.now(),
      totalCount: 2,
      currentOffset: 2,
      lastTracked: new Date(newer.timestamp),
    });

    moodServiceMock.updateTimestamp.mockResolvedValue(moved);
    moodServiceMock.getAll.mockReturnValue(
      new Promise<MoodEntry[]>((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const result = await useMoodsStore.getState().updateTimestamp(1, 300);
    await flushMicrotasks();

    expect(result).toEqual(moved);
    expect(useMoodsStore.getState().moods.map((mood) => mood.id)).toEqual([1, 2]);
    expect(useMoodsStore.getState().status).toBe("refreshing");

    resolveRefresh?.([moved, newer]);
    await flushMicrotasks();

    expect(useMoodsStore.getState().moods.map((mood) => mood.id)).toEqual([1, 2]);
    expect(useMoodsStore.getState().isStale).toBe(false);
  });
});
