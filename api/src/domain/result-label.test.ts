import assert from "node:assert/strict"
import { test } from "node:test"
import { TOOL_ALLOWLIST } from "../agent/tools.ts"
import { describeResult, subjectSlug } from "./result-label.ts"

test("period tools show the period in dd/mm/yyyy", () => {
    const r = describeResult("financeiro_contas_recebidas_periodo", { data_inicial: "2026-10-01", data_final: "2026-10-31" })
    assert.equal(r.label, "Contas recebidas, 01/10/2026 a 31/10/2026")
    assert.deepEqual(r.filters, { dataInicial: "2026-10-01", dataFinal: "2026-10-31" })
})
test("every allowlisted tool has a specific label", () => {
    for (const name of [...TOOL_ALLOWLIST, "financeiro_contas_pagas_periodo", "financeiro_contas_recebidas_periodo"]) {
        assert.notEqual(describeResult(name, {}).label, "Resultado da consulta", name)
        assert.notEqual(subjectSlug(name), "consulta", name)
    }
})
test("unknown tool falls back", () => {
    assert.equal(describeResult("x", undefined).label, "Resultado da consulta")
    assert.equal(subjectSlug("x"), "consulta")
})
test("label never carries the student name, cpf, e-mail or phone", () => {
    const r = describeResult("dksoft_list_student_open_installments", { aluno: "Maria Souza", cpf: "123.456.789-09", email: "m@x.com" })
    assert.equal(r.label, "Parcelas em aberto de um aluno")
    assert.ok(!/Maria|123|@/.test(r.label))
    assert.equal(r.filters.aluno, "Maria Souza") // filters feed only the file header, never the name
})
