import assert from "node:assert/strict"
import { test } from "node:test"
import { strFromU8, unzipSync } from "fflate"
import { buildExportTable } from "../domain/export-table.ts"
import { renderChartPng } from "./chart-png.ts"
import { renderDocx } from "./docx.ts"
import { sample } from "./testing/sample-chart.ts"

const now = new Date("2026-10-31T21:00:00.000Z")
const table = (rows: Record<string, unknown>[]) => buildExportTable({ toolName: "financeiro_contas_recebidas_periodo", filters: { dataInicial: "2026-10-01", dataFinal: "2026-10-31" }, rows, totalRows: rows.length, capped: false }, { maskPersonalData: true, now })
const rows = [{ aluno: "Ação Ñandú", valor_pago: 1234.5, data_pagamento: "2026-10-05", cpf: "12345678909" }, { aluno: "Bia", valor_pago: 10, data_pagamento: "2026-10-06", cpf: "98765432100" }]
const open = async (t: ReturnType<typeof table>, chart?: Parameters<typeof renderDocx>[1]) => {
    const files = unzipSync(await renderDocx(t, chart))
    return { names: Object.keys(files), doc: strFromU8(files["word/document.xml"]!) }
}

test("title, headers, row count, formatted values and accents are in document.xml", async () => {
    const { doc } = await open(table(rows))
    for (const s of ["Contas recebidas", "Período: 01/10/2026 a 31/10/2026", "Valor pago", "Ação Ñandú", "R$ 1.234,50", "05/10/2026", "Total", "R$ 1.244,50", "mascarados"]) assert.ok(doc.includes(s), s)
    assert.equal((doc.match(/<w:tr[ >]/g) ?? []).length, 1 + 2 + 1, "header + 2 rows + totals")
    assert.ok(doc.includes("<w:tblHeader"), "header repeats across pages")
    assert.ok(!doc.includes("12345678909"), "cpf stays masked")
})
test("with a chart: image, alt text and the chart data table", async () => {
    const spec = sample()
    const { names, doc } = await open(table(rows), { spec, png: renderChartPng(spec) })
    assert.ok(names.some((n) => /^word\/media\/.*\.png$/.test(n)))
    assert.ok(doc.includes("Resumo do gráfico") && doc.includes("R$ 12.300,00") && doc.includes("Sem 3"))
    const plain = await open(table(rows))
    assert.ok(!plain.names.some((n) => n.startsWith("word/media/")))
})
test("empty table says so", async () => {
    assert.ok((await open(table([]))).doc.includes("Nenhum registro"))
})
