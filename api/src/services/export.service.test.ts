import assert from "node:assert/strict"
import { test } from "node:test"
import { ChartNotFoundError, ExportBusyError, ExportTooLargeError, NothingToExportError, ResultNotFoundError } from "../domain/errors.ts"
import type { ChartSpec } from "../domain/chart-spec.ts"
import { createMemoryFileStore } from "../store/memory-file-store.ts"
import { createMemoryResultStore } from "../store/memory-result-store.ts"
import type { ExportRun } from "./export-run-store.repository.ts"
import { createExportService } from "./export.service.ts"
import type { DocumentRenderer, RenderInput } from "./document-renderer.ts"

const NOW = new Date("2026-10-31T21:30:15.000Z")
const R1 = "11111111-1111-4111-8111-111111111111"
const CH = (id: string, resultId: string): ChartSpec => ({ id, type: "bar", title: "t", valueKind: "integer", categories: ["a"], series: [{ name: "s", values: [1] }], summary: "r", resultId, partial: false })

function setup(opts: { maxRows?: number; renderer?: DocumentRenderer } = {}) {
    const results = createMemoryResultStore({ ttlMs: 3_600_000, maxRows: 20000, maxBytes: 1e9, now: () => NOW.getTime() })
    const files = createMemoryFileStore({ maxBytes: 1e9, now: () => NOW.getTime() })
    const saved: ExportRun[] = []
    const calls: RenderInput[] = []
    const renderer: DocumentRenderer = opts.renderer ?? { render: async (i) => { calls.push(i); return new Uint8Array([1, 2, 3]) } }
    let n = 0
    const svc = createExportService({
        results, files, renderer, runs: { save: (r) => saved.push(r) }, config: { exportMaxRows: opts.maxRows ?? 5000, exportTtlMs: 1_800_000 },
        now: () => NOW, newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    })
    const seed = (conversationId: string, id: string, rows: Record<string, unknown>[] = [{ aluno: "Ana", cpf: "12345678909", valor_pago: 1 }]) =>
        results.save({ id, conversationId, toolName: "financeiro_contas_recebidas_periodo", label: "l", filters: {}, rows, totalRows: rows.length })
    const req = (over: Record<string, unknown> = {}) => ({ conversationId: "c1", format: "xlsx" as const, maskPersonalData: true, origin: "button" as const, requestId: "req-1", ...over })
    return { svc, results, files, saved, calls, seed, req }
}

test("exports the latest result by default and describes the file", async () => {
    const t = setup(); t.seed("c1", R1)
    const f = await t.svc.export(t.req())
    assert.equal(f.name, "contas-recebidas-20261031-183015.xlsx")
    assert.equal(f.resultId, R1)
    assert.equal(f.rowCount, 1)
    assert.equal(f.sizeBytes, 3)
    assert.equal(f.containsFullPersonalData, false)
    assert.equal(f.expiresAt, new Date(NOW.getTime() + 1_800_000).toISOString())
    assert.equal(f.downloadPath, `/conversations/c1/exports/${f.id}`)
    assert.equal(t.files.get("c1", f.id)?.bytes.byteLength, 3)
    assert.deepEqual([t.saved[0]!.outcome, t.saved[0]!.kind, t.saved[0]!.detail, t.saved[0]!.origin, t.saved[0]!.explicitPii, t.saved[0]!.rows], ["ok", "export", "xlsx", "button", false, 1])
})
test("masking flag reaches the table; full data flagged in the run and the file", async () => {
    const t = setup(); t.seed("c1", R1)
    await t.svc.export(t.req())
    assert.ok(!t.calls[0]!.table.rows.flat().includes("12345678909"))
    const f = await t.svc.export(t.req({ maskPersonalData: false, requestId: "req-2" }))
    assert.ok(t.calls[1]!.table.rows.flat().includes("12345678909"))
    assert.equal(f.containsFullPersonalData, true)
    assert.equal(t.saved[1]!.explicitPii, true)
})
test("another conversation's result is indistinguishable from a missing one", async () => {
    const t = setup(); t.seed("c2", R1)
    await assert.rejects(t.svc.export(t.req({ resultId: R1 })), ResultNotFoundError)
    await assert.rejects(t.svc.export(t.req()), ResultNotFoundError)
    assert.deepEqual(t.saved.map((r) => r.outcome), ["not_found", "not_found"])
})
test("empty result and too many rows are rejected without a file", async () => {
    const t = setup({ maxRows: 2 })
    t.seed("c1", R1, [])
    await assert.rejects(t.svc.export(t.req()), NothingToExportError)
    t.seed("c1", "22222222-2222-4222-8222-222222222222", [{ a: 1 }, { a: 2 }, { a: 3 }])
    await assert.rejects(t.svc.export(t.req()), (e: Error) => e instanceof ExportTooLargeError && e.rows === 3 && e.maxRows === 2)
    assert.equal(t.calls.length, 0)
    assert.equal(t.saved.at(-1)!.outcome, "too_large")
    assert.deepEqual(t.files.names("c1"), [])
})
test("renderer errors are recorded and rethrown", async () => {
    const t = setup({ renderer: { render: async () => { throw new ExportBusyError(5) } } }); t.seed("c1", R1)
    await assert.rejects(t.svc.export(t.req()), ExportBusyError)
    assert.equal(t.saved[0]!.outcome, "error")
})
test("file names do not collide and the order of rows is preserved", async () => {
    const t = setup(); t.seed("c1", R1, [{ aluno: "B" }, { aluno: "A" }, { aluno: "C" }])
    const a = await t.svc.export(t.req()); const b = await t.svc.export(t.req())
    assert.notEqual(a.name, b.name)
    assert.deepEqual(t.calls[0]!.table.rows.map((r) => r[0]), ["B", "A", "C"])
})
test("chart must be alive and belong to the same result", async () => {
    const t = setup(); t.seed("c1", R1); t.seed("c1", "22222222-2222-4222-8222-222222222222")
    t.results.addChart("c1", CH("g1", R1))
    await assert.rejects(t.svc.export(t.req({ resultId: "22222222-2222-4222-8222-222222222222", chartId: "g1" })), ChartNotFoundError)
    await assert.rejects(t.svc.export(t.req({ resultId: R1, chartId: "nope" })), ChartNotFoundError)
    const f = await t.svc.export(t.req({ resultId: R1, chartId: "g1" }))
    assert.equal(f.includesChart, true)
    assert.equal(t.calls.at(-1)!.chart?.id, "g1")
    assert.equal((await t.svc.export(t.req({ resultId: R1 }))).includesChart, false)
})
