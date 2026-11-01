import assert from "node:assert/strict"
import { test } from "node:test"
import { chartTable } from "./chart-table.ts"
import type { ChartSpec } from "./chart-spec.ts"

const U = "11111111-1111-4111-8111-111111111111"
const spec = (over: Partial<ChartSpec>): ChartSpec => ({ id: U, type: "bar", title: "t", valueKind: "currency", categories: ["A", "B"], series: [{ name: "Total", values: [10, 30] }, { name: "Outro", values: [1, 2] }], summary: "s", resultId: U, partial: false, ...over })

test("bar/line table has one column per series with formatted values", () => {
    assert.deepEqual(chartTable(spec({})), { header: ["Categoria", "Total", "Outro"], rows: [["A", "R$ 10,00", "R$ 1,00"], ["B", "R$ 30,00", "R$ 2,00"]] })
})
test("pie table adds the share", () => {
    const t = chartTable(spec({ type: "pie", series: [{ name: "Total", values: [10, 30] }] }))
    assert.deepEqual(t.rows.map((r) => r[2]), ["25%", "75%"])
})
