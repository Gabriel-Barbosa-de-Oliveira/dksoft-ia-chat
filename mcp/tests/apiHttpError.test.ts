import assert from "node:assert/strict"
import { test } from "node:test"
import { z } from "zod"
import { ApiHttpError, assertOk, parseResponse } from "../src/infrastructure/apiHttpError.ts"

const res = (status: number, body: string, headers: Record<string, string> = {}) => new Response(body, { status, headers })

test("200 passes", async () => {
    await assertOk(res(200, "{}"))
})

test("401 uses the mensagem field", async () => {
    await assert.rejects(assertOk(res(401, '{"status":"erro","mensagem":"token invalido"}')), (e: ApiHttpError) => {
        assert.equal(e.status, 401)
        assert.equal(e.message, "HTTP 401: token invalido")
        return true
    })
})

test("429 with Retry-After", async () => {
    await assert.rejects(assertOk(res(429, '{"mensagem":"usage limit exceeded"}', { "Retry-After": "7" })), (e: ApiHttpError) => {
        assert.equal(e.message, "HTTP 429: usage limit exceeded (Retry-After: 7s)")
        assert.equal(e.retryAfterSeconds, 7)
        return true
    })
})

test("429 without Retry-After", async () => {
    await assert.rejects(assertOk(res(429, '{"mensagem":"x"}')), (e: ApiHttpError) => {
        assert.equal(e.retryAfterSeconds, undefined)
        assert.equal(e.message, "HTTP 429: x")
        return true
    })
})

test("500 with non-JSON body is truncated", async () => {
    await assert.rejects(assertOk(res(500, "<html>" + "a".repeat(500))), (e: ApiHttpError) => {
        assert.equal(e.status, 500)
        assert.ok(e.message.length < 260)
        return true
    })
})

test("parseResponse names the failing field and hides the body", () => {
    const schema = z.object({ total: z.number() })
    assert.deepEqual(parseResponse(schema, { total: 1 }), { total: 1 })
    assert.throws(() => parseResponse(schema, { total: "secret-cpf" }), (e: Error) => {
        assert.match(e.message, /Unexpected response shape from DKSOFT API: total/)
        assert.ok(!e.message.includes("secret-cpf"))
        return true
    })
})
