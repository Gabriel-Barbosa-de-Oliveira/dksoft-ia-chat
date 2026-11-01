import assert from "node:assert/strict"
import { test } from "node:test"
import { openDatabase } from "../../store/db.ts"
import { createSqliteConversationStore } from "../../store/sqlite-conversation-store.ts"
import { createApp } from "../app.ts"
import { ACCESS_KEY, auth } from "../test-app.ts"

// FR-026 / SC-008: com ARTIFACTS_ENABLED=false a composição não passa `artifacts` ao app e nenhuma rota nova existe
test("sem `artifacts`, POST /exports e o download respondem 404 not_found, mesmo autenticados", async () => {
    const conversations = createSqliteConversationStore(openDatabase(":memory:"))
    const id = conversations.create()
    const app = await createApp({ logger: false, conversations, accessKey: ACCESS_KEY, corsOrigins: [] })
    const post = await app.inject({ method: "POST", url: "/exports", headers: auth, payload: {} as never })
    assert.equal(post.statusCode, 404)
    const get = await app.inject({ method: "GET", url: `/conversations/${id}/exports/11111111-1111-4111-8111-111111111111`, headers: auth })
    assert.equal(get.statusCode, 404)
    assert.equal(post.json().error, "not_found")
    assert.equal(get.json().error, "not_found")
})

test("as rotas antigas continuam respondendo como antes", async () => {
    const conversations = createSqliteConversationStore(openDatabase(":memory:"))
    const id = conversations.create()
    const app = await createApp({ logger: false, conversations, accessKey: ACCESS_KEY, corsOrigins: [] })
    const list = await app.inject({ method: "GET", url: "/conversations", headers: auth })
    assert.equal(list.statusCode, 200)
    const msgs = await app.inject({ method: "GET", url: `/conversations/${id}/messages`, headers: auth })
    assert.equal(msgs.statusCode, 200)
    assert.deepEqual(msgs.json().messages, [])
})
