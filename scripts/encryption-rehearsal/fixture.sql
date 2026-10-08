-- Fabricated records only. Includes current fields and retained legacy columns.
PRAGMA foreign_keys = ON;
PRAGMA user_version = 7;
PRAGMA application_id = 1297040452;
CREATE TABLE moods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mood INTEGER NOT NULL,
  note TEXT,
  timestamp DATETIME,
  emotions TEXT DEFAULT '[]',
  context_tags TEXT DEFAULT '[]',
  energy INTEGER,
  mood_scale_json TEXT,
  utc_offset_minutes INTEGER,
  based_on_entry_id INTEGER,
  photos_json TEXT,
  location_json TEXT,
  voice_memos_json TEXT
);
CREATE TABLE emotions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
CREATE TABLE mood_emotions (
  mood_id INTEGER NOT NULL REFERENCES moods(id),
  emotion_id INTEGER NOT NULL REFERENCES emotions(id),
  PRIMARY KEY (mood_id, emotion_id)
);
CREATE INDEX idx_moods_timestamp ON moods(timestamp DESC);
CREATE INDEX idx_mood_emotions_mood_id ON mood_emotions(mood_id);
CREATE INDEX idx_mood_emotions_emotion_id ON mood_emotions(emotion_id);
CREATE INDEX idx_emotions_name ON emotions(name);
CREATE TABLE fixture_values (id INTEGER PRIMARY KEY, bytes BLOB, large_integer INTEGER, real_value REAL);
CREATE TABLE fixture_empty (value TEXT);
CREATE VIEW fixture_recent AS SELECT id, mood FROM moods WHERE mood <= 3;
CREATE TABLE fixture_audit (mood_id INTEGER);
CREATE TRIGGER fixture_insert AFTER INSERT ON moods BEGIN
  INSERT INTO fixture_audit VALUES (new.id);
END;
INSERT INTO emotions (name) VALUES ('Calm'), ('Tired');
INSERT INTO moods (id, mood, note, timestamp, emotions, context_tags, energy,
  mood_scale_json, utc_offset_minutes, based_on_entry_id, photos_json)
VALUES
  (1, 0, 'Fabricated: best', '2026-01-01T09:00:00.000Z', '["Calm"]', '["Outside"]', 10,
    '{"lowerIsBetter":true}', 60, NULL, '[]'),
  (2, 10, 'Fabricated: worst; quote '' and Unicode ä', '2026-01-02T23:59:00.000Z', '[]', '[]', 0,
    '{"lowerIsBetter":true}', -300, 1, '[]'),
  (3, 5, NULL, NULL, '["Tired"]', NULL, NULL, NULL, NULL, NULL, NULL),
  (4, 10, 'Fabricated legacy scale', '2025-01-01T12:00:00.000Z', '[]', '[]', 5,
    '{"lowerIsBetter":false}', NULL, NULL, '[]');
INSERT INTO mood_emotions VALUES (1, 1), (3, 2);
INSERT INTO fixture_values VALUES (1, x'0001ff80', 9007199254740993, 0.125);
INSERT INTO moods (mood, note) VALUES (5, 'Fabricated NUL: ' || char(0) || 'suffix');
-- Preserve an AUTOINCREMENT sequence which is greater than the current max ID.
INSERT INTO moods (id, mood) VALUES (99, 5);
DELETE FROM moods WHERE id = 99;
DELETE FROM fixture_audit WHERE mood_id = 99;
