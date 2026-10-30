import assert from "node:assert/strict"
import { test } from "node:test"
import { shapeToolResult } from "./shape-result.ts"

const limits = { maxRows: 40, maxChars: 100000 }
const bills = (n: number) => Array.from({ length: n }, (_, i) => ({ id_aluno: i, aluno: `A${i}`, valor_pago: 0.1 }))

test("400 records: exact total, exact sum, 40 rows", () => {
    const r = shapeToolResult("dksoft_list_paid_bills", JSON.stringify(bills(400)), limits)
    const out = JSON.parse(r.text)
    assert.equal(out.total, 400)
    assert.equal(out.somas.valor_pago, 40) // 400 * 0.1 without float drift
    assert.equal(out.registros.length, 40)
    assert.equal(out.truncado, true)
    assert.equal(out.omitidos, 360)
    assert.equal(r.truncated, true)
})

test("small result is not truncated", () => {
    const r = shapeToolResult("dksoft_list_paid_bills", JSON.stringify(bills(3)), limits)
    assert.equal(r.truncated, false)
    assert.equal(JSON.parse(r.text).omitidos, 0)
})

test("object with a single array keeps the context", () => {
    const r = shapeToolResult("dksoft_list_student_exams", JSON.stringify({ aluno: "Ana", provas: [{ nota: 8 }] }), limits)
    const out = JSON.parse(r.text)
    assert.equal(out.aluno, "Ana")
    assert.equal(out.total, 1)
})

test("cuts by characters when rows are huge", () => {
    const big = Array.from({ length: 10 }, () => ({ x: "y".repeat(1000) }))
    const r = shapeToolResult("dksoft_list_students", JSON.stringify(big), { maxRows: 40, maxChars: 3000 })
    assert.ok(r.text.length <= 3000)
    assert.equal(r.truncated, true)
    assert.equal(JSON.parse(r.text).total, 10)
})

test("non JSON text passes through", () => {
    assert.deepEqual(shapeToolResult("t", "HTTP 429: usage limit exceeded", limits), { text: "HTTP 429: usage limit exceeded", truncated: false })
})

test("list_* drops contact fields, find_* keeps them", () => {
    const rows = [{ nome: "A", cpf: "1", email: "a@b.c", telefone: "1", celular: "2", telefone_contato: "3" }]
    const list = JSON.parse(shapeToolResult("dksoft_list_students", JSON.stringify(rows), limits).text)
    assert.deepEqual(Object.keys(list.registros[0]), ["nome"])
    const find = JSON.parse(shapeToolResult("dksoft_find_students_by_phone", JSON.stringify(rows), limits).text)
    assert.equal(find.registros[0].cpf, "1")
})
