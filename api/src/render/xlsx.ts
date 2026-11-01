import writeExcelFile from "write-excel-file/node"
import { chartTable } from "../domain/chart-table.ts"
import type { ChartSpec } from "../domain/chart-spec.ts"
import type { ExportTable } from "../domain/export-table.ts"
import { formatInstantSp } from "../domain/format-br.ts"

export type ChartAttachment = { spec: ChartSpec; png: Uint8Array }

type AnyCell = { value: unknown; [k: string]: unknown } | null
const bold = (value: string, extra: Record<string, unknown> = {}): AnyCell => ({ value, fontWeight: "bold", ...extra })
const text = (value: string): AnyCell => ({ value, type: String })

function widthOf(label: string, samples: string[]): number {
    const longest = Math.max(label.length, ...samples.map((s) => s.length))
    return Math.min(60, Math.max(10, longest + 2))
}

// Excel keeps typed values (numbers sum and sort, dates are dates); every text cell is a plain string, never a formula
export async function renderXlsx(table: ExportTable, chart?: ChartAttachment): Promise<Uint8Array> {
    const info: AnyCell[][] = [[bold(table.title, { fontSize: 14 })]]
    if (table.subtitle) info.push([text(table.subtitle)])
    info.push([text(`Gerado em ${formatInstantSp(table.generatedAt)}`)])
    for (const n of table.notes) info.push([text(n)])
    info.push([null])
    const headerRow = info.length
    info.push(table.columns.map((c) => bold(c.label, { backgroundColor: "#E5E7EB" })))
    const body: AnyCell[][] = table.rows.map((row) =>
        row.map((cell, i): AnyCell => {
            if (cell === null) return null
            const kind = table.columns[i]!.kind
            if (cell instanceof Date) return { value: cell, type: Date, format: "dd/mm/yyyy" }
            if (typeof cell === "number") return { value: cell, type: Number, format: kind === "money" ? '"R$" #,##0.00' : kind === "integer" ? "0" : "#,##0.##" }
            return text(cell)
        }),
    )
    const totals: AnyCell[] = table.columns.map((c, i): AnyCell => {
        if (i === 0) return bold("Total")
        const sum = table.totals.sums[c.key]
        return sum === undefined ? null : { value: sum, type: Number, format: '"R$" #,##0.00', fontWeight: "bold" }
    })
    const data = [...info, ...body, ...(Object.keys(table.totals.sums).length ? [totals] : [])]
    const columns = table.columns.map((c, i) => ({
        width: widthOf(c.label, table.rows.slice(0, 200).map((r) => (typeof r[i] === "string" ? (r[i] as string) : "0000000000"))),
    }))
    const sheets: Parameters<typeof writeExcelFile>[0] = [{ data: data as never, sheet: "Dados", columns, stickyRowsCount: headerRow + 1 } as never]
    if (chart) {
        const ct = chartTable(chart.spec)
        const rows: AnyCell[][] = [[bold(chart.spec.title, { fontSize: 14 })], [text(chart.spec.summary)], [null], ct.header.map((h) => bold(h, { backgroundColor: "#E5E7EB" })), ...ct.rows.map((r) => r.map(text))]
        sheets.push({
            data: rows as never, sheet: "Gráfico", columns: [{ width: 28 }, { width: 18 }, { width: 18 }],
            images: [{ content: Buffer.from(chart.png), contentType: "image/png", width: 700, height: 392, dpi: 96, anchor: { row: rows.length + 2, column: 1 }, title: chart.spec.title, description: chart.spec.summary }],
        } as never)
    }
    const buffer = await writeExcelFile(sheets as never).toBuffer()
    return new Uint8Array(buffer)
}
