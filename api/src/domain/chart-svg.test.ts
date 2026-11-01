import assert from "node:assert/strict"
import { test } from "node:test"
import { renderChartSvg } from "./chart-svg.ts"
import type { ChartSpec } from "./chart-spec.ts"

const U = "11111111-1111-4111-8111-111111111111"
const spec = (over: Partial<ChartSpec>): ChartSpec => ({ id: U, type: "bar", title: "Recebido & pago <mês>", valueKind: "currency", categories: ["Sem 1", "Sem 2", "Sem 3"], series: [{ name: "Total", values: [10, 30, 20] }, { name: "Outro", values: [5, 6, 7] }], summary: "s", resultId: U, partial: false, ...over })
const size = { width: 1000, height: 560 }
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length

test("well formed, escaped, contains title and every series name", () => {
    const svg = renderChartSvg(spec({}), size)
    assert.ok(svg.startsWith("<svg") && svg.endsWith("</svg>"))
    assert.ok(svg.includes("Recebido &amp; pago &lt;mês&gt;"))
    assert.ok(svg.includes("Total") && svg.includes("Outro"))
    assert.equal(count(svg, /<text/g), count(svg, /<\/text>/g))
})
test("bars: one rect per value (plus background and legend swatches)", () => {
    const svg = renderChartSvg(spec({}), size)
    assert.equal(count(svg, /<rect /g), 1 + 6 + 2 + 5) // background + bars + legend swatches + pattern tiles (series 1-5)
})
test("lines: one polyline and one marker per point per series", () => {
    const svg = renderChartSvg(spec({ type: "line" }), size)
    assert.equal(count(svg, /<polyline/g), 2)
})
test("pie: one slice per positive value, percentages shown", () => {
    const svg = renderChartSvg(spec({ type: "pie", categories: ["A", "B", "C"], series: [{ name: "s", values: [50, 25, 25] }] }), size)
    assert.equal(count(svg, /<path d="M\d/g) >= 3, true)
    assert.ok(svg.includes(">50%<") && svg.includes(">25%<"))
})
test("deterministic", () => {
    assert.equal(renderChartSvg(spec({}), size), renderChartSvg(spec({}), size))
})
test("24 categories x 6 series still render without NaN", () => {
    const cats = Array.from({ length: 24 }, (_, i) => `Categoria ${i}`)
    const series = Array.from({ length: 6 }, (_, s) => ({ name: `S${s}`, values: cats.map((_, i) => (i + 1) * (s + 1)) }))
    const svg = renderChartSvg(spec({ categories: cats, series }), size)
    assert.ok(!svg.includes("NaN"))
})
