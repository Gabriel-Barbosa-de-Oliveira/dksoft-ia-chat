import assert from "node:assert/strict"
import { test } from "node:test"
import { strFromU8, unzipSync } from "fflate"
import { buildExportTable } from "../domain/export-table.ts"
import { renderChartPng } from "./chart-png.ts"
import { renderXlsx } from "./xlsx.ts"
import { sample } from "./testing/sample-chart.ts"

const now = new Date("2026-10-31T21:00:00.000Z")
const table = (rows: Record<string, unknown>[]) => buildExportTable({ toolName: "financeiro_contas_recebidas_periodo", filters: { dataInicial: "2026-10-01", dataFinal: "2026-10-31" }, rows, totalRows: rows.length, capped: false }, { maskPersonalData: true, now })
const open = async (t: ReturnType<typeof table>, chart?: Parameters<typeof renderXlsx>[1]) => {
    const files = unzipSync(await renderXlsx(t, chart))
    return { files, names: Object.keys(files), xml: (n: string) => strFromU8(files[n]!) }
}

test("is a valid zip with title, headers, numeric, date and total cells, and no formulas", async () => {
    const { names, xml } = await open(table([
        { aluno: "=SOMA(A1)", valor_pago: 10.5, data_pagamento: "2026-10-05", historico: "+1 -2 @x" },
        { aluno: "Ana", valor_pago: 0.25, data_pagamento: "2026-10-06", historico: null },
    ]))
    assert.ok(names.includes("xl/workbook.xml") && names.includes("xl/worksheets/sheet1.xml"))
    const sheet = xml("xl/worksheets/sheet1.xml")
    const shared = names.includes("xl/sharedStrings.xml") ? xml("xl/sharedStrings.xml") : ""
    assert.ok(!/<f[ >]/.test(sheet), "no formulas")
    assert.ok(shared.includes("Contas recebidas") && shared.includes("Valor pago") && shared.includes("=SOMA(A1)") && shared.includes("Total"))
    assert.ok(/<v>10\.5<\/v>/.test(sheet) && /<v>0\.25<\/v>/.test(sheet), "numbers stay numbers")
    assert.ok(/<v>10\.75<\/v>/.test(sheet), "total is the exact sum")
    assert.ok(xml("xl/styles.xml").includes("dd/mm/yyyy"))
    assert.ok(xml("xl/workbook.xml").includes('name="Dados"'))
})
test("with a chart: second sheet with the data table and an embedded PNG", async () => {
    const spec = sample()
    const { names, xml } = await open(table([{ aluno: "A", valor_pago: 1 }]), { spec, png: renderChartPng(spec) })
    assert.ok(names.some((n) => /^xl\/media\/.*\.png$/.test(n)))
    assert.ok(xml("xl/workbook.xml").includes("Gráfico"))
    const shared = xml("xl/sharedStrings.xml")
    for (const v of ["R$ 8.200,50", "R$ 12.300,00", "Sem 3"]) assert.ok(shared.includes(v), v)
})
test("without a chart there is a single sheet and no media", async () => {
    const { names } = await open(table([{ aluno: "A" }]))
    assert.ok(!names.some((n) => n.startsWith("xl/media/")))
    assert.ok(!names.includes("xl/worksheets/sheet2.xml"))
})
test("empty table still opens", async () => {
    const { names } = await open(table([]))
    assert.ok(names.includes("xl/worksheets/sheet1.xml"))
})
