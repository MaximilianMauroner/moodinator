import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initialURL: vi.fn(), parse: vi.fn(), suite: vi.fn(), write: vi.fn(),
}));
vi.mock("react-native", () => ({ View: "View", Text: "Text" }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { qaSourceSha: "qa-source" } } } }));
vi.mock("expo-linking", () => ({ getInitialURL: mocks.initialURL, parse: mocks.parse }));
vi.mock("expo-router/build/qualified-entry", () => ({ App: "RouterApp" }));
vi.mock("@/qa/encryption/proof", () => ({
  runEncryptionProof: mocks.suite, writeEncryptionProofStatus: mocks.write,
  crashEncryptionProof: vi.fn(), loseProofKey: vi.fn(), prepareAppUpgrade: vi.fn(),
  prepareWalCrash: vi.fn(), resumeEncryptionProof: vi.fn(), verifyAppUpgrade: vi.fn(),
  verifyLostProofKey: vi.fn(),
}));

let Entry: typeof import("@/qa/encryption/Entry").default;
let renderers: ReactTestRenderer[];
async function mount() {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<Entry />); });
  renderers.push(renderer);
  return renderer;
}
const progress = (renderer: ReactTestRenderer) => renderer.root.findByProps({ testID: "encryption-proof-progress" }).props.children;
const report = (renderer: ReactTestRenderer) => renderer.root.findByProps({ testID: "encryption-proof-result" }).props.children;
const published = () => mocks.write.mock.calls.map(([status]) => status.progress);

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetModules();
  vi.resetAllMocks();
  renderers = [];
  mocks.initialURL.mockResolvedValue("moodinator://qa?proof=suite&runId=one");
  mocks.parse.mockReturnValue({ queryParams: { proof: "suite", runId: "one" } });
  Entry = (await import("@/qa/encryption/Entry")).default;
});
afterEach(async () => { await act(async () => renderers.forEach((renderer) => renderer.unmount())); });

describe("native encryption proof initial execution", () => {
  it("shares fixture work and progress between duplicate mounted roots, then replays success after remount", async () => {
    let finish!: (result: unknown) => void;
    let publish!: (message: string) => void;
    mocks.suite.mockImplementation((callback) => {
      publish = callback;
      return new Promise((resolve) => { finish = resolve; });
    });
    const first = await mount();
    await act(async () => publish("seeded"));
    const second = await mount();
    expect(progress(first)).toBe("seeded");
    expect(progress(second)).toBe("seeded");
    expect(mocks.suite).toHaveBeenCalledOnce();
    expect(mocks.initialURL).toHaveBeenCalledOnce();
    await act(async () => first.unmount());
    const remounted = await mount();
    expect(progress(remounted)).toBe("seeded");
    await act(async () => finish({ status: "passed" }));
    expect(progress(second)).toBe("complete");
    expect(report(remounted)).toContain('"status":"passed"');
    const completedReport = report(remounted);
    await act(async () => { second.unmount(); remounted.unmount(); });
    const completed = await mount();
    expect(progress(completed)).toBe("complete");
    expect(report(completed)).toBe(completedReport);
    expect(published()).toEqual(["launch", "seeded", "complete"]);
    expect(mocks.suite).toHaveBeenCalledOnce();
  });

  it("keeps a rejected execution terminal across duplicate roots, late progress and remount", async () => {
    let fail!: (error: Error) => void;
    let publish!: (message: string) => void;
    mocks.suite.mockImplementation((callback) => {
      publish = callback;
      return new Promise((_, reject) => { fail = reject; });
    });
    const first = await mount();
    const second = await mount();
    await act(async () => fail(new Error("fixture failed")));
    const failedReport = report(first);
    await act(async () => { publish("seeded"); publish("complete"); });
    expect(progress(first)).toBe("failed");
    expect(progress(second)).toBe("failed");
    await act(async () => { first.unmount(); second.unmount(); });
    const remounted = await mount();
    expect(progress(remounted)).toBe("failed");
    expect(report(remounted)).toBe(failedReport);
    expect(failedReport).toContain("fixture failed");
    expect(published()).toEqual(["launch", "failed"]);
    expect(mocks.suite).toHaveBeenCalledOnce();
  });

  it("replays the journey app after unmount without rereading the initial URL", async () => {
    mocks.parse.mockReturnValue({ queryParams: { proof: "journey", runId: "journey" } });
    const first = await mount();
    expect(first.root.findByType("RouterApp")).toBeDefined();
    await act(async () => first.unmount());
    const remounted = await mount();
    expect(remounted.root.findByType("RouterApp")).toBeDefined();
    expect(mocks.initialURL).toHaveBeenCalledOnce();
    expect(published()).toEqual(["launch"]);
    expect(mocks.suite).not.toHaveBeenCalled();
  });

  it("shows and replays a failed status even when the QA status file cannot be written", async () => {
    mocks.write.mockImplementation(() => { throw new Error("Invalid package"); });
    const first = await mount();
    expect(progress(first)).toBe("failed");
    expect(report(first)).toContain("Invalid package");
    await act(async () => first.unmount());
    expect(progress(await mount())).toBe("failed");
    expect(mocks.suite).not.toHaveBeenCalled();
    expect(mocks.write).toHaveBeenCalledTimes(2);
  });
});
