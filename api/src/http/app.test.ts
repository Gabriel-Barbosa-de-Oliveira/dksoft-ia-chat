import assert from "node:assert/strict"
import { test } from "node:test"
import { createApp } from "./app.ts"

test("GET /health is public and minimal", async () => {
    const app = createApp({ logger: false })
    const res = await app.inject({ method: "GET", url: "/health" })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json(), { status: "ok" })
    await app.close()
})

test("generates its own X-Request-Id and ignores the client's", async () => {
    const app = createApp({ logger: false })
    const res = await app.inject({ method: "GET", url: "/health", headers: { "x-request-id": "evil" } })
    assert.notEqual(res.headers["x-request-id"], "evil")
    assert.match(String(res.headers["x-request-id"]), /^[0-9a-f-]{36}$/)
    await app.close()
})

test("unknown route returns JSON 404 with requestId", async () => {
    const app = createApp({ logger: false })
    const res = await app.inject({ method: "GET", url: "/nope" })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().requestId, res.headers["x-request-id"])
    await app.close()
})
