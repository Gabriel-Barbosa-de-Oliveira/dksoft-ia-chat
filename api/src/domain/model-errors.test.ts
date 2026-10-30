import assert from "node:assert/strict"
import { test } from "node:test"
import { ChatTimeoutError, ModelUnavailableError, ToolsUnavailableError } from "./errors.ts"
import { classifyAgentError, isTransientModelError } from "./model-errors.ts"

test("transient vs permanent", () => {
    for (const s of [408, 429, 500, 503]) assert.ok(isTransientModelError({ status: s }), String(s))
    for (const s of [400, 401, 403, 404]) assert.ok(!isTransientModelError({ status: s }), String(s))
    assert.ok(isTransientModelError({ code: "ECONNRESET" }))
    assert.ok(isTransientModelError({ cause: { code: "ETIMEDOUT" } }))
    assert.ok(!isTransientModelError(new Error("x")))
    assert.ok(!isTransientModelError(null))
})

test("classifyAgentError with real-shaped errors", () => {
    assert.ok(classifyAgentError(Object.assign(new Error("503 provider"), { status: 503 })) instanceof ModelUnavailableError)
    assert.ok(classifyAgentError(Object.assign(new Error("401"), { status: 401 })) instanceof ModelUnavailableError)
    assert.ok(classifyAgentError(Object.assign(new Error("HTTP 429"), { name: "ToolException" })) instanceof ToolsUnavailableError)
    assert.ok(classifyAgentError(Object.assign(new Error("t"), { name: "TimeoutError" })) instanceof ChatTimeoutError)
    const wrapped = Object.assign(new Error("wrapper"), { cause: Object.assign(new Error("503"), { status: 503 }) })
    assert.ok(classifyAgentError(wrapped) instanceof ModelUnavailableError)
    assert.ok(classifyAgentError(new Error("Connection error.")) instanceof ModelUnavailableError)
    assert.ok(isTransientModelError(new Error("Connection error.")))
    const abort = Object.assign(new Error("a"), { name: "AbortError" })
    assert.equal(classifyAgentError(abort), abort)
    const plain = new Error("bug")
    assert.equal(classifyAgentError(plain), plain)
})
