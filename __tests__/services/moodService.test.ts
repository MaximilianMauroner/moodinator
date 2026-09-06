import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb } from "../db/mockClient";
import { moodService } from "../../src/services/moodService";

const db = createMockDb();
vi.mock("../../db/client", () => ({ getDb: async () => db }));

describe("moodService.getLastEntry", () => {
  beforeEach(() => { db.__reset(); });

  it("returns null for an empty history", async () => {
    expect(await moodService.getLastEntry()).toBeNull();
  });

  it("returns the newest entry without reading the full history or a count", async () => {
    db.__addMood({ id: 1, timestamp: 300, note: "latest" });
    db.__addMood({ id: 2, timestamp: 100, note: "older" });
    const all = vi.spyOn(db, "getAllAsync");
    const first = vi.spyOn(db, "getFirstAsync");
    expect(await moodService.getLastEntry()).toMatchObject({ id: 1, note: "latest" });
    expect(all).not.toHaveBeenCalled();
    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith(expect.stringContaining("LIMIT 1"));
  });
});
