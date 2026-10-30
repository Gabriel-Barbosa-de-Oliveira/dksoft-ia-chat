import assert from "node:assert/strict"
import { test } from "node:test"
import { PackageHttpClient } from "../src/infrastructure/packageHttpClient.ts"
import { PaidBillsHttpClient } from "../src/infrastructure/paidBillsHttpClient.ts"
import { ReceivableAccountHttpClient } from "../src/infrastructure/receivableAccountHttpClient.ts"
import { StudentHttpClient } from "../src/infrastructure/studentHttpClient.ts"

const fake = (status: number, body: unknown, headers: Record<string, string> = {}) => async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers })
const q = { data_inicial: "2026-01-01", data_final: "2026-01-30" }
const tooManyRequests = fake(429, { mensagem: "usage limit exceeded" }, { "Retry-After": "7" })

test("429 becomes a clear message in every client", async () => {
    const msg = "HTTP 429: usage limit exceeded (Retry-After: 7s)"
    await assert.rejects(new PackageHttpClient("http://x", tooManyRequests).listPackages(), { message: msg })
    await assert.rejects(new PaidBillsHttpClient("http://x", tooManyRequests).listPaidBills(q), { message: msg })
    await assert.rejects(new ReceivableAccountHttpClient("http://x", tooManyRequests).listReceivableAccounts(q), { message: msg })
    await assert.rejects(new StudentHttpClient("http://x", tooManyRequests).listStudentExams(1), { message: msg })
})

test("unexpected shape is rejected with the field path", async () => {
    const c = new PaidBillsHttpClient("http://x", fake(200, { tipo: "x", data_inicial: "a", data_final: "b", total_registros: "3", registros: [] }))
    await assert.rejects(c.listPaidBills(q), /Unexpected response shape from DKSOFT API: total_registros/)
})

test("known null fields are accepted", async () => {
    const reg = {
        id_aluno: 1, numero_lancamento: 2, vencimento: "2026-01-01", data_pagamento: "2026-01-02", valor_pago: 10.5,
        historico: null, aluno: "A", responsavel: null, banco: null, subconta: null, conta: null, pag_nome: null,
        centro_custo: null, banco_caixa: null, hora: null, aluno_situacao: null,
    }
    const body = { tipo: "x", data_inicial: "a", data_final: "b", total_registros: 1, registros: [reg] }
    const paid = await new PaidBillsHttpClient("http://x", fake(200, body)).listPaidBills(q)
    assert.equal(paid.registros.length, 1)
    const rec = await new ReceivableAccountHttpClient("http://x", fake(200, body)).listReceivableAccounts(q)
    assert.equal(rec.registros[0]?.responsavel, null)
})

test("student 404 keeps the short message", async () => {
    await assert.rejects(new StudentHttpClient("http://x", fake(404, "<html>")).listStudentExams(1), { message: "Not found (404)" })
})
