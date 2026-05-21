import { vi } from "vitest";

vi.mock("../../db/client", () => ({
  getDb: vi.fn(),
}));

import { backfillMoodScaleJson } from "../../db/moods/migrations";
import {
  CURRENT_MOOD_SCALE_SNAPSHOT,
  serializeMoodScale,
} from "../../db/moods/serialization";

type FixtureRow = {
  id: number;
  mood_scale_json: string | null;
};

function createFixtureDb(initial: FixtureRow[]) {
  const rows: FixtureRow[] = initial.map((r) => ({ ...r }));
  const runAsync = vi.fn(async (sql: string, ...params: unknown[]) => {
    if (
      sql.includes("UPDATE moods SET mood_scale_json") &&
      sql.includes("IS NULL OR mood_scale_json = ''")
    ) {
      const value = params[0] as string;
      let changes = 0;
      for (const row of rows) {
        if (row.mood_scale_json === null || row.mood_scale_json === "") {
          row.mood_scale_json = value;
          changes++;
        }
      }
      return { changes, lastInsertRowId: 0 };
    }
    return { changes: 0, lastInsertRowId: 0 };
  });

  return {
    runAsync,
    rows,
  };
}

describe("backfillMoodScaleJson", () => {
  it("sets the current scale on rows with NULL mood_scale_json", async () => {
    const fixture = createFixtureDb([
      { id: 1, mood_scale_json: null },
      { id: 2, mood_scale_json: null },
    ]);

    const result = await backfillMoodScaleJson(fixture as never);

    const expected = serializeMoodScale(CURRENT_MOOD_SCALE_SNAPSHOT);
    expect(result.backfilled).toBe(2);
    expect(fixture.rows.map((r) => r.mood_scale_json)).toEqual([
      expected,
      expected,
    ]);
  });

  it("leaves already-set rows untouched", async () => {
    const preset = JSON.stringify({
      version: 1,
      min: 0,
      max: 5,
      lowerIsBetter: false,
    });
    const fixture = createFixtureDb([
      { id: 1, mood_scale_json: preset },
      { id: 2, mood_scale_json: null },
    ]);

    const result = await backfillMoodScaleJson(fixture as never);

    expect(result.backfilled).toBe(1);
    expect(fixture.rows[0].mood_scale_json).toBe(preset);
    expect(fixture.rows[1].mood_scale_json).toBe(
      serializeMoodScale(CURRENT_MOOD_SCALE_SNAPSHOT)
    );
  });

  it("is a no-op when every row already has a scale", async () => {
    const preset = serializeMoodScale(CURRENT_MOOD_SCALE_SNAPSHOT);
    const fixture = createFixtureDb([
      { id: 1, mood_scale_json: preset },
      { id: 2, mood_scale_json: preset },
    ]);

    const result = await backfillMoodScaleJson(fixture as never);

    expect(result.backfilled).toBe(0);
    expect(fixture.rows.every((r) => r.mood_scale_json === preset)).toBe(true);
  });

  it("treats empty-string mood_scale_json the same as NULL", async () => {
    const fixture = createFixtureDb([{ id: 1, mood_scale_json: "" }]);

    const result = await backfillMoodScaleJson(fixture as never);

    expect(result.backfilled).toBe(1);
    expect(fixture.rows[0].mood_scale_json).toBe(
      serializeMoodScale(CURRENT_MOOD_SCALE_SNAPSHOT)
    );
  });
});
