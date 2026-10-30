import assert from "node:assert/strict"
import { test } from "node:test"
import { bearerToken, verifyAccessKey } from "./auth.ts"
import { buildTestApp, auth, ACCESS_KEY } from "./test-app.ts"

test("verifyAccessKey", () => {
    assert.ok(verifyAccessKey("abc", "abc"))
    assert.ok(!verifyAccessKey("abd", "abc"))
    assert.ok(!verifyAccessKey("", "abc"))
    assert.ok(!verifyAccessKey(undefined, "abc"))
    assert.ok(!verifyAccessKey("a", "abc"))
    assert.equal(bearerToken("Bearer xyz"), "xyz")
    assert.equal(bearerToken("Basic xyz"), undefined)
})

test("missing and wrong key give the same 401 and never reach the agent", async () => {
    let agentCalls = 0
    const { app } = await buildTestApp({ agent: async function* () { agentCalls++; yield { type: "end", model: null, partial: false, toolCalls: 0 } } })
    const post = (headers: Record<string, string>) => app.inject({ method: "POST", url: "/chat", headers, payload: { message: "oi" } })
    const none = await post({})
    const wrong = await post({ authorization: "Bearer errada" })
    assert.equal(none.statusCode, 401)
    assert.equal(wrong.statusCode, 401)
    const strip = (r: { json(): Record<string, unknown> }) => ({ ...r.json(), requestId: "x" })
    assert.deepEqual(strip(none), strip(wrong))
    assert.equal(agentCalls, 0)
    assert.equal((await app.inject({ method: "GET", url: "/conversations" })).statusCode, 401)
    assert.equal((await app.inject({ method: "GET", url: "/health" })).statusCode, 200)
    assert.equal((await app.inject({ method: "GET", url: "/conversations", headers: auth })).statusCode, 200)
    assert.ok(!JSON.stringify(none.json()).includes(ACCESS_KEY))
    await app.close()
})
