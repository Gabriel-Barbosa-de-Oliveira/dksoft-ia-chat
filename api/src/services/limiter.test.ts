import assert from "node:assert/strict"
import { test } from "node:test"
import { createLimiter } from "./limiter.ts"

test("never exceeds maxConcurrent and keeps FIFO order", async () => {
    const limiter = createLimiter({ maxConcurrent: 2, perMinute: 1000 })
    let active = 0, peak = 0
    const order: number[] = []
    await Promise.all([1, 2, 3, 4, 5].map((n) => limiter.run(async () => {
        active++; peak = Math.max(peak, active); order.push(n)
        await new Promise((r) => setTimeout(r, 10))
        active--
    })))
    assert.equal(peak, 2)
    assert.deepEqual(order, [1, 2, 3, 4, 5])
})

test("sliding per-minute window waits with the injected clock", async () => {
    let t = 0
    const sleeps: number[] = []
    const limiter = createLimiter({ maxConcurrent: 5, perMinute: 2, now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms } })
    const times: number[] = []
    for (let i = 0; i < 4; i++) await limiter.run(async () => { times.push(t) })
    assert.deepEqual(times, [0, 0, 60000, 60000])
    assert.deepEqual(sleeps, [60000])
})

test("releases the slot when the function throws", async () => {
    const limiter = createLimiter({ maxConcurrent: 1, perMinute: 100 })
    await assert.rejects(limiter.run(async () => { throw new Error("x") }))
    assert.equal(await limiter.run(async () => "ok"), "ok")
})
