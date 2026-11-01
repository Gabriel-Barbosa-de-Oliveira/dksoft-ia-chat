import assert from "node:assert/strict"
import { test } from "node:test"
import { asksForFullPersonalData } from "./full-pii-request.ts"

const yes = [
    "exporta em Excel com o CPF completo", "quero o cpf inteiro no arquivo", "sem mascarar o telefone", "não mascare o CPF",
    "gera o pdf com e-mail completo", "preciso dos dados pessoais completos", "com cpf sem máscara", "me manda em word com telefone e e-mail completos",
    "inclui o CPF completo dos alunos", "exporta com os dados pessoais sem mascarar", "Excel com CPF INTEIRO", "quero o celular completo",
    "exporta em pdf com o telefone sem mascaramento",
]
const no = [
    "exporta em Excel", "mostra o cpf do aluno 123", "mascare o cpf", "não quero o CPF completo", "gera o pdf mascarado",
    "manda o relatório completo em pdf", "lista completa de alunos", "o telefone do aluno", "exporta com cpf mascarado",
    "não precisa do CPF completo", "oculte o e-mail", "quais os dados pessoais", "pacote completo", "me manda o arquivo com o CPF mascarado completo",
]
test("explicit requests are recognised", () => { for (const m of yes) assert.equal(asksForFullPersonalData(m), true, m) })
test("anything else is not (false negatives are acceptable, false positives are not)", () => { for (const m of no) assert.equal(asksForFullPersonalData(m), false, m) })
