# Testing Guide

Moodinator changes should follow a red-green-refactor loop.

## Principles

- Write one behavior test before each implementation slice.
- Test public interfaces such as services, database modules, and user-facing workflows.
- Avoid tests that depend on private helper names or internal call order unless the behavior is otherwise unobservable.
- Keep the local-only privacy promise visible in tests that touch data import, export, backup, storage, or permissions.

## Workflow

1. Pick one observable behavior.
2. Add or update one focused test that fails for the current implementation.
3. Implement the smallest change that makes the test pass.
4. Refactor only after the test is green.
5. Run the focused test, then the relevant broader check.

## High-Value Coverage

- Mood scale interpretation, especially that lower Mood Ratings are better.
- Mood Entry snapshot behavior for Emotions and Context Tags.
- Data Import replacement confirmation and no-op cancellation.
- Data Export and Backup shape compatibility.
- Service-layer workflows used by UI code.
