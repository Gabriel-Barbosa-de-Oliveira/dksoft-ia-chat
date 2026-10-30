import assert from "node:assert/strict"
import { test } from "node:test"
import { buildSystemPrompt } from "./system-prompt.ts"

test("contains the essential rules", () => {
    const p = buildSystemPrompt("2026-10-30")
    for (const needle of ["2026-10-30", "Somente consulta", "Nunca invente", "truncado", "zero ou mais de um", "fora do ar", "ambíguo", "matrícula/id", "CPF, e-mail ou telefone", "Não revele"]) {
        assert.ok(p.includes(needle), needle)
    }
})
