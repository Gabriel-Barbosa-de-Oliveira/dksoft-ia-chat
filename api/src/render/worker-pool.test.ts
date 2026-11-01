import assert from "node:assert/strict"
import { test } from "node:test"
import { strFromU8, unzipSync } from "fflate"
import { buildExportTable } from "../domain/export-table.ts"
import { ExportBusyError, ExportTimeoutError } from "../domain/errors.ts"
import { createDocumentRenderer } from "./worker-pool.ts"
import { sample } from "./testing/sample-chart.ts"

const table = (n = 3) => buildExportTable({ toolName: "dksoft_list_paid_bills", filters: {}, rows: Array.from({ length: n }, (_, i) => ({ aluno: `Ação ${i}`, valor_pago: i })), totalRows: n, capped: false }, { maskPersonalData: true, now: new Date("2026-10-31T21:00:00.000Z") })

// R2: a real worker thread, run under `node --import tsx --test`, generates the three formats with accents and a chart
test("real worker generates pdf, xlsx and docx (with chart) with accented text", async () => {
    const r = createDocumentRenderer({ timeoutMs: 60000, maxConcurrency: 2 })
    try {
        const pdf = await r.render({ format: "pdf", table: table(), chart: sample() })
        assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-")
        const xlsx = unzipSync(await r.render({ format: "xlsx", table: table(), chart: sample() }))
        assert.ok(strFromU8(xlsx["xl/sharedStrings.xml"]!).includes("Ação 1"))
        assert.ok(Object.keys(xlsx).some((n) => n.startsWith("xl/media/")))
        const docx = unzipSync(await r.render({ format: "docx", table: table() }))
        assert.ok(strFromU8(docx["word/document.xml"]!).includes("Ação 1"))
    } finally { await r.close?.() }
})
test("inline mode renders the same way", async () => {
    const r = createDocumentRenderer({ timeoutMs: 60000, maxConcurrency: 2, inline: true })
    assert.equal(Buffer.from((await r.render({ format: "pdf", table: table() })).slice(0, 5)).toString(), "%PDF-")
})
test("no free slot -> ExportBusyError with a retry hint; the slot is released afterwards", async () => {
    const r = createDocumentRenderer({ timeoutMs: 60000, maxConcurrency: 1, inline: true, retryAfterSeconds: 7 })
    const first = r.render({ format: "xlsx", table: table(500) })
    await assert.rejects(r.render({ format: "xlsx", table: table() }), (e: Error) => e instanceof ExportBusyError && e.retryAfterSeconds === 7)
    await first
    await r.render({ format: "xlsx", table: table() })
})
test("over the time limit -> ExportTimeoutError and the worker is terminated", async () => {
    const r = createDocumentRenderer({ timeoutMs: 1, maxConcurrency: 1 })
    await assert.rejects(r.render({ format: "pdf", table: table(2000) }), ExportTimeoutError)
    await r.close?.()
})
