export const FEEDBACK_ISSUES_URL =
  "https://github.com/MaximilianMauroner/moodinator/issues/new";

const FEEDBACK_TITLE = "Feedback: ";
const FEEDBACK_BODY = `## What would you like to share?

<!-- Tell us what is working well or what could be better. -->

## What would you like to happen?

<!-- Describe the change or outcome you would prefer. -->

## Anything else?

<!-- Add context if it helps. Please do not include private mood entries or other sensitive information. -->`;

export function getFeedbackIssueUrl(): string {
  return `${FEEDBACK_ISSUES_URL}?title=${encodeURIComponent(FEEDBACK_TITLE)}&body=${encodeURIComponent(FEEDBACK_BODY)}`;
}
