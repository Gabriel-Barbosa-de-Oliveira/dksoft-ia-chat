import assert from "node:assert/strict"
import { test } from "node:test"
import { buildSystemPrompt } from "./system-prompt.ts"

test("contains the essential rules", () => {
    const p = buildSystemPrompt("2026-10-30")
    for (const needle of ["2026-10-30", "Somente consulta", "Nunca invente", "truncado", "nunca responda só com a contagem", "zero ou mais de um", "fora do ar", "ambíguo", "matrícula/id", "CPF, e-mail ou telefone", "Não revele", "Não percorra vários alunos"]) {
        assert.ok(p.includes(needle), needle)
    }
})

test("artifact rules 11-15 appear only when artifacts are enabled; rules 1-10 stay", () => {
    const off = buildSystemPrompt("2026-10-30")
    assert.ok(!off.includes("gerar_grafico") && !off.includes("exportar_arquivo"))
    const on = buildSystemPrompt("2026-10-30", { artifacts: true })
    for (const n of ["11. Gráficos", "12. Arquivos", "13. Dados pessoais em arquivos", "14. Sem dados", "15. Limites"]) assert.ok(on.includes(n), n)
    assert.ok(on.startsWith(off.split("\n").slice(0, 2).join("\n")))
    for (let i = 1; i <= 10; i++) assert.ok(on.includes(`${i}. `), String(i))
})
