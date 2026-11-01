import assert from "node:assert/strict"
import { test } from "node:test"
import { StreamEventSchema } from "./events.ts"

test("accepts each event kind", () => {
    const ok = [
        { event: "meta", data: { requestId: "r", conversationId: "c" } },
        { event: "tool", data: { phase: "start", name: "n", label: "l" } },
        { event: "token", data: { text: "oi" } },
        { event: "done", data: { requestId: "r", conversationId: "c", model: "m", durationMs: 1, partial: false } },
        { event: "error", data: { requestId: "r", code: "timeout", message: "x" } },
    ]
    for (const e of ok) assert.ok(StreamEventSchema.safeParse(e).success, e.event)
})

test("rejects unknown event and unknown error code", () => {
    assert.ok(!StreamEventSchema.safeParse({ event: "x", data: {} }).success)
    assert.ok(!StreamEventSchema.safeParse({ event: "error", data: { requestId: "r", code: "boom", message: "x" } }).success)
})

const U = "11111111-1111-4111-8111-111111111111"
const chart = { id: U, type: "bar", title: "t", valueKind: "integer", categories: ["a"], series: [{ name: "s", values: [1] }], summary: "r", resultId: U, partial: false }
const file = { id: U, conversationId: U, resultId: U, name: "a.pdf", format: "pdf", mime: "application/pdf", sizeBytes: 1, rowCount: 1, includesChart: false, containsFullPersonalData: false, createdAt: "x", expiresAt: "y", downloadPath: "/p" }

test("result, chart and file events validate; broken ones do not", () => {
    assert.ok(StreamEventSchema.safeParse({ event: "result", data: { resultId: U, label: "l", rows: 2, totalRows: 5, capped: true, expiresAt: "x" } }).success)
    assert.ok(!StreamEventSchema.safeParse({ event: "result", data: { resultId: U, label: "l", rows: 0, totalRows: 0, capped: false, expiresAt: "x" } }).success)
    assert.ok(!StreamEventSchema.safeParse({ event: "result", data: { resultId: U, label: "l", rows: 3, totalRows: 2, capped: false, expiresAt: "x" } }).success)
    assert.ok(StreamEventSchema.safeParse({ event: "chart", data: { chart } }).success)
    assert.ok(!StreamEventSchema.safeParse({ event: "chart", data: { chart: { ...chart, series: [] } } }).success)
    assert.ok(StreamEventSchema.safeParse({ event: "file", data: { file } }).success)
})
