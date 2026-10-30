import assert from "node:assert/strict"
import { test } from "node:test"
import { maskPii } from "./mask-pii.ts"

test("masks CPF with and without punctuation", () => {
    assert.ok(!maskPii("cpf 123.456.789-09 ok").includes("123.456"))
    assert.ok(maskPii("cpf 12345678909").endsWith("*********09"))
})
test("masks e-mail", () => {
    assert.equal(maskPii("fulano@escola.com.br"), "***@***")
})
test("masks phones", () => {
    for (const p of ["(11) 91234-5678", "11912345678", "+55 11 91234-5678", "(11) 3456-7890"]) {
        const out = maskPii(`tel ${p} fim`)
        assert.ok(!/\d{4}-?\d{4}/.test(out), out)
    }
})
test("masks CPF inside a URL in an error message", () => {
    const out = maskPii("GET /alunos/cpf/12345678909 failed")
    assert.ok(!out.includes("12345678909"))
    assert.ok(out.includes("/alunos/cpf/"))
})
test("leaves plain text alone", () => {
    assert.equal(maskPii("Total de 12 alunos em 2026"), "Total de 12 alunos em 2026")
})
