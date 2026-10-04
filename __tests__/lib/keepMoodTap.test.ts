import { afterEach, describe, expect, it, vi } from "vitest";
import type { MoodEntry } from "@db/types";

import { createMockMoodEntry } from "../db/mockClient";
import { SUPPORT_HANDOFF_MS, SUPPORT_SHEET_DELAY_MS, beginMoodEntryFlow, keepMoodTap, type KeepMoodTapDeps } from "@/lib/keepMoodTap";

function setup(overrides: Partial<KeepMoodTapDeps> = {}) {
  const deps: KeepMoodTapDeps = {
    state: { inFlight: false, generation: 0 },
    create: vi.fn(async (input) => createMockMoodEntry({ id: 11, mood: input.mood })),
    afterCommit: [],
    offersDetail: true,
    openDetail: vi.fn(),
    showUndoToast: vi.fn(),
    showSupport: vi.fn(),
    feedback: { commit: vi.fn(), reject: vi.fn() },
    onSaveError: vi.fn(),
    ...overrides,
  };
  return deps;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("keepMoodTap", () => {
  it("saves the mood only and opens the detail sheet for that entry", async () => {
    const deps = setup();
    await keepMoodTap(4, deps);

    expect(deps.create).toHaveBeenCalledWith({
      mood: 4, note: null, emotions: [], contextTags: [], energy: null, basedOnEntryId: null,
    });
    expect(deps.openDetail).toHaveBeenCalledWith(expect.objectContaining({ id: 11, mood: 4 }));
    expect(deps.state.inFlight).toBe(false);
  });

  it("ignores a second tap while the first write is pending", async () => {
    let resolve!: (entry: MoodEntry) => void;
    const create = vi.fn(() => new Promise<MoodEntry>((done) => { resolve = done; }));
    const deps = setup({ create, offersDetail: false });

    const first = keepMoodTap(4, deps);
    await keepMoodTap(6, deps);
    resolve(createMockMoodEntry({ id: 11, mood: 4 }));
    await first;

    expect(create).toHaveBeenCalledTimes(1);
    expect(deps.showUndoToast).toHaveBeenCalledTimes(1);

    const next = keepMoodTap(6, deps);
    expect(create).toHaveBeenCalledTimes(2);
    resolve(createMockMoodEntry({ id: 12, mood: 6 }));
    await next;
  });

  it.each([
    [true, "openDetail"],
    [false, "showUndoToast"],
  ] as const)("shows support first for a severe rating, then %s via Not now", async (offersDetail, followUp) => {
    vi.useFakeTimers();
    const deps = setup({ offersDetail });

    await keepMoodTap(9, deps);
    expect(deps.showSupport).not.toHaveBeenCalled();
    await keepMoodTap(9, deps);
    expect(deps.create).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(SUPPORT_SHEET_DELAY_MS);
    expect(deps.showSupport).toHaveBeenCalledTimes(1);
    expect(deps[followUp]).not.toHaveBeenCalled();
    expect(deps.state.inFlight).toBe(false);

    vi.mocked(deps.showSupport).mock.calls[0]![0]();
    expect(deps[followUp]).not.toHaveBeenCalled();
    await keepMoodTap(4, deps);
    expect(deps.create).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(SUPPORT_HANDOFF_MS);
    expect(deps[followUp]).toHaveBeenCalledTimes(1);
    expect(deps.state.inFlight).toBe(false);
  });

  it("reports a failed write and allows another tap", async () => {
    const deps = setup({ create: vi.fn(async () => { throw new Error("disk full"); }) });

    await keepMoodTap(4, deps);

    expect(deps.feedback.reject).toHaveBeenCalledTimes(1);
    expect(deps.onSaveError).toHaveBeenCalledTimes(1);
    expect(deps.openDetail).not.toHaveBeenCalled();
    expect(deps.state.inFlight).toBe(false);
  });
});

describe("delayed support flow ownership", () => {
  it.each([true, false])("does not replace a newer quick entry's follow-up (detail: %s)", async (offersDetail) => {
    vi.useFakeTimers();
    const deps = setup({
      offersDetail,
      create: vi.fn(async (input) => createMockMoodEntry({ id: input.mood === 9 ? 11 : 12, mood: input.mood })),
    });
    await keepMoodTap(9, deps);
    vi.advanceTimersByTime(SUPPORT_SHEET_DELAY_MS);
    const olderDecline = vi.mocked(deps.showSupport).mock.calls[0]![0];

    await keepMoodTap(4, deps);
    olderDecline();
    vi.advanceTimersByTime(SUPPORT_HANDOFF_MS);

    const followUp = offersDetail ? deps.openDetail : deps.showUndoToast;
    expect(followUp).toHaveBeenCalledTimes(1);
    expect(followUp).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));
    expect(deps.state.inFlight).toBe(false);
  });

  it("does not take or release the lock of a newer pending save", async () => {
    vi.useFakeTimers();
    const deps = setup();
    await keepMoodTap(9, deps);
    vi.advanceTimersByTime(SUPPORT_SHEET_DELAY_MS);
    const olderDecline = vi.mocked(deps.showSupport).mock.calls[0]![0];
    let finish!: (entry: MoodEntry) => void;
    deps.create = vi.fn(() => new Promise<MoodEntry>((resolve) => { finish = resolve; }));
    const newerSave = keepMoodTap(4, deps);

    olderDecline();
    vi.advanceTimersByTime(SUPPORT_HANDOFF_MS);
    expect(deps.openDetail).not.toHaveBeenCalled();
    expect(deps.state.inFlight).toBe(true);
    finish(createMockMoodEntry({ id: 12, mood: 4 }));
    await newerSave;
    expect(deps.openDetail).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));
  });

  it("cancels a scheduled older handoff when a detailed save begins", async () => {
    vi.useFakeTimers();
    const deps = setup();
    await keepMoodTap(9, deps);
    vi.advanceTimersByTime(SUPPORT_SHEET_DELAY_MS);
    vi.mocked(deps.showSupport).mock.calls[0]![0]();

    beginMoodEntryFlow(deps.state);
    deps.state.inFlight = true;
    vi.advanceTimersByTime(SUPPORT_HANDOFF_MS);

    expect(deps.openDetail).not.toHaveBeenCalled();
    expect(deps.showUndoToast).not.toHaveBeenCalled();
    expect(deps.state.inFlight).toBe(true);
  });

  it("ignores repeated declines for the same entry", async () => {
    vi.useFakeTimers();
    const deps = setup();
    await keepMoodTap(9, deps);
    vi.advanceTimersByTime(SUPPORT_SHEET_DELAY_MS);
    const decline = vi.mocked(deps.showSupport).mock.calls[0]![0];
    decline();
    decline();
    vi.advanceTimersByTime(SUPPORT_HANDOFF_MS);
    expect(deps.openDetail).toHaveBeenCalledTimes(1);
  });
});
