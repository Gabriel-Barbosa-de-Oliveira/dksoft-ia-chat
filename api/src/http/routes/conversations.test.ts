import assert from "node:assert/strict"
import { test } from "node:test"
import { ACCESS_KEY, auth, buildTestApp } from "../test-app.ts"

test("lists conversations most recent first and validates limits", async () => {
    const t = await buildTestApp()
    const a = t.conversations.create(); const b = t.conversations.create()
    t.conversations.appendPair(a, "q", "r")
    const res = await t.app.inject({ method: "GET", url: "/conversations?limit=1", headers: auth })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json().conversations.map((c: { id: string }) => c.id), [a])
    assert.equal((await t.app.inject({ method: "GET", url: "/conversations?limit=0", headers: auth })).statusCode, 400)
    assert.equal((await t.app.inject({ method: "GET", url: "/conversations?limit=101", headers: auth })).statusCode, 400)
    assert.ok(b)
    await t.app.close()
})

test("messages of a conversation; 404 for unknown or non-UUID", async () => {
    const t = await buildTestApp()
    const id = t.conversations.create()
    t.conversations.appendPair(id, "q", "r")
    const ok = await t.app.inject({ method: "GET", url: `/conversations/${id}/messages`, headers: auth })
    assert.deepEqual(ok.json().messages.map((m: { content: string }) => m.content), ["q", "r"])
    for (const bad of ["nao-uuid", "11111111-1111-4111-8111-111111111111"]) {
        const res = await t.app.inject({ method: "GET", url: `/conversations/${bad}/messages`, headers: auth })
        assert.equal(res.statusCode, 404)
    }
    await t.app.close()
})

import { openDatabase } from "../../store/db.ts"
import { createSqliteConversationStore } from "../../store/sqlite-conversation-store.ts"
import { createApp } from "../app.ts"

test("messages carry `charts` only on the replies that had one", async () => {
    const db = openDatabase(":memory:")
    const conversations = createSqliteConversationStore(db)
    const id = conversations.create()
    const U = "11111111-1111-4111-8111-111111111111"
    conversations.appendPair(id, "com grafico", "ok", { charts: [{ id: U, type: "bar", title: "t", valueKind: "integer", categories: ["a"], series: [{ name: "s", values: [1] }], summary: "r", resultId: U, partial: false }] })
    conversations.appendPair(id, "sem grafico", "ok")
    const app = await createApp({ logger: false, conversations, accessKey: ACCESS_KEY, corsOrigins: [] })
    const msgs = (await app.inject({ method: "GET", url: `/conversations/${id}/messages`, headers: auth })).json().messages
    assert.equal(msgs[1].charts[0].id, U)
    assert.equal("charts" in msgs[0], false)
    assert.equal("charts" in msgs[3], false)
})
