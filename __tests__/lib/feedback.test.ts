import { describe, expect, it } from "vitest";

import { FEEDBACK_ISSUES_URL, getFeedbackIssueUrl } from "../../src/lib/feedback";

describe("feedback issue link", () => {
  it("opens the canonical repository with an editable feedback template", () => {
    const url = new URL(getFeedbackIssueUrl());

    expect(`${url.origin}${url.pathname}`).toBe(FEEDBACK_ISSUES_URL);
    expect(url.searchParams.get("title")).toBe("Feedback: ");
    expect(url.searchParams.get("body")).toContain("What would you like to share?");
    expect(url.searchParams.get("body")).toContain("What would you like to happen?");
  });

  it("warns people not to put private mood data in the issue", () => {
    const url = new URL(getFeedbackIssueUrl());

    expect(url.searchParams.get("body")).toContain(
      "Please do not include private mood entries or other sensitive information."
    );
  });
});
