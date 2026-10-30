import assert from "node:assert/strict"
import { test } from "node:test"
import { createConversationLock } from "./conversation-lock.ts"

test("serialises same key in FIFO order and runs different keys in parallel", async () => {
    const lock = createConversationLock()
    const order: string[] = []
    const run = async (key: string, name: string, ms: number) => {
        const release = await lock.acquire(key)
        order.push(`start ${name}`)
        await new Promise((r) => setTimeout(r, ms))
        order.push(`end ${name}`)
        release()
    }
    await Promise.all([run("a", "1", 20), run("a", "2", 1), run("b", "3", 1)])
    assert.ok(order.indexOf("end 1") < order.indexOf("start 2"))
    assert.ok(order.indexOf("start 3") < order.indexOf("end 1"))
})

test("releases even if the work throws", async () => {
    const lock = createConversationLock()
    await assert.rejects(async () => { const r = await lock.acquire("k"); try { throw new Error("x") } finally { r() } })
    const r2 = await Promise.race([lock.acquire("k"), new Promise((res) => setTimeout(() => res("stuck"), 100))])
    assert.notEqual(r2, "stuck")
})
