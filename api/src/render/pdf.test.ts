import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { buildExportTable } from "../domain/export-table.ts"
import { renderChartPng } from "./chart-png.ts"
import { renderPdf } from "./pdf.ts"
import { sample } from "./testing/sample-chart.ts"

const now = new Date("2026-10-31T21:00:00.000Z")
const table = (rows: Record<string, unknown>[]) => buildExportTable({ toolName: "financeiro_contas_recebidas_periodo", filters: { dataInicial: "2026-10-01", dataFinal: "2026-10-31" }, rows, totalRows: rows.length, capped: false }, { maskPersonalData: true, now })
const rowsN = (n: number) => Array.from({ length: n }, (_, i) => ({ aluno: `Aluno ação ${i}`, valor_pago: i + 0.5, data_pagamento: "2026-10-05", historico: "pagamento referente à parcela" }))
const hasPdftotext = spawnSync("pdftotext", ["-v"]).status !== null
const text = (pdf: Uint8Array) => {
    const f = join(mkdtempSync(join(tmpdir(), "pdf-")), "a.pdf")
    writeFileSync(f, pdf)
    return execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8" })
}
const pages = (pdf: Uint8Array) => (Buffer.from(pdf).toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length

test("valid PDF whose page count grows with the rows", async () => {
    const small = await renderPdf(table(rowsN(3)))
    const big = await renderPdf(table(rowsN(300)))
    assert.equal(Buffer.from(small.slice(0, 5)).toString(), "%PDF-")
    assert.ok(pages(big) > pages(small), `${pages(big)} > ${pages(small)}`)
})
test("accented text, pt-BR values, totals and footer are in the document", { skip: !hasPdftotext }, async () => {
    const t = text(await renderPdf(table(rowsN(3))))
    for (const s of ["Contas recebidas", "Período: 01/10/2026 a 31/10/2026", "Aluno ação 1", "R$ 1,50", "05/10/2026", "Total", "R$ 4,50", "Página 1 de 1", "pagamento referente à parcela"]) assert.ok(t.includes(s), s)
})
test("with a chart: image and summary are included", { skip: !hasPdftotext }, async () => {
    const spec = sample()
    const pdf = await renderPdf(table(rowsN(2)), { spec, png: renderChartPng(spec) })
    assert.ok(Buffer.from(pdf).toString("latin1").includes("/Subtype /Image"))
    assert.ok(text(pdf).includes("Resumo do gráfico"))
    const without = await renderPdf(table(rowsN(2)))
    assert.ok(!Buffer.from(without).toString("latin1").includes("/Subtype /Image"))
})
test("1,000 rows render without error; empty table says so", async () => {
    assert.ok((await renderPdf(table(rowsN(1000)))).byteLength > 1000)
    if (hasPdftotext) assert.ok(text(await renderPdf(table([]))).includes("Nenhum registro"))
})
