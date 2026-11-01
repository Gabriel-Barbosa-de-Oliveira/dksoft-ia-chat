import assert from "node:assert/strict"
import { test } from "node:test"
import { openDatabase } from "./db.ts"
import { createSqliteExportRunStore } from "./sqlite-export-run-store.ts"

const run = { requestId: "r", conversationId: "c", kind: "export", detail: "xlsx", origin: "button", rows: 3, durationMs: 12, outcome: "ok", explicitPii: true, createdAt: "2026-10-31T00:00:00.000Z" } as const

test("saves every column and no content columns exist", () => {
    const db = openDatabase(":memory:")
    createSqliteExportRunStore(db).save(run)
    const row = db.prepare("SELECT * FROM export_runs").get() as Record<string, unknown>
    assert.equal(row.explicit_pii, 1)
    assert.equal(row.rows, 3)
    assert.deepEqual(Object.keys(row).sort(), ["conversation_id", "created_at", "detail", "duration_ms", "explicit_pii", "kind", "origin", "outcome", "request_id", "rows"])
})
test("rejects values outside the CHECK constraints", () => {
    const db = openDatabase(":memory:")
    assert.throws(() => createSqliteExportRunStore(db).save({ ...run, outcome: "weird" as never }))
})
