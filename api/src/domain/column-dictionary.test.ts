import assert from "node:assert/strict"
import { test } from "node:test"
import { describeColumn } from "./column-dictionary.ts"

test("known fields of receivable and paid accounts have Portuguese labels and types", () => {
    const fields = ["id_aluno", "id_aluno_curso", "numero_lancamento", "vencimento", "data_pagamento", "valor_pago", "historico", "aluno", "responsavel", "banco", "subconta", "conta", "pacote", "pag_nome", "centro_custo", "banco_caixa", "hora", "aluno_situacao", "situacao_curso", "situacao_personalizada"]
    for (const f of fields) {
        const c = describeColumn(f)
        assert.ok(c.label && !c.label.includes("_"), f)
        assert.notEqual(c.label, f, f)
    }
    assert.equal(describeColumn("valor_pago").kind, "money")
    assert.equal(describeColumn("vencimento").kind, "date")
    assert.equal(describeColumn("id_aluno").kind, "integer")
    assert.equal(describeColumn("aluno").kind, "text")
})
test("personal contact fields are sensitive and nothing else is", () => {
    for (const f of ["cpf", "email", "telefone", "celular", "telefone_contato"]) assert.equal(describeColumn(f).sensitive, true, f)
    for (const f of ["aluno", "nome", "valor_pago", "historico"]) assert.equal(describeColumn(f).sensitive, false, f)
})
test("unknown fields get a derived label and text kind; naming hints classify money and dates", () => {
    assert.deepEqual(describeColumn("campo_novo"), { label: "Campo novo", kind: "text", sensitive: false })
    assert.equal(describeColumn("valor_desconto").kind, "money")
    assert.equal(describeColumn("data_baixa").kind, "date")
})
