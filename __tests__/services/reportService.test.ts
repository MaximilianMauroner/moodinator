import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => { process.env.EXPO_PUBLIC_REPORTS_ORIGIN = "https://reports.test"; });
const device = vi.hoisted(() => ({
  Platform: { OS: "ios", Version: "26.1" as string | number, constants: {} as Record<string, unknown> },
}));
vi.mock("react-native", () => device);
vi.mock("expo-application", () => ({
  nativeApplicationVersion: "0.1.5",
  nativeBuildVersion: "40",
  applicationId: "com.lab4code.moodinator",
  getAndroidId: () => "android-id",
  getIosIdForVendorAsync: async () => "vendor-id",
}));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "0.0.0" }, sessionId: "session-id", installationId: "install-id", deviceName: "Max's iPhone" },
}));

import type { ReportDraft } from "@/services/reportService";
import { sendReport } from "@/services/reportService";

const fetchMock = vi.fn<typeof fetch>();
const draft = (change: Partial<ReportDraft> = {}): ReportDraft => ({
  kind: "bug", message: "  The calendar skips a day.  ", details: "", contactEmail: "", ...change,
});
const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });
const sent = () => {
  const [url, init] = fetchMock.mock.calls[0];
  return { url, init, body: JSON.parse(String(init?.body)) };
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  device.Platform = { OS: "ios", Version: "26.1", constants: {} };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("problem report request", () => {
  it("posts JSON with cookies and credentials left out to the configured origin", async () => {
    fetchMock.mockResolvedValue(reply(201, { ok: true }));
    expect(await sendReport!(draft())).toEqual({ kind: "sent" });
    const { url, init } = sent();
    expect(url).toBe("https://reports.test/api/reports");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(init?.credentials).toBe("omit");
  });

  it("sends only the typed text, the app version and build, and the system version", async () => {
    fetchMock.mockResolvedValue(reply(201, { ok: true }));
    await sendReport!(draft({ kind: "feature", message: " Weekly mood summary. ", details: "\n Easier reviews. ", contactEmail: " me@example.com " }));
    expect(sent().body).toEqual({
      app: "moodinator",
      kind: "feature",
      message: "Weekly mood summary.",
      details: "Easier reviews.",
      page: "/settings/report",
      context: "Moodinator 0.1.5 (40) · ios 26.1",
      contactEmail: "me@example.com",
    });
  });

  it("names the Android system without a device identifier", async () => {
    device.Platform = { OS: "android", Version: 35, constants: { Release: "15", Serial: "device-serial", Fingerprint: "fingerprint" } };
    fetchMock.mockResolvedValue(reply(201, { ok: true }));
    await sendReport!(draft());
    const raw = String(sent().init?.body);
    expect(sent().body.context).toBe("Moodinator 0.1.5 (40) · android 15");
    for (const secret of ["device-serial", "fingerprint", "android-id", "vendor-id", "session-id", "install-id", "iPhone", "com.lab4code"]) {
      expect(raw).not.toContain(secret);
    }
  });

  it("omits empty optional fields", async () => {
    fetchMock.mockResolvedValue(reply(201, { ok: true }));
    await sendReport!(draft({ details: "   ", contactEmail: " " }));
    expect(Object.keys(sent().body).sort()).toEqual(["app", "context", "kind", "message", "page"]);
  });
});

describe("problem report outcome", () => {
  it("reports a network failure as offline", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    expect(await sendReport!(draft())).toEqual({ kind: "offline" });
  });

  it("reports the rate limit", async () => {
    fetchMock.mockResolvedValue(reply(429, { error: "rate_limited" }));
    expect(await sendReport!(draft())).toEqual({ kind: "rate-limited" });
  });

  it.each(["unknown_app", "invalid_kind", "empty_message", "message_too_long", "details_too_long", "invalid_email"] as const)(
    "keeps the %s reason code and never the server text",
    async (reason) => {
      fetchMock.mockResolvedValue(reply(400, { error: "invalid_request", reason, message: "English text" }));
      expect(await sendReport!(draft())).toEqual({ kind: "rejected", reason });
    },
  );

  it.each([
    ["a rejection with a reason this version does not know", reply(400, { error: "invalid_request", reason: "something_new" })],
    ["a rejection that is not JSON", new Response("<html>", { status: 400 })],
  ])("reports %s as an unknown rejection", async (_, response) => {
    fetchMock.mockResolvedValue(response);
    expect(await sendReport!(draft())).toEqual({ kind: "rejected", reason: "unknown" });
  });

  it.each([
    ["an empty message", { message: "   " }, "empty_message"],
    ["a message over the limit", { message: "x".repeat(4001) }, "message_too_long"],
    ["details over the limit", { details: "x".repeat(4001) }, "details_too_long"],
    ["an invalid email", { contactEmail: "not-an-email" }, "invalid_email"],
    ["an email over the limit", { contactEmail: `${"x".repeat(309)}@example.com` }, "invalid_email"],
  ] as const)("refuses %s on the phone without sending anything", async (_, change, reason) => {
    expect(await sendReport!(draft(change))).toEqual({ kind: "rejected", reason });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a message at the limit after trimming", async () => {
    fetchMock.mockResolvedValue(reply(201, { ok: true }));
    expect(await sendReport!(draft({ message: ` ${"x".repeat(4000)} ` }))).toEqual({ kind: "sent" });
  });

  it("stops waiting after 15 seconds and says so", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new Error("Aborted")));
    }));
    const pending = sendReport!(draft());
    await vi.advanceTimersByTimeAsync(14_999);
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ kind: "timeout" });
  });
  it("keeps the deadline while it reads a refusal body that never finishes", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: () => new Promise(() => undefined) } as unknown as Response);
    const pending = sendReport!(draft());
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toEqual({ kind: "timeout" });
    vi.useRealTimers();
  });

  it("accepts an email at the inbox limit and refuses one past it", async () => {
    fetchMock.mockResolvedValue(reply(201, { ok: true }));
    const at = `${"a".repeat(308)}@example.com`;
    expect(at.length).toBe(320);
    expect(await sendReport!(draft({ contactEmail: at }))).toEqual({ kind: "sent" });
    expect(await sendReport!(draft({ contactEmail: `a${at}` }))).toEqual({ kind: "rejected", reason: "invalid_email" });
  });


  it.each([
    ["a wrong content type", reply(415, { error: "unsupported" })],
    ["a server error", reply(503)],
  ])("reports %s as a failure", async (_, response) => {
    fetchMock.mockResolvedValue(response);
    expect(await sendReport!(draft())).toEqual({ kind: "failed" });
  });
});
