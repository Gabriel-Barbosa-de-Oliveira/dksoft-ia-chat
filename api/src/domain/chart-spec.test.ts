import assert from "node:assert/strict"
import { test } from "node:test"
import { ChartNotPossibleError } from "./errors.ts"
import { validateChartSpec, type ChartSpec } from "./chart-spec.ts"

const U = "11111111-1111-4111-8111-111111111111"
export const bar = (over: Partial<ChartSpec> = {}): ChartSpec => ({
    id: U, type: "bar", title: "Recebido por semana", valueKind: "currency", categories: ["Sem 1", "Sem 2"],
    series: [{ name: "Total", values: [10.5, 20] }], summary: "resumo", resultId: U, partial: false, ...over,
})

test("valid bar, line and pie", () => {
    assert.equal(validateChartSpec(bar()).type, "bar")
    assert.equal(validateChartSpec(bar({ type: "line", series: [{ name: "a", values: [1, 2] }, { name: "b", values: [3, 4] }] })).series.length, 2)
    assert.equal(validateChartSpec(bar({ type: "pie" })).type, "pie")
})
test("rejects each broken rule", () => {
    const bad = (s: unknown) => assert.throws(() => validateChartSpec(s), ChartNotPossibleError)
    bad({ ...bar(), title: "" })
    bad(bar({ categories: ["a", "a"] }))
    bad(bar({ series: [{ name: "a", values: [1] }] }))
    bad(bar({ series: [{ name: "a", values: [1, 2] }, { name: "a", values: [1, 2] }] }))
    bad(bar({ series: [{ name: "a", values: [1.234, 2] }] }))
    bad(bar({ series: [{ name: "a", values: [Number.NaN, 2] }] }))
    bad(bar({ type: "pie", series: [{ name: "a", values: [1, 2] }, { name: "b", values: [1, 2] }] }))
    bad(bar({ type: "pie", series: [{ name: "a", values: [-1, 2] }] }))
    bad(bar({ type: "pie", categories: Array.from({ length: 9 }, (_, i) => `c${i}`), series: [{ name: "a", values: Array(9).fill(1) }] }))
    bad(bar({ categories: Array.from({ length: 25 }, (_, i) => `c${i}`), series: [{ name: "a", values: Array(25).fill(1) }] }))
    bad(bar({ series: Array.from({ length: 7 }, (_, i) => ({ name: `s${i}`, values: [1, 2] })) }))
    bad(bar({ summary: "x".repeat(401) }))
})
test("integer charts may have any finite value", () => {
    assert.equal(validateChartSpec(bar({ valueKind: "integer", series: [{ name: "n", values: [1, 2] }] })).valueKind, "integer")
})
