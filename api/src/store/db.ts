import { chmodSync, existsSync, mkdirSync, closeSync, openSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);
CREATE TABLE IF NOT EXISTS runs (
  request_id TEXT PRIMARY KEY,
  conversation_id TEXT,
  started_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('ok','error','timeout','aborted')),
  model_used TEXT,
  tool_calls INTEGER NOT NULL,
  error_type TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at);
`

export function openDatabase(path: string): DatabaseSync {
    if (path !== ":memory:") {
        mkdirSync(dirname(path), { recursive: true })
        if (!existsSync(path)) closeSync(openSync(path, "a", 0o600))
        else chmodSync(path, 0o600)
    }
    const db = new DatabaseSync(path)
    db.exec("PRAGMA foreign_keys = ON")
    if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL")
    db.exec(SCHEMA)
    return db
}
