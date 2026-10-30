import assert from "node:assert/strict"
import { test } from "node:test"
import { createApp } from "./app.ts"

test("GET /health is public and minimal", async () => {
    const app = await createApp({ logger: false })
    const res = await app.inject({ method: "GET", url: "/health" })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), { status: "ok" })
    await app.close()
})

test("generates its own X-Request-Id and ignores the client's", async () => {
    const app = await createApp({ logger: false })
    const res = await app.inject({ method: "GET", url: "/health", headers: { "x-request-id": "evil" } })
    assert.notEqual(res.headers["x-request-id"], "evil")
    assert.match(String(res.headers["x-request-id"]), /^[0-9a-f-]{36}$/)
    await app.close()
})

test("unknown route returns JSON 404 with requestId", async () => {
    const app = await createApp({ logger: false })
    const res = await app.inject({ method: "GET", url: "/nope" })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().requestId, res.headers["x-request-id"])
    await app.close()
})

test("rate limit on POST /chat → 429 with retryAfterSeconds, after auth", async () => {
    const { buildTestApp, auth } = await import("./test-app.ts")
    const t = await buildTestApp({ rateLimit: 2 })
    const call = (headers: Record<string, string>) => t.app.inject({ method: "POST", url: "/chat", headers, payload: { message: "oi" } })
    assert.equal((await call(auth)).statusCode, 200)
    assert.equal((await call(auth)).statusCode, 200)
    const limited = await call(auth)
    assert.equal(limited.statusCode, 429)
    assert.equal(limited.json().error, "rate_limited")
    assert.ok(limited.json().retryAfterSeconds >= 1)
    assert.equal((await t.app.inject({ method: "GET", url: "/health" })).statusCode, 200)
    await t.app.close()
})

test("hook order: preflight needs no Authorization; wrong key is 401 before rate limit", async () => {
    const { buildTestApp, ORIGIN } = await import("./test-app.ts")
    const t = await buildTestApp({ rateLimit: 1 })
    const pre = await t.app.inject({ method: "OPTIONS", url: "/chat", headers: { origin: ORIGIN, "access-control-request-method": "POST" } })
    assert.equal(pre.statusCode, 204)
    for (let i = 0; i < 3; i++) {
        const r = await t.app.inject({ method: "POST", url: "/chat", headers: { authorization: "Bearer x" }, payload: { message: "oi" } })
        assert.equal(r.statusCode, 401)
    }
    await t.app.close()
})
