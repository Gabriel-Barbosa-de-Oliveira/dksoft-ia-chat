import assert from "node:assert/strict"
import { test } from "node:test"
import { formatSseEvent } from "./sse.ts"

test("formats frame with trailing blank line", () => {
    assert.equal(formatSseEvent({ event: "token", data: { text: "oi\nmundo" } }), 'event: token\ndata: {"text":"oi\\nmundo"}\n\n')
})
