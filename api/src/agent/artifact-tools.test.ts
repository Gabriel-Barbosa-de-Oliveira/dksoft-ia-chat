import assert from "node:assert/strict"
import { test } from "node:test"
import { ChartNotPossibleError, ExportBusyError, ExportTooLargeError, ResultNotFoundError } from "../domain/errors.ts"
import { MIME_BY_FORMAT, type FileDescriptor } from "../domain/file-descriptor.ts"
import type { ChartService } from "../services/chart.service.ts"
import type { ExportService } from "../services/export.service.ts"
import { createMemoryResultStore } from "../store/memory-result-store.ts"
import { createArtifactToolBuilder, exportErrorText } from "./artifact-tools.ts"

const R1 = "11111111-1111-4111-8111-111111111111"
const NOW = new Date("2026-10-31T21:30:00.000Z")
const descriptor = (over: Partial<FileDescriptor> = {}): FileDescriptor => ({
    id: R1, conversationId: "c1", resultId: R1, name: "contas-20261031-183000.xlsx", format: "xlsx", mime: MIME_BY_FORMAT.xlsx, sizeBytes: 48211, rowCount: 3,
    includesChart: false, containsFullPersonalData: false, createdAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 1_800_000).toISOString(),
    downloadPath: `/conversations/c1/exports/${R1}`, ...over,
})

function setup(over: { exportImpl?: ExportService["export"]; chartImpl?: ChartService["create"] } = {}) {
    const results = createMemoryResultStore({ ttlMs: 3_600_000, maxRows: 100, maxBytes: 1e9, now: () => NOW.getTime() })
    const exportCalls: Parameters<ExportService["export"]>[0][] = []
    const exports = { export: over.exportImpl ?? (async (r) => { exportCalls.push(r); return descriptor({ containsFullPersonalData: !r.maskPersonalData, includesChart: r.chartId !== undefined }) }) } as ExportService
    const charts = { create: over.chartImpl ?? (() => { throw new Error("unused") }) } as ChartService
    const build = createArtifactToolBuilder({ results, exports, charts, now: () => NOW })
    const tools = (userMessage: string, conversationId = "c1") => Object.fromEntries(build({ conversationId, userMessage, requestId: "req" }).map((t) => [t.name, t]))
    const seed = (conversationId = "c1", id = R1) => results.save({ id, conversationId, toolName: "financeiro_contas_recebidas_periodo", label: "Contas recebidas, 01/10/2026 a 31/10/2026", filters: {}, rows: [{ a: 1 }, { a: 2 }, { a: 3 }], totalRows: 3 })
    return { results, tools, seed, exportCalls }
}
const call = async (t: unknown, args: Record<string, unknown>) => (t as { invoke(i: unknown): Promise<unknown> }).invoke({ id: "1", name: "x", args, type: "tool_call" }) as Promise<{ content: string; artifact?: unknown }>

test("three tools are built", () => {
    assert.deepEqual(Object.keys(setup().tools("oi")).sort(), ["exportar_arquivo", "gerar_grafico", "resultados_disponiveis"])
})
test("resultados_disponiveis: empty, ordered, isolated, no raw records", async () => {
    const t = setup()
    assert.match((await call(t.tools("oi").resultados_disponiveis, {})).content, /Nenhum resultado disponível/)
    t.seed("c1", R1); t.seed("c1", "22222222-2222-4222-8222-222222222222"); t.seed("c2", "33333333-3333-4333-8333-333333333333")
    const text = (await call(t.tools("oi").resultados_disponiveis, {})).content
    assert.ok(text.indexOf("22222222") < text.indexOf(R1), "newest first")
    assert.ok(!text.includes("33333333"), "other conversation hidden")
    assert.match(text, /3 registros · há 0 min/)
})
test("exportar_arquivo: success returns text and the descriptor as artifact", async () => {
    const t = setup(); t.seed()
    const out = await call(t.tools("exporta em excel").exportar_arquivo, { formato: "xlsx" })
    assert.match(out.content, /Arquivo gerado: contas-20261031-183000\.xlsx \(xlsx, 3 linhas, 47 KB\), válido até 19:00\. Resultado exportado: Contas recebidas, 01\/10\/2026 a 31\/10\/2026\. Dados pessoais: mascarados\./)
    assert.equal((out.artifact as FileDescriptor).id, R1)
    assert.equal(t.exportCalls[0]!.maskPersonalData, true)
    assert.equal(t.exportCalls[0]!.origin, "chat")
})
test("full personal data only when the user message asks explicitly", async () => {
    const t = setup(); t.seed()
    const denied = await call(t.tools("exporta em excel").exportar_arquivo, { formato: "xlsx", dadosPessoaisCompletos: true })
    assert.equal(t.exportCalls[0]!.maskPersonalData, true)
    assert.match(denied.content, /saiu mascarado/)
    const ok = await call(t.tools("exporta em excel com o CPF completo").exportar_arquivo, { formato: "xlsx", dadosPessoaisCompletos: true })
    assert.equal(t.exportCalls[1]!.maskPersonalData, false)
    assert.match(ok.content, /Dados pessoais: completos/)
    await call(t.tools("exporta com o CPF completo").exportar_arquivo, { formato: "xlsx" }) // the model did not ask for it: stays masked
    assert.equal(t.exportCalls[2]!.maskPersonalData, true)
})
test("incluirGrafico uses the latest chart of the result, or says there was none", async () => {
    const t = setup(); t.seed()
    const none = await call(t.tools("x").exportar_arquivo, { formato: "pdf", incluirGrafico: true })
    assert.match(none.content, /Não havia gráfico para incluir/)
    assert.equal(t.exportCalls[0]!.chartId, undefined)
    t.results.addChart("c1", { id: "g1", type: "bar", title: "t", valueKind: "integer", categories: ["a"], series: [{ name: "s", values: [1] }], summary: "r", resultId: R1, partial: false })
    await call(t.tools("x").exportar_arquivo, { formato: "pdf", incluirGrafico: true })
    assert.equal(t.exportCalls[1]!.chartId, "g1")
})
test("no result, other conversation and service errors become text, never exceptions", async () => {
    const t = setup()
    const empty = await call(t.tools("x").exportar_arquivo, { formato: "pdf" })
    assert.match(empty.content, /não estão mais disponíveis/)
    assert.equal(empty.artifact, undefined)
    t.seed("c2")
    assert.match((await call(t.tools("x").exportar_arquivo, { formato: "pdf", resultId: R1 })).content, /não estão mais disponíveis/)
    for (const [err, re] of [
        [new ExportTooLargeError(9000, 5000), /9000 linhas.*5000/], [new ExportBusyError(5), /em andamento/], [new ResultNotFoundError(), /não estão mais/], [new Error("boom"), /Não foi possível gerar/],
    ] as const) {
        const b = setup({ exportImpl: async () => { throw err } }); b.seed()
        assert.match((await call(b.tools("x").exportar_arquivo, { formato: "pdf" })).content, re)
    }
    assert.ok(exportErrorText(new Error("x")).length > 0)
})
test("gerar_grafico: success returns the spec as artifact; each failure becomes text", async () => {
    const spec = { id: "g1", type: "bar", title: "Recebido", valueKind: "integer", categories: ["a", "b"], series: [{ name: "s", values: [1, 2] }], summary: "Gráfico de barras com 2 categorias.", resultId: R1, partial: false }
    const ok = setup({ chartImpl: () => spec as never })
    const out = await call(ok.tools("x").gerar_grafico, { type: "bar", title: "Recebido", groupBy: "banco", measure: { kind: "count" } })
    assert.match(out.content, /^Gráfico exibido: "Recebido"\. Gráfico de barras com 2 categorias\. Comente o gráfico em até 2 frases/)
    assert.deepEqual(out.artifact, spec)
    for (const [err, re] of [[new ResultNotFoundError(), /Não há dados consultados/], [new ChartNotPossibleError("Os dados têm só 1 categoria; um gráfico não ajudaria. Responda em texto."), /só 1 categoria/], [new Error("x"), /Responda em texto/]] as const) {
        const b = setup({ chartImpl: () => { throw err } })
        const r = await call(b.tools("x").gerar_grafico, { type: "bar", title: "t", groupBy: "banco", measure: { kind: "count" } })
        assert.match(r.content, re)
        assert.equal(r.artifact, undefined)
    }
})
test("invalid chart input is rejected by the schema", async () => {
    const t = setup()
    await assert.rejects(call(t.tools("x").gerar_grafico, { type: "donut", title: "t", groupBy: "b", measure: { kind: "count" } }))
})
