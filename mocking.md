# Mocking Guide

Prefer real code paths with narrow fake adapters.

## Use Fakes For

- SQLite clients in database behavior tests.
- AsyncStorage in settings and preference tests.
- Platform APIs such as document picking, file access, linking, notifications, and background tasks.

## Avoid

- Mocking service internals when the service is the public interface under test.
- Asserting private helper calls instead of final behavior.
- Building mocks that duplicate production implementation logic.

## Pattern

Use the smallest fake that can observe the behavior:

- Inputs accepted through the public API.
- Stored state after the operation.
- Returned result or user-visible summary.
- No mutation when a workflow is cancelled.
