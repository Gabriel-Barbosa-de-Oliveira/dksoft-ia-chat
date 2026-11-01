import assert from "node:assert/strict"
import { test } from "node:test"
import { formatCell, formatDateBr, formatInstantSp } from "./format-br.ts"

test("money, integer, date and null", () => {
    assert.equal(formatCell(1234.5, "money"), "R$ 1.234,50")
    assert.equal(formatCell(1234, "integer"), "1.234")
    assert.equal(formatCell(new Date(Date.UTC(2026, 9, 5)), "date"), "05/10/2026")
    assert.equal(formatCell(null, "text"), "")
    assert.equal(formatCell("Ana", "text"), "Ana")
})
test("instants are shown in Sao Paulo time", () => {
    assert.equal(formatInstantSp(new Date("2026-10-31T21:30:00.000Z")), "31/10/2026 18:30")
    assert.equal(formatDateBr(new Date(Date.UTC(2026, 0, 2))), "02/01/2026")
})
