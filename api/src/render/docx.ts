import { AlignmentType, Document, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx"
import { chartTable } from "../domain/chart-table.ts"
import type { ExportTable } from "../domain/export-table.ts"
import { formatCell, formatInstantSp } from "../domain/format-br.ts"
import type { ChartAttachment } from "./xlsx.ts"

const FONT = "Archivo" // Word falls back to its default font when Archivo is not installed

const cell = (text: string, opts: { bold?: boolean; right?: boolean; fill?: string; size?: number } = {}) =>
    new TableCell({
        shading: opts.fill ? { fill: opts.fill } : undefined,
        children: [new Paragraph({ alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text, bold: opts.bold, font: FONT, size: opts.size ?? 18 })] })],
    })

const para = (text: string, o: { size?: number; bold?: boolean; italics?: boolean; after?: number } = {}) =>
    new Paragraph({ spacing: { after: o.after ?? 60 }, children: [new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, italics: o.italics })] })

// title, period, notes, optional chart + chart data, then the table with repeated header, right-aligned numbers and totals
export async function renderDocx(table: ExportTable, chart?: ChartAttachment): Promise<Uint8Array> {
    const landscape = table.columns.length > 6
    const size = table.columns.length > 10 ? 12 : table.columns.length > 6 ? 14 : 18
    const right = (i: number) => table.columns[i]!.kind === "money" || table.columns[i]!.kind === "integer"
    const children: (Paragraph | Table)[] = [para(table.title, { size: 32, bold: true })]
    if (table.subtitle) children.push(para(table.subtitle))
    children.push(para(`Gerado em ${formatInstantSp(table.generatedAt)} · ${table.totals.rowCount} ${table.totals.rowCount === 1 ? "linha" : "linhas"}`, { size: 18, after: 120 }))
    for (const n of table.notes) children.push(para(n, { size: 18, italics: true }))
    if (chart) {
        const w = landscape ? 620 : 560
        children.push(new Paragraph({ children: [new ImageRun({ type: "png", data: Buffer.from(chart.png), transformation: { width: w, height: Math.round(w * 0.56) }, altText: { title: chart.spec.title, description: chart.spec.summary, name: "grafico" } })] }))
        children.push(para(chart.spec.summary, { size: 18, after: 120 }))
        const ct = chartTable(chart.spec)
        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ tableHeader: true, children: ct.header.map((h) => cell(h, { bold: true, fill: "E5E7EB" })) }), ...ct.rows.map((r) => new TableRow({ children: r.map((v) => cell(v)) }))],
        }))
        children.push(para("", { after: 200 }))
    }
    const hasTotals = Object.keys(table.totals.sums).length > 0
    const rows = [
        new TableRow({ tableHeader: true, children: table.columns.map((c, i) => cell(c.label, { bold: true, right: right(i), fill: "E5E7EB", size })) }),
        ...table.rows.map((r) => new TableRow({ children: r.map((v, i) => cell(formatCell(v, table.columns[i]!.kind), { right: right(i), size })) })),
        ...(hasTotals ? [new TableRow({ children: table.columns.map((c, i) => cell(i === 0 ? "Total" : table.totals.sums[c.key] !== undefined ? formatCell(table.totals.sums[c.key]!, "money") : "", { bold: true, right: right(i), size })) })] : []),
    ]
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
    if (table.rows.length === 0) children.push(para("Nenhum registro."))
    const doc = new Document({
        creator: "DKSOFT IA Chat", title: table.title,
        sections: [{ properties: { page: { size: { orientation: landscape ? "landscape" as never : "portrait" as never } } }, children }],
    })
    return new Uint8Array(await Packer.toBuffer(doc))
}
