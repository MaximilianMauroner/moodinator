import type React from "react";
import { expect, test, vi } from "vitest";
import { toastService } from "@/services/toastService";
import { createMockMoodEntry } from "../db/mockClient";

const toast = vi.hoisted(() => ({
  custom: vi.fn((render: (id: string) => React.ReactElement<{ onUndo: () => void }>) => render("toast")),
  dismiss: vi.fn(), error: vi.fn(), success: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast }));
vi.mock("@/components/ui/DeletedMoodToast", () => ({
  DeletedMoodToast: "DeletedMoodToast", KeptMoodToast: "KeptMoodToast", RestoredMoodToast: "RestoredMoodToast",
}));

test("two quick Undo taps restore one entry while the first restore is pending", async () => {
  let finish!: () => void;
  const restore = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  toastService.showDeletedMood(createMockMoodEntry(), restore);
  const undo = toast.custom.mock.results[0].value.props.onUndo;
  undo();
  undo();
  expect(restore).toHaveBeenCalledTimes(1);
  finish();
  await Promise.resolve();
  await Promise.resolve();
  expect(toast.dismiss).toHaveBeenCalledTimes(1);
});
