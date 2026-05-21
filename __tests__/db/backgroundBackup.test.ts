import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  createBackupMock,
  isBackupNeededMock,
  cleanupOldBackupsMock,
  isTaskRegisteredAsyncMock,
  registerTaskAsyncMock,
  defineTaskMock,
} = vi.hoisted(() => ({
  createBackupMock: vi.fn(),
  isBackupNeededMock: vi.fn(),
  cleanupOldBackupsMock: vi.fn(),
  isTaskRegisteredAsyncMock: vi.fn(),
  registerTaskAsyncMock: vi.fn(),
  defineTaskMock: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

vi.mock("expo-background-task", () => ({
  registerTaskAsync: registerTaskAsyncMock,
  BackgroundTaskResult: {
    Success: 1,
    Failed: 2,
  },
  BackgroundTaskStatus: {
    Restricted: 1,
    Available: 2,
  },
  getStatusAsync: vi.fn(),
  unregisterTaskAsync: vi.fn(),
}));

vi.mock("expo-task-manager", () => ({
  defineTask: defineTaskMock,
  isTaskRegisteredAsync: isTaskRegisteredAsyncMock,
}));

vi.mock("expo-constants", () => ({
  default: {
    isDevice: true,
  },
}));

vi.mock("../../db/backup", () => ({
  createBackup: createBackupMock,
  isBackupNeeded: isBackupNeededMock,
  cleanupOldBackups: cleanupOldBackupsMock,
}));

import {
  BACKGROUND_BACKUP_TASK,
  registerBackgroundBackupTask,
  runBackgroundBackupTask,
} from "../../db/backgroundBackup";

// Capture the module-load-time defineTask calls before setup.ts's
// vi.clearAllMocks() wipes them in beforeEach.
const moduleLoadDefineTaskCalls = defineTaskMock.mock.calls.slice();

describe("runBackgroundBackupTask", () => {
  beforeEach(() => {
    createBackupMock.mockReset();
    isBackupNeededMock.mockReset();
    cleanupOldBackupsMock.mockReset();
    isTaskRegisteredAsyncMock.mockReset();
    registerTaskAsyncMock.mockReset();
  });

  test("returns Success and skips backup when isBackupNeeded is false (throttled)", async () => {
    isBackupNeededMock.mockResolvedValue(false);

    const result = await runBackgroundBackupTask();

    expect(result).toBe(1);
    expect(createBackupMock).not.toHaveBeenCalled();
    expect(cleanupOldBackupsMock).not.toHaveBeenCalled();
  });

  test("returns Success and delegates cleanup to createBackup when it succeeds", async () => {
    isBackupNeededMock.mockResolvedValue(true);
    createBackupMock.mockResolvedValue({ success: true });

    const result = await runBackgroundBackupTask();

    expect(result).toBe(1);
    expect(createBackupMock).toHaveBeenCalledOnce();
    // The worker does not call cleanupOldBackups directly — createBackup runs
    // it internally on success, so the worker stays a single coherent step.
    expect(cleanupOldBackupsMock).not.toHaveBeenCalled();
  });

  test("returns Failed when createBackup fails", async () => {
    isBackupNeededMock.mockResolvedValue(true);
    createBackupMock.mockResolvedValue({ success: false, error: "disk full" });

    const result = await runBackgroundBackupTask();

    expect(result).toBe(2);
    expect(cleanupOldBackupsMock).not.toHaveBeenCalled();
  });

  test("returns Failed when an unexpected error throws", async () => {
    isBackupNeededMock.mockRejectedValue(new Error("boom"));

    const result = await runBackgroundBackupTask();

    expect(result).toBe(2);
  });
});

describe("TaskManager.defineTask registration", () => {
  test("module registers BACKGROUND_BACKUP_TASK with runBackgroundBackupTask", () => {
    expect(moduleLoadDefineTaskCalls).toContainEqual([
      BACKGROUND_BACKUP_TASK,
      runBackgroundBackupTask,
    ]);
  });
});

describe("registerBackgroundBackupTask", () => {
  beforeEach(() => {
    isTaskRegisteredAsyncMock.mockReset();
    registerTaskAsyncMock.mockReset();
  });

  test("registers the task when not already registered", async () => {
    isTaskRegisteredAsyncMock.mockResolvedValue(false);
    registerTaskAsyncMock.mockResolvedValue(undefined);

    await registerBackgroundBackupTask();

    expect(registerTaskAsyncMock).toHaveBeenCalledWith(
      BACKGROUND_BACKUP_TASK,
      expect.objectContaining({ minimumInterval: expect.any(Number) })
    );
  });

  test("does not re-register when the task is already registered", async () => {
    isTaskRegisteredAsyncMock.mockResolvedValue(true);

    await registerBackgroundBackupTask();

    expect(registerTaskAsyncMock).not.toHaveBeenCalled();
  });

  test("swallows registration errors so app boot keeps running", async () => {
    isTaskRegisteredAsyncMock.mockResolvedValue(false);
    registerTaskAsyncMock.mockRejectedValue(new Error("native module missing"));

    await expect(registerBackgroundBackupTask()).resolves.toBeUndefined();
  });
});

describe("registerBackgroundBackupTask iOS simulator skip", () => {
  beforeEach(() => {
    vi.resetModules();
    isTaskRegisteredAsyncMock.mockReset();
    registerTaskAsyncMock.mockReset();
  });

  test("logs and skips registration on iOS simulator", async () => {
    vi.doMock("expo-constants", () => ({ default: { isDevice: false } }));
    vi.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { registerBackgroundBackupTask: registerOnSimulator } = await import(
      "../../db/backgroundBackup"
    );
    await registerOnSimulator();

    const skipLogCall = logSpy.mock.calls.find((call) =>
      String(call[0]).includes("Skipping background task registration on iOS simulator")
    );
    expect(skipLogCall).toBeDefined();
    expect(isTaskRegisteredAsyncMock).not.toHaveBeenCalled();
    expect(registerTaskAsyncMock).not.toHaveBeenCalled();

    logSpy.mockRestore();
    vi.doUnmock("expo-constants");
    vi.doUnmock("react-native");
  });
});
