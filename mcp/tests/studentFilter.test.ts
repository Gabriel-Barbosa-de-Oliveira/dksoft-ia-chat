import assert from "node:assert/strict"
import { test } from "node:test"
import { filterStudents, type Student } from "../src/domain/student.ts"

const student = (id: number, situacao: string | null) => ({ id, nome: `Aluno ${id}`, nome_social: null, situacao }) as unknown as Student
const students = [student(1, "A"), student(2, "I"), student(3, "F"), student(4, null)]
const ids = (situacao: string) => filterStudents(students, { nome: undefined, situacao }).map((s) => (s as unknown as { id: number }).id)

test("situacao accepts the word as well as the API code", () => {
    for (const word of ["ativo", "Ativos", "ativa", " ATIVAS ", "A", "a"]) assert.deepEqual(ids(word), [1], word)
    for (const word of ["inativo", "Inativos", "inativa", "I", "i"]) assert.deepEqual(ids(word), [2], word)
})

test("situacao F has no word and matches only its code", () => {
    assert.deepEqual(ids("F"), [3])
    assert.deepEqual(ids("formado"), [])
})
