import React from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, expect, it, vi } from "vitest";
import type { MoodEntry } from "@db/types";

import { createMockMoodEntry } from "../db/mockClient";

const mocks = vi.hoisted(() => ({
  store: {
    remove: vi.fn<(id: number) => Promise<MoodEntry | null>>(),
    restore: vi.fn(async () => {}),
  },
  toast: { showDeletedMood: vi.fn(), error: vi.fn() },
}));

vi.mock("@/shared/state/moodsStore", () => ({
  useMoodsStore: <T,>(select: (state: typeof mocks.store) => T) => select(mocks.store),
}));
vi.mock("@/services/toastService", () => ({ toastService: mocks.toast }));
vi.mock("@/lib/haptics", () => ({ haptics: { reject: vi.fn(), commit: vi.fn() } }));

import { useMoodItemActions } from "@/hooks/useMoodItemActions";

let deleteMood!: (mood: MoodEntry) => Promise<void>;
function Probe() {
  deleteMood = useMoodItemActions({ setEditingEntry: vi.fn() }).handleDeleteMood;
  return null;
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  await act(async () => { create(<Probe />); });
});

it("offers Undo after a delete", async () => {
  const entry = createMockMoodEntry({ id: 7, mood: 3 });
  mocks.store.remove.mockResolvedValueOnce(entry);

  await act(async () => deleteMood(entry));

  expect(mocks.toast.showDeletedMood).toHaveBeenCalledExactlyOnceWith(entry, expect.any(Function));
  expect(mocks.toast.error).not.toHaveBeenCalled();
});

it("tells the user when a delete fails and offers no Undo", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.store.remove.mockRejectedValueOnce(new Error("storage rejected"));

  await act(async () => deleteMood(createMockMoodEntry({ id: 7, mood: 3 })));

  expect(mocks.toast.error).toHaveBeenCalledExactlyOnceWith("Delete failed", "The entry was not removed.");
  expect(mocks.toast.showDeletedMood).not.toHaveBeenCalled();
});
