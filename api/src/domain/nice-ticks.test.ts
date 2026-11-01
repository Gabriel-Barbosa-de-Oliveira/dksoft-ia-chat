import assert from "node:assert/strict"
import { test } from "node:test"
import { niceTicks } from "./nice-ticks.ts"

test("0-12300 gets round steps covering the range", () => {
    const t = niceTicks(0, 12300, 5)
    assert.deepEqual(t.ticks, [0, 5000, 10000, 15000])
    assert.equal(t.max, 15000)
})
test("equal values and tiny ranges still give ticks", () => {
    assert.ok(niceTicks(5, 5).ticks.length >= 2)
    assert.deepEqual(niceTicks(0, 1, 5).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1])
})
test("negative ranges are covered", () => {
    const t = niceTicks(-30, 70, 5)
    assert.ok(t.min <= -30 && t.max >= 70)
})
