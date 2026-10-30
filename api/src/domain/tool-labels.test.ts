import assert from "node:assert/strict"
import { test } from "node:test"
import { toolLabel } from "./tool-labels.ts"

test("known and fallback labels", () => {
    assert.equal(toolLabel("dksoft_list_student_open_installments"), "Consultando parcelas em aberto…")
    assert.equal(toolLabel("desconhecida"), "Consultando os dados…")
})
