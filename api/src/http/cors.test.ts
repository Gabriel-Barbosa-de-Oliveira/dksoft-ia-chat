import assert from "node:assert/strict"
import { test } from "node:test"
import { buildTestApp, ORIGIN } from "./test-app.ts"

test("preflight from an allowed origin → 204 with CORS headers", async () => {
    const { app } = await buildTestApp()
    const res = await app.inject({ method: "OPTIONS", url: "/chat", headers: { origin: ORIGIN, "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" } })
    assert.equal(res.statusCode, 204)
    assert.equal(res.headers["access-control-allow-origin"], ORIGIN)
    await app.close()
})

test("origin outside the list → 403 on preflight and on request", async () => {
    const { app } = await buildTestApp()
    const bad = "http://evil.example"
    const pre = await app.inject({ method: "OPTIONS", url: "/chat", headers: { origin: bad, "access-control-request-method": "POST" } })
    assert.equal(pre.statusCode, 403)
    assert.equal(pre.json().error, "origin_not_allowed")
    const req = await app.inject({ method: "GET", url: "/health", headers: { origin: bad } })
    assert.equal(req.statusCode, 403)
    assert.ok(!req.headers["access-control-allow-origin"])
    await app.close()
})

test("no Origin header passes; 401 still carries CORS headers for an allowed origin", async () => {
    const { app } = await buildTestApp()
    assert.equal((await app.inject({ method: "GET", url: "/health" })).statusCode, 200)
    const res = await app.inject({ method: "GET", url: "/conversations", headers: { origin: ORIGIN } })
    assert.equal(res.statusCode, 401)
    assert.equal(res.headers["access-control-allow-origin"], ORIGIN)
    await app.close()
})
