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

import { ChartNotFoundError, ExportBusyError, ExportTimeoutError, ExportTooLargeError, FileNotFoundError, NothingToExportError, ResultNotFoundError } from "../domain/errors.ts"

test("export errors map to status and code without internal details", () => {
    const m = (e: Error) => { const r = toHttpError(e, "r"); return [r.status, r.body.error] }
    assert.deepEqual(m(new ResultNotFoundError()), [404, "result_not_found"])
    assert.deepEqual(m(new ChartNotFoundError()), [404, "chart_not_found"])
    assert.deepEqual(m(new FileNotFoundError()), [404, "file_not_found"])
    assert.deepEqual(m(new ExportTooLargeError(9, 5)), [413, "export_too_large"])
    assert.deepEqual(m(new NothingToExportError()), [422, "nothing_to_export"])
    assert.deepEqual(m(new ExportBusyError(3)), [429, "export_busy"])
    assert.deepEqual(m(new ExportTimeoutError()), [504, "export_timeout"])
    assert.equal(toHttpError(new ExportBusyError(3), "r").body.retryAfterSeconds, 3)
    assert.deepEqual(toHttpError(new ResultNotFoundError(), "r").body, toHttpError(new ResultNotFoundError(), "r").body)
})
