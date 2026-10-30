import assert from "node:assert/strict"
import { test } from "node:test"
import { createChatModel } from "./model.ts"

test("OpenRouter options", () => {
    const m = createChatModel("a/b", "k") as unknown as Record<string, unknown>
    assert.equal(m.model, "a/b")
    assert.equal(m.streaming, true)
    assert.equal(m.temperature, 0)
    assert.equal((m.lc_kwargs as Record<string, unknown>).maxRetries, 0)
})
