import assert from "node:assert/strict"
import { test } from "node:test"
import { InvalidPeriodError, PeriodTooLongError } from "./errors.ts"
import { splitPeriod } from "./period.ts"

test("30 days → 1 window; 31 → 2; 75 → 3; 90 → 3", () => {
    assert.deepEqual(splitPeriod("2026-01-01", "2026-01-30"), [{ inicio: "2026-01-01", fim: "2026-01-30" }])
    assert.deepEqual(splitPeriod("2026-01-01", "2026-01-31"), [{ inicio: "2026-01-01", fim: "2026-01-30" }, { inicio: "2026-01-31", fim: "2026-01-31" }])
    assert.equal(splitPeriod("2026-01-01", "2026-03-16").length, 3)
    assert.equal(splitPeriod("2026-01-01", "2026-03-31").length, 3)
})

test("windows are consecutive: no gap, no overlap, each ≤ 30 days inclusive", () => {
    const w = splitPeriod("2026-08-15", "2026-11-12")
    for (let i = 1; i < w.length; i++) {
        const prevEnd = Date.parse(w[i - 1]!.fim), start = Date.parse(w[i]!.inicio)
        assert.equal(start - prevEnd, 24 * 3600 * 1000)
    }
    for (const x of w) assert.ok((Date.parse(x.fim) - Date.parse(x.inicio)) / 86400000 + 1 <= 30)
    assert.equal(w[0]!.inicio, "2026-08-15"); assert.equal(w.at(-1)!.fim, "2026-11-12")
})

test("91 days → PeriodTooLongError; leap year and month turn work", () => {
    assert.throws(() => splitPeriod("2026-01-01", "2026-04-01"), PeriodTooLongError)
    assert.deepEqual(splitPeriod("2028-02-15", "2028-03-15"), [{ inicio: "2028-02-15", fim: "2028-03-15" }])
    assert.equal(splitPeriod("2028-02-01", "2028-03-02").length, 2)
    assert.deepEqual(splitPeriod("2026-12-20", "2027-01-05"), [{ inicio: "2026-12-20", fim: "2027-01-05" }])
})

test("invalid, nonexistent and inverted dates", () => {
    assert.throws(() => splitPeriod("abc", "2026-01-01"), InvalidPeriodError)
    assert.throws(() => splitPeriod("2026-02-30", "2026-03-01"), InvalidPeriodError)
    assert.throws(() => splitPeriod("2026-02-10", "2026-02-01"), InvalidPeriodError)
})
