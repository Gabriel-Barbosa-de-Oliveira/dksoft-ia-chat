import assert from "node:assert/strict"
import { test } from "node:test"
import { summarizeChart } from "./chart-summary.ts"
import type { ChartSpec } from "./chart-spec.ts"

const U = "11111111-1111-4111-8111-111111111111"
const base = (over: Partial<ChartSpec>): ChartSpec => ({ id: U, type: "bar", title: "t", valueKind: "currency", categories: ["Sem 1", "Sem 2", "Sem 3"], series: [{ name: "Total", values: [8200.5, 9100, 12300] }], summary: "x", resultId: U, partial: false, ...over })

test("bar summary names max and min in reais", () => {
    assert.equal(summarizeChart(base({})), "Gráfico de barras com 3 categorias; maior valor: R$ 12.300,00 em Sem 3; menor: R$ 8.200,50 em Sem 1.")
})
test("line with several series, integers", () => {
    const s = summarizeChart(base({ type: "line", valueKind: "integer", series: [{ name: "a", values: [1, 2, 3] }, { name: "b", values: [1, 1, 1] }] }))
    assert.match(s, /linhas com 3 categorias e 2 séries; maior valor: 4 em Sem 3; menor: 2 em Sem 1/)
})
test("pie cites the largest slice and its share", () => {
    assert.equal(summarizeChart(base({ type: "pie", categories: ["A", "B"], series: [{ name: "s", values: [75, 25] }], valueKind: "integer" })), "Gráfico de pizza com 2 fatias; maior fatia: A, 75 (75%).")
})
test("ties are stable (first wins) and never longer than 400 chars", () => {
    assert.match(summarizeChart(base({ categories: ["A", "B"], series: [{ name: "s", values: [5, 5] }] })), /em A; menor: R\$ 5,00 em A/)
    assert.ok(summarizeChart(base({ categories: ["x".repeat(80), "y".repeat(80)], series: [{ name: "s", values: [1, 2] }] })).length <= 400)
})
