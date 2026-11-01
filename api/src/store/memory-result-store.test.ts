import assert from "node:assert/strict"
import { test } from "node:test"
import type { ChartSpec } from "../domain/chart-spec.ts"
import { createMemoryResultStore } from "./memory-result-store.ts"

const base = (conversationId: string, id: string, n = 2) => ({
    id, conversationId, toolName: "dksoft_list_paid_bills", label: "l", filters: {}, rows: Array.from({ length: n }, (_, i) => ({ i })), totalRows: n,
})
const chart = (id: string, resultId: string): ChartSpec => ({ id, type: "bar", title: "t", valueKind: "integer", categories: ["a"], series: [{ name: "s", values: [1] }], summary: "r", resultId, partial: false })
function make(over: Partial<Parameters<typeof createMemoryResultStore>[0]> = {}) {
    const clock = { t: 1_000_000 }
    const store = createMemoryResultStore({ ttlMs: 1000, maxRows: 100, maxBytes: 1e9, now: () => clock.t, ...over })
    return { store, clock }
}

test("saves and gets by conversation; another conversation sees nothing", () => {
    const { store } = make()
    store.save(base("c1", "r1"))
    assert.equal(store.get("c1", "r1")?.rows.length, 2)
    assert.equal(store.get("c2", "r1"), undefined)
    assert.equal(store.latest("c2"), undefined)
})
test("expires by ttl on access and on sweep", () => {
    const { store, clock } = make()
    store.save(base("c1", "r1"))
    clock.t += 999
    assert.ok(store.get("c1", "r1"))
    clock.t += 2
    assert.equal(store.get("c1", "r1"), undefined)
    store.sweep()
    assert.equal(store.list("c1").length, 0)
})
test("caps rows and flags capped", () => {
    const { store } = make({ maxRows: 3 })
    const r = store.save(base("c1", "r1", 10))
    assert.equal(r.rows.length, 3)
    assert.equal(r.totalRows, 10)
    assert.equal(r.capped, true)
    assert.equal(store.save(base("c1", "r2", 2)).capped, false)
})
test("latest is the newest; at most 10 per conversation", () => {
    const { store } = make()
    for (let i = 0; i < 12; i++) store.save(base("c1", `r${i}`))
    assert.equal(store.list("c1").length, 10)
    assert.equal(store.latest("c1")?.id, "r11")
    assert.equal(store.get("c1", "r0"), undefined)
})
test("global byte cap drops the oldest", () => {
    const { store } = make({ maxBytes: 600 })
    store.save(base("c1", "r1", 20))
    store.save(base("c2", "r2", 20))
    assert.equal(store.get("c1", "r1"), undefined)
    assert.ok(store.get("c2", "r2"))
})
test("charts live with their result, per conversation", () => {
    const { store, clock } = make()
    store.save(base("c1", "r1"))
    store.addChart("c1", chart("g1", "r1"))
    store.addChart("c1", chart("g2", "r1"))
    assert.equal(store.getChart("c1", "g1")?.id, "g1")
    assert.equal(store.getChart("c2", "g1"), undefined)
    assert.equal(store.latestChart("c1", "r1")?.id, "g2")
    clock.t += 2000
    assert.equal(store.getChart("c1", "g1"), undefined)
})
