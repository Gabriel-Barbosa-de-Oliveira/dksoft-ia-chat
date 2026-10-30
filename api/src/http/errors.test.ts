import assert from "node:assert/strict"
import { test } from "node:test"
import { z } from "zod"
import {
    ChatTimeoutError, ConversationNotFoundError, ModelUnavailableError, OriginNotAllowedError,
    ToolsUnavailableError, UnauthorizedError,
} from "../domain/errors.ts"
import { toHttpError, toStreamError } from "./errors.ts"

test("maps domain errors to HTTP status", () => {
    const s = (e: unknown) => toHttpError(e, "r")
    assert.equal(s(new UnauthorizedError()).status, 401)
    assert.equal(s(new OriginNotAllowedError()).status, 403)
    assert.deepEqual(s(new ConversationNotFoundError("c")).body, { requestId: "r", error: "conversation_not_found", conversationId: "c" })
    assert.equal(s(new Error("boom")).status, 500)
    assert.equal(s(Object.assign(new Error("x"), { statusCode: 429 })).status, 429)
    const zerr = z.object({ a: z.string() }).safeParse({}).error!
    assert.equal(s(zerr).status, 400)
    assert.equal(s(zerr).body.error, "invalid_body")
})

test("500 never leaks the original message", () => {
    assert.ok(!JSON.stringify(toHttpError(new Error("token=abc"), "r").body).includes("abc"))
})

test("toStreamError codes and human messages", () => {
    assert.equal(toStreamError(new ChatTimeoutError()).code, "timeout")
    assert.equal(toStreamError(new ModelUnavailableError({ cause: new Error("raw provider text") })).code, "model_unavailable")
    assert.equal(toStreamError(new ToolsUnavailableError()).code, "tools_unavailable")
    const other = toStreamError(new Error("stack secret"))
    assert.equal(other.code, "internal_error")
    assert.ok(!other.message.includes("secret"))
})
