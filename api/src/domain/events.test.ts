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
