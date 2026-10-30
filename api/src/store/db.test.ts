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
