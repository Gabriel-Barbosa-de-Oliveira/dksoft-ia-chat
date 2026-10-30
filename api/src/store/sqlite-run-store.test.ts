import assert from "node:assert/strict"
import { test } from "node:test"
import { openDatabase } from "./db.ts"
import { createSqliteRunStore } from "./sqlite-run-store.ts"

test("saves a run, masks error_type and has no question text column", () => {
    const db = openDatabase(":memory:")
    createSqliteRunStore(db).save({
        requestId: "r1", conversationId: null, startedAt: "t", durationMs: 12.4, outcome: "error",
        modelUsed: null, toolCalls: 2, errorType: "Failed /alunos/cpf/12345678909",
    })
    const row = db.prepare("SELECT * FROM runs").get() as Record<string, unknown>
    assert.equal(row.duration_ms, 12)
    assert.ok(!String(row.error_type).includes("12345678909"))
    assert.ok(!("message" in row) && !("question" in row))
})
