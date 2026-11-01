import assert from "node:assert/strict"
import { test } from "node:test"
import { openDatabase } from "./db.ts"

test("creates tables and enforces CHECKs", () => {
    const db = openDatabase(":memory:")
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name)
    for (const t of ["conversations", "messages", "runs"]) assert.ok(tables.includes(t), t)
    db.prepare("INSERT INTO conversations VALUES ('c','t','t')").run()
    assert.throws(() => db.prepare("INSERT INTO messages (conversation_id,role,content,created_at) VALUES ('c','tool','x','t')").run())
    assert.throws(() => db.prepare("INSERT INTO runs VALUES ('r',NULL,'t',1,'weird',NULL,0,NULL)").run())
    assert.throws(() => db.prepare("INSERT INTO messages (conversation_id,role,content,created_at) VALUES ('nope','user','x','t')").run())
})

import { DatabaseSync } from "node:sqlite"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("messages.artifacts and export_runs exist; migration upgrades an old database without losing rows", () => {
    const fresh = openDatabase(":memory:")
    assert.ok((fresh.prepare("PRAGMA table_info(messages)").all() as { name: string }[]).some((c) => c.name === "artifacts"))
    assert.ok(fresh.prepare("SELECT name FROM sqlite_master WHERE name = 'export_runs'").get())
    const dir = mkdtempSync(join(tmpdir(), "dk-"))
    const path = join(dir, "old.db")
    const old = new DatabaseSync(path)
    old.exec("CREATE TABLE conversations (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL); INSERT INTO conversations VALUES ('c','a','a'); INSERT INTO messages (conversation_id, role, content, created_at) VALUES ('c','user','oi','a');")
    old.close()
    const upgraded = openDatabase(path)
    assert.equal((upgraded.prepare("SELECT count(*) AS n FROM messages").get() as { n: number }).n, 1)
    upgraded.close()
    const again = openDatabase(path) // idempotent
    assert.ok((again.prepare("PRAGMA table_info(messages)").all() as { name: string }[]).some((c) => c.name === "artifacts"))
    again.close()
})
