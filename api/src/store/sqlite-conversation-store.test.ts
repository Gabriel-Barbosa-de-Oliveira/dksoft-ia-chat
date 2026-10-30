import assert from "node:assert/strict"
import { test } from "node:test"
import { openDatabase } from "./db.ts"
import { createSqliteConversationStore } from "./sqlite-conversation-store.ts"

const setup = () => {
    let n = 0
    const db = openDatabase(":memory:")
    return { db, store: createSqliteConversationStore(db, () => new Date(Date.UTC(2026, 0, 1, 0, 0, n++))) }
}

test("keeps message order and returns only the last N", () => {
    const { store } = setup()
    const id = store.create()
    store.appendPair(id, "q1", "a1")
    store.appendPair(id, "q2", "a2")
    assert.deepEqual(store.lastMessages(id, 3).map((m) => m.content), ["a1", "q2", "a2"])
    assert.deepEqual(store.listMessages(id).map((m) => m.content), ["q1", "a1", "q2", "a2"])
})

test("appendPair is atomic", () => {
    const { store, db } = setup()
    assert.throws(() => store.appendPair("missing", "q", "a"))
    assert.equal((db.prepare("SELECT COUNT(*) AS c FROM messages").get() as { c: number }).c, 0)
})

test("conversations are isolated and exists works", () => {
    const { store } = setup()
    const a = store.create(), b = store.create()
    store.appendPair(a, "qa", "aa")
    assert.deepEqual(store.lastMessages(b, 10), [])
    assert.ok(store.exists(a))
    assert.ok(!store.exists("nope"))
})

test("updated_at moves and listing is most recent first", () => {
    const { store } = setup()
    const a = store.create(), b = store.create()
    store.appendPair(a, "q", "a")
    assert.deepEqual(store.listConversations(10, 0).map((c) => c.id), [a, b])
    assert.deepEqual(store.listConversations(1, 1).map((c) => c.id), [b])
})
