import assert from "node:assert/strict"
import { test } from "node:test"
import { buildChartSpec, type ChartSource } from "./build-chart.ts"
import type { ChartRequest } from "./chart-request.ts"
import { ChartNotPossibleError } from "./errors.ts"

const R = "11111111-1111-4111-8111-111111111111"
const deps = { newId: () => "22222222-2222-4222-8222-222222222222" }
const src = (rows: Record<string, unknown>[], over: Partial<ChartSource> = {}): ChartSource => ({ id: R, rows, filters: { dataInicial: "2026-10-01", dataFinal: "2026-10-31" }, capped: false, ...over })
const req = (over: Partial<ChartRequest>): ChartRequest => ({ type: "bar", title: "T", groupBy: "banco", measure: { kind: "count" }, ...over }) as ChartRequest
const notPossible = (fn: () => unknown, re: RegExp) => assert.throws(fn, (e: Error) => e instanceof ChartNotPossibleError && re.test(e.message))

test("sums in cents: 0.1 + 0.2 = 0.30 and values sort by value desc", () => {
    const rows = [{ banco: "A", valor_pago: 0.1 }, { banco: "A", valor_pago: 0.2 }, { banco: "B", valor_pago: 5 }]
    const c = buildChartSpec(src(rows), req({ measure: { kind: "sum", field: "valor_pago" } }), deps)
    assert.deepEqual(c.categories, ["B", "A"])
    assert.deepEqual(c.series[0], { name: "Valor pago", values: [5, 0.3] })
    assert.equal(c.valueKind, "currency")
    assert.equal(c.subtitle, "01/10/2026 a 31/10/2026")
    assert.equal(c.resultId, R)
    assert.ok(c.summary.length > 0)
})
test("count uses every row, integer values", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ banco: i < 30 ? "A" : "B" }))
    const c = buildChartSpec(src(rows), req({}), deps)
    assert.deepEqual(c.series[0]!.values, [30, 20])
    assert.equal(c.valueKind, "integer")
})
test("weekly grouping crosses months and is chronological with Monday labels", () => {
    const rows = [{ data_pagamento: "2026-10-30", valor_pago: 10 }, { data_pagamento: "2026-11-02", valor_pago: 20 }, { data_pagamento: "2026-10-26", valor_pago: 5 }]
    const c = buildChartSpec(src(rows), req({ type: "line", groupBy: "data_pagamento", granularity: "week", measure: { kind: "sum", field: "valor_pago" } }), deps)
    assert.deepEqual(c.categories, ["Sem 26/10", "Sem 02/11"])
    assert.deepEqual(c.series[0]!.values, [15, 20])
})
test("monthly grouping and automatic granularity", () => {
    const rows = [{ data_pagamento: "2026-09-10" }, { data_pagamento: "2026-10-10" }, { data_pagamento: "2026-10-11" }]
    assert.deepEqual(buildChartSpec(src(rows), req({ groupBy: "data_pagamento", granularity: "month" }), deps).categories, ["09/2026", "10/2026"])
    assert.deepEqual(buildChartSpec(src(rows), req({ groupBy: "data_pagamento" }), deps).categories, ["10/09", "10/10", "11/10"])
})
test("nulls become 'Sem informação' and go last when sorting by x", () => {
    const c = buildChartSpec(src([{ banco: null }, { banco: "B" }, { banco: "A" }]), req({ sort: "x" }), deps)
    assert.deepEqual(c.categories, ["A", "B", "Sem informação"])
})
test("splitBy builds series; more than 6 fold into Outros", () => {
    const rows = ["a", "b", "c", "d", "e", "f", "g", "h"].flatMap((s) => [{ banco: "X", conta: s }, { banco: "Y", conta: s }])
    const c = buildChartSpec(src(rows), req({ splitBy: "conta" }), deps)
    assert.equal(c.series.length, 6)
    assert.equal(c.series.at(-1)!.name, "Outros")
    assert.deepEqual(c.series.at(-1)!.values, [3, 3])
})
test("limit keeps the top N-1 plus Outros; pie caps at 8 slices", () => {
    const rows = Array.from({ length: 12 }, (_, i) => Array.from({ length: i + 1 }, () => ({ banco: `b${i}` }))).flat()
    const c = buildChartSpec(src(rows), req({ limit: 3 }), deps)
    assert.equal(c.categories.length, 3)
    assert.equal(c.categories.at(-1), "Outros")
    const pie = buildChartSpec(src(rows), req({ type: "pie" }), deps)
    assert.equal(pie.categories.length, 8)
    assert.equal(pie.categories.at(-1), "Outros")
})
test("partial is inherited from a capped result", () => {
    assert.equal(buildChartSpec(src([{ banco: "A" }, { banco: "B" }], { capped: true }), req({}), deps).partial, true)
})
test("predictable failures", () => {
    notPossible(() => buildChartSpec(src([{ banco: "A" }, { banco: "A" }]), req({}), deps), /só 1 categoria/)
    notPossible(() => buildChartSpec(src([{ banco: "A" }]), req({ groupBy: "xyz" }), deps), /'xyz' não existe.*banco/)
    notPossible(() => buildChartSpec(src([{ cpf: "1" }, { cpf: "2" }]), req({ groupBy: "cpf" }), deps), /dados de contato/)
    notPossible(() => buildChartSpec(src([{ banco: "A", email: "x" }]), req({ splitBy: "email" }), deps), /dados de contato/)
    notPossible(() => buildChartSpec(src([{ banco: "A" }, { banco: "B" }]), req({ measure: { kind: "sum", field: "banco" } }), deps), /não é numérico/)
    notPossible(() => buildChartSpec(src([]), req({}), deps), /não tem registros/)
})
test("a pie accepts a single category", () => {
    assert.equal(buildChartSpec(src([{ banco: "A" }, { banco: "A" }]), req({ type: "pie" }), deps).categories.length, 1)
})
