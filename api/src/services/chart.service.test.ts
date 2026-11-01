import assert from "node:assert/strict"
import { test } from "node:test"
import { ChartNotPossibleError, ResultNotFoundError } from "../domain/errors.ts"
import { createMemoryResultStore } from "../store/memory-result-store.ts"
import { createChartService } from "./chart.service.ts"
import type { ExportRun } from "./export-run-store.repository.ts"

const R1 = "11111111-1111-4111-8111-111111111111"
function setup() {
    const results = createMemoryResultStore({ ttlMs: 3_600_000, maxRows: 100, maxBytes: 1e9 })
    const saved: ExportRun[] = []
    const svc = createChartService({ results, runs: { save: (r) => saved.push(r) }, newId: () => "22222222-2222-4222-8222-222222222222" })
    results.save({ id: R1, conversationId: "c1", toolName: "x", label: "l", filters: {}, rows: [{ banco: "A" }, { banco: "B" }, { banco: "B" }], totalRows: 3 })
    return { svc, results, saved }
}
const request = { type: "bar", title: "t", groupBy: "banco", measure: { kind: "count" } } as const

test("creates the chart, keeps it alive for exports and records the run", () => {
    const t = setup()
    const spec = t.svc.create({ conversationId: "c1", request, requestId: "q" })
    assert.deepEqual(spec.categories, ["B", "A"])
    assert.equal(t.results.getChart("c1", spec.id)?.id, spec.id)
    assert.deepEqual([t.saved[0]!.kind, t.saved[0]!.detail, t.saved[0]!.outcome, t.saved[0]!.rows], ["chart", "bar", "ok", 2])
})
test("another conversation or an unknown result -> ResultNotFoundError", () => {
    const t = setup()
    assert.throws(() => t.svc.create({ conversationId: "c2", request, requestId: "q" }), ResultNotFoundError)
    assert.throws(() => t.svc.create({ conversationId: "c1", request: { ...request, resultId: "33333333-3333-4333-8333-333333333333" }, requestId: "q" }), ResultNotFoundError)
    assert.equal(t.saved.at(-1)!.outcome, "not_found")
})
test("domain failures are recorded as errors and rethrown", () => {
    const t = setup()
    assert.throws(() => t.svc.create({ conversationId: "c1", request: { ...request, groupBy: "cpf" }, requestId: "q" }), ChartNotPossibleError)
    assert.equal(t.saved[0]!.outcome, "error")
})
