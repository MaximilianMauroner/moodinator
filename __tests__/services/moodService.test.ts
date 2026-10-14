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
  it("excludes the saved quick entry and preserves deterministic timestamp ties", async () => {
    const prior = db.__addMood({ timestamp: 300, note: "prior" });
    const current = db.__addMood({ timestamp: 300, note: "just saved" });
    expect(await moodService.getLastEntry()).toMatchObject({ id: current.id });
    expect(await moodService.getLastEntry(current.id)).toMatchObject({ id: prior.id, note: "prior" });
  });

  it("does not copy an entry into itself when it is the only saved entry", async () => {
    const current = db.__addMood({ timestamp: 300 });
    expect(await moodService.getLastEntry(current.id)).toBeNull();
  });

  it("can copy the latest other entry while editing an older one", async () => {
    const editing = db.__addMood({ timestamp: 100 });
    const latest = db.__addMood({ timestamp: 400, note: "latest other entry" });
    expect(await moodService.getLastEntry(editing.id)).toMatchObject({ id: latest.id });
  });

});
