import assert from "node:assert/strict"
import { test } from "node:test"
import { buildExportTable, type TableSource } from "./export-table.ts"

const now = new Date("2026-10-31T21:00:00.000Z")
const src = (rows: Record<string, unknown>[], over: Partial<TableSource> = {}): TableSource => ({
    toolName: "financeiro_contas_recebidas_periodo", filters: { dataInicial: "2026-10-01", dataFinal: "2026-10-31" }, rows, totalRows: rows.length, capped: false, ...over,
})

test("typed cells, Portuguese labels, ordered columns and header texts", () => {
    const t = buildExportTable(src([{ valor_pago: 10.5, aluno: "Ana", data_pagamento: "2026-10-05", id_aluno: 7, historico: null }]), { maskPersonalData: true, now })
    assert.deepEqual(t.columns.map((c) => c.key), ["id_aluno", "aluno", "data_pagamento", "valor_pago", "historico"])
    assert.deepEqual(t.columns.map((c) => c.label), ["ID do aluno", "Aluno", "Data do pagamento", "Valor pago", "Histórico"])
    const [row] = t.rows
    assert.equal(row![0], 7)
    assert.equal(row![1], "Ana")
    assert.ok(row![2] instanceof Date && row![2].toISOString() === "2026-10-05T00:00:00.000Z")
    assert.equal(row![3], 10.5)
    assert.equal(row![4], null) // never the text "null"
    assert.equal(t.title, "Contas recebidas")
    assert.equal(t.subtitle, "Período: 01/10/2026 a 31/10/2026")
})
test("sums are exact in cents", () => {
    const t = buildExportTable(src([{ valor_pago: 0.1 }, { valor_pago: 0.2 }, { valor_pago: "1.15" }]), { maskPersonalData: true, now })
    assert.equal(t.totals.sums.valor_pago, 1.45)
    assert.equal(t.totals.rowCount, 3)
})
test("text that looks like a formula stays text", () => {
    const t = buildExportTable(src([{ aluno: "=SOMA(A1)", historico: "+1" }]), { maskPersonalData: true, now })
    assert.equal(t.rows[0]![t.columns.findIndex((c) => c.key === "aluno")], "=SOMA(A1)")
})
test("masking on: cpf, e-mail, phone and free text are masked; off: nothing is", () => {
    const row = { aluno: "Ana", cpf: "12345678909", email: "ana@escola.com", celular: "(11) 98765-4321", historico: "ligar 11987654321" }
    const on = buildExportTable(src([row]), { maskPersonalData: true, now })
    const flat = on.rows[0]!.join("|")
    assert.ok(!flat.includes("12345678909") && !flat.includes("ana@escola.com") && !flat.includes("98765-4321") && !flat.includes("11987654321"), flat)
    assert.ok(flat.endsWith("09") || flat.includes("*********09"))
    assert.equal(on.maskedPersonalData, true)
    assert.ok(on.notes.some((n) => /mascarados/.test(n)))
    const off = buildExportTable(src([row]), { maskPersonalData: false, now })
    assert.ok(off.rows[0]!.join("|").includes("12345678909"))
    assert.equal(off.maskedPersonalData, false)
})
test("nested objects become text and are masked too", () => {
    const t = buildExportTable(src([{ aluno: "Ana", responsavel: { nome: "Bia", email: "bia@x.com", celular: null } }]), { maskPersonalData: true, now })
    const cell = t.rows[0]![t.columns.findIndex((c) => c.key === "responsavel")]
    assert.equal(typeof cell, "string")
    assert.ok(!(cell as string).includes("bia@x.com") && (cell as string).includes("Bia"))
})
test("capped result warns about partial data; empty table is fine", () => {
    const t = buildExportTable(src([{ aluno: "A" }], { capped: true, totalRows: 5 }), { maskPersonalData: true, now })
    assert.ok(t.notes.some((n) => /parcial/.test(n) && n.includes("5")))
    const empty = buildExportTable(src([]), { maskPersonalData: true, now })
    assert.equal(empty.rows.length, 0)
    assert.equal(empty.totals.rowCount, 0)
})
test("unknown columns come last, alphabetical", () => {
    const t = buildExportTable(src([{ zeta: 1, alfa: 2, aluno: "A" }]), { maskPersonalData: true, now })
    assert.deepEqual(t.columns.map((c) => c.key), ["aluno", "alfa", "zeta"])
})
