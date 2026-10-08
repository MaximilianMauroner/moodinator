import { expect, test, vi } from "vitest";
import { createMoodQueryFamily, invalidateMoodQueries } from "@/services/moodQueryCache";

test("two consumers share a query and its pending read", async () => {
  const load = vi.fn(async (key: number) => [key]);
  const family = createMoodQueryFamily(String, load);
  const first = family(1);
  const second = family(1);
  const leaveFirst = first.subscribe(() => {});
  const leaveSecond = second.subscribe(() => {});
  await first.refresh();
  expect(first).toBe(second);
  expect(load).toHaveBeenCalledTimes(1);
  expect(second.getSnapshot().data).toEqual([1]);
  leaveFirst();
  invalidateMoodQueries();
  await second.refresh();
  expect(load).toHaveBeenCalledTimes(2);
  leaveSecond();
  invalidateMoodQueries();
  expect(load).toHaveBeenCalledTimes(2);
  await Promise.resolve();
  expect(family(1)).not.toBe(first);
});

test("a pre-mutation read cannot overwrite the confirmed newer query", async () => {
  let finishOld!: (value: string[]) => void;
  const load = vi.fn<() => Promise<string[]>>()
    .mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
    .mockResolvedValueOnce(["restored"]);
  const query = createMoodQueryFamily(() => "history", load)(undefined);
  const leave = query.subscribe(() => {});
  const old = query.refresh();
  await Promise.resolve();
  invalidateMoodQueries();
  await query.refresh();
  expect(query.getSnapshot().data).toEqual(["restored"]);
  finishOld(["deleted"]);
  await old;
  expect(query.getSnapshot().data).toEqual(["restored"]);
  leave();
});

test("a failed refresh keeps prior data stale and an explicit retry recovers", async () => {
  const load = vi.fn().mockResolvedValueOnce([1]).mockRejectedValueOnce(new Error("bridge failed")).mockResolvedValueOnce([2]);
  const query = createMoodQueryFamily(() => "range", load)(undefined);
  const leave = query.subscribe(() => {});
  await query.refresh();
  invalidateMoodQueries();
  await query.refresh();
  expect(query.getSnapshot()).toEqual({ data: [1], loading: false, stale: true, error: "bridge failed" });
  await query.refresh();
  expect(query.getSnapshot()).toEqual({ data: [2], loading: false, stale: false, error: null });
  leave();
});

test("switching selection disposes the old query without sharing its reply", async () => {
  let finishOld!: (value: number[]) => void;
  const load = vi.fn((key: number) => key === 1 ? new Promise<number[]>((resolve) => { finishOld = resolve; }) : Promise.resolve([key]));
  const family = createMoodQueryFamily(String, load);
  const old = family(1);
  const leaveOld = old.subscribe(() => {});
  const oldRead = old.refresh();
  await Promise.resolve();
  leaveOld();
  const current = family(2);
  const leaveCurrent = current.subscribe(() => {});
  await current.refresh();
  finishOld([1]);
  await oldRead;
  expect(current.getSnapshot().data).toEqual([2]);
  expect(old.getSnapshot().data).toBeUndefined();
  leaveCurrent();
});


test("effect resubscription retains sharing and reloads an interrupted read", async () => {
  const load = vi.fn(async () => [1]);
  const family = createMoodQueryFamily(() => "month", load);
  const query = family(undefined);
  const firstLeave = query.subscribe(() => {});
  firstLeave();
  const secondLeave = query.subscribe(() => {});
  await query.refresh();
  expect(family(undefined)).toBe(query);
  expect(query.getSnapshot().data).toEqual([1]);
  secondLeave();
});

test("resubscribing during a refresh after successful hydration cannot leave loading stuck", async () => {
  let finishOld!: (value: number[]) => void;
  const load = vi.fn<() => Promise<number[]>>()
    .mockResolvedValueOnce([1])
    .mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
    .mockResolvedValueOnce([3]);
  const family = createMoodQueryFamily(() => "summary", load);
  const query = family(undefined);
  const leave = query.subscribe(() => {});
  await query.refresh();
  const old = query.refresh();
  await Promise.resolve();
  leave();
  const leaveAgain = query.subscribe(() => {});
  await query.refresh();
  finishOld([2]);
  await old;
  expect(family(undefined)).toBe(query);
  expect(query.getSnapshot()).toEqual({ data: [3], loading: false, stale: false, error: null });
  leaveAgain();
});
