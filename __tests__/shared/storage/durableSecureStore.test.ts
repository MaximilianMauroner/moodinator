import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  setItemAsync: vi.fn(() => Promise.resolve()),
  deleteItemAsync: vi.fn(() => Promise.resolve()),
}));

import * as SecureStore from "expo-secure-store";
import { setDurableItemAsync } from "@/shared/storage/durableSecureStore";

describe("setDurableItemAsync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("finishes with a checked marker deletion after writing the value", async () => {
    const options = { keychainService: "test" };

    await setDurableItemAsync("key", "value", options);

    expect(vi.mocked(SecureStore.setItemAsync).mock.calls).toEqual([
      ["key.moodinatorDurabilityCheck", "pending", options],
      ["key", "value", options],
    ]);
    expect(vi.mocked(SecureStore.deleteItemAsync)).toHaveBeenCalledWith(
      "key.moodinatorDurabilityCheck",
      options
    );
    expect(vi.mocked(SecureStore.deleteItemAsync).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(SecureStore.setItemAsync).mock.invocationCallOrder[1]
    );
  });

  it("rejects when the checked durability commit fails", async () => {
    vi.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error("commit failed"));

    await expect(setDurableItemAsync("key", "value")).rejects.toThrow("commit failed");
  });

  it("serializes concurrent writes through their checked commits", async () => {
    let releaseFirstCommit: (() => void) | undefined;
    vi.mocked(SecureStore.deleteItemAsync).mockImplementationOnce(
      () => new Promise<void>((resolve) => { releaseFirstCommit = resolve; })
    );

    const first = setDurableItemAsync("key", "first");
    await vi.waitFor(() => expect(releaseFirstCommit).toBeTypeOf("function"));
    const second = setDurableItemAsync("key", "second");

    expect(vi.mocked(SecureStore.setItemAsync).mock.calls).toEqual([
      ["key.moodinatorDurabilityCheck", "pending", undefined],
      ["key", "first", undefined],
    ]);

    releaseFirstCommit?.();
    await Promise.all([first, second]);
    expect(vi.mocked(SecureStore.setItemAsync).mock.calls).toEqual([
      ["key.moodinatorDurabilityCheck", "pending", undefined],
      ["key", "first", undefined],
      ["key.moodinatorDurabilityCheck", "pending", undefined],
      ["key", "second", undefined],
    ]);
  });
});
