import assert from "node:assert/strict"
import { test } from "node:test"
import { exportFileName } from "./export-name.ts"

const now = new Date("2026-10-31T21:30:15.000Z") // 18:30:15 in Sao Paulo (UTC-3)
test("exact format in the Sao Paulo time zone", () => {
    assert.equal(exportFileName({ toolName: "financeiro_contas_recebidas_periodo", format: "xlsx", now, taken: [] }), "contas-recebidas-20261031-183015.xlsx")
    assert.equal(exportFileName({ toolName: "dksoft_list_packages", format: "pdf", now, taken: [] }), "pacotes-20261031-183015.pdf")
    assert.equal(exportFileName({ toolName: "x", format: "docx", now, taken: [] }), "consulta-20261031-183015.docx")
})
test("midnight crossing uses the local date", () => {
    assert.equal(exportFileName({ toolName: "x", format: "pdf", now: new Date("2026-11-01T02:00:00.000Z"), taken: [] }), "consulta-20261031-230000.pdf")
})
test("collisions get -2, -3", () => {
    const first = "contas-pagas-20261031-183015.pdf"
    const n2 = exportFileName({ toolName: "dksoft_list_paid_bills", format: "pdf", now, taken: [first] })
    assert.equal(n2, "contas-pagas-20261031-183015-2.pdf")
    assert.equal(exportFileName({ toolName: "dksoft_list_paid_bills", format: "pdf", now, taken: [first, n2] }), "contas-pagas-20261031-183015-3.pdf")
})
test("the name never contains personal data", () => {
    assert.ok(/^[a-z0-9-]+\.pdf$/.test(exportFileName({ toolName: "dksoft_find_student", format: "pdf", now, taken: [] })))
})
