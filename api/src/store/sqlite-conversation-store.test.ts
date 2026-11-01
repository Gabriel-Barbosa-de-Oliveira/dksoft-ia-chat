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

const CH = (id: string) => ({ id, type: "bar" as const, title: "t", valueKind: "integer" as const, categories: ["a"], series: [{ name: "s", values: [1] }], summary: "r", resultId: id, partial: false })
const U1 = "11111111-1111-4111-8111-111111111111"
const U2 = "22222222-2222-4222-8222-222222222222"

test("charts are stored only on the assistant row, in order, and history for the agent stays text only", () => {
    const db = openDatabase(":memory:")
    const store = createSqliteConversationStore(db)
    const id = store.create()
    store.appendPair(id, "oi", "resposta", { charts: [CH(U1), CH(U2)] })
    store.appendPair(id, "outra", "sem grafico")
    const msgs = store.listMessages(id)
    assert.equal(msgs[0]!.charts, undefined)
    assert.deepEqual(msgs[1]!.charts?.map((c) => c.id), [U1, U2])
    assert.equal(msgs[3]!.charts, undefined)
    assert.deepEqual(store.lastMessages(id, 10).map((m) => Object.keys(m).sort()), Array(4).fill(["content", "role"]))
})
test("corrupted artifacts JSON is ignored without losing the text", () => {
    const db = openDatabase(":memory:")
    const store = createSqliteConversationStore(db)
    const id = store.create()
    store.appendPair(id, "oi", "resposta", { charts: [CH(U1)] })
    db.prepare("UPDATE messages SET artifacts = '{not json' WHERE role = 'assistant'").run()
    assert.equal(store.listMessages(id)[1]!.charts, undefined)
    assert.equal(store.listMessages(id)[1]!.content, "resposta")
    db.prepare("UPDATE messages SET artifacts = '{\"charts\":[{\"x\":1}]}' WHERE role = 'assistant'").run()
    assert.equal(store.listMessages(id)[1]!.charts, undefined)
})
