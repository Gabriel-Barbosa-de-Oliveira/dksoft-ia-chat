import pdfmake from "pdfmake"
import { chartTable } from "../domain/chart-table.ts"
import type { ExportTable } from "../domain/export-table.ts"
import { formatCell, formatInstantSp } from "../domain/format-br.ts"
import type { ChartAttachment } from "./xlsx.ts"
import { FONT_REGULAR, FONT_SEMIBOLD } from "./fonts.ts"

let fontsReady = false
function ensureFonts(): void {
    if (fontsReady) return
    pdfmake.addFonts({ Archivo: { normal: FONT_REGULAR, bold: FONT_SEMIBOLD, italics: FONT_REGULAR, bolditalics: FONT_SEMIBOLD } })
    fontsReady = true
}

const HEADER_FILL = "#E5E7EB"

// A4 document with repeated table header, pt-BR formatting, totals row and "Página X de Y" footer
export async function renderPdf(table: ExportTable, chart?: ChartAttachment, opts: { compress?: boolean } = {}): Promise<Uint8Array> {
    ensureFonts()
    const landscape = table.columns.length > 6
    const fontSize = table.columns.length > 12 ? 6 : table.columns.length > 8 ? 7 : table.columns.length > 5 ? 8 : 9
    const right = (i: number) => table.columns[i]!.kind === "money" || table.columns[i]!.kind === "integer"
    const head = table.columns.map((c, i) => ({ text: c.label, bold: true, fillColor: HEADER_FILL, alignment: right(i) ? "right" : "left" }))
    const body = table.rows.map((row) => row.map((cell, i) => ({ text: formatCell(cell, table.columns[i]!.kind), alignment: right(i) ? "right" : "left" })))
    const hasTotals = Object.keys(table.totals.sums).length > 0
    const totalsRow = table.columns.map((c, i) => ({
        text: i === 0 ? "Total" : table.totals.sums[c.key] !== undefined ? formatCell(table.totals.sums[c.key]!, "money") : "",
        bold: true, alignment: right(i) ? "right" : "left",
    }))
    const content: unknown[] = [{ text: table.title, fontSize: 16, bold: true, margin: [0, 0, 0, 4] }]
    if (table.subtitle) content.push({ text: table.subtitle, fontSize: 10 })
    content.push({ text: `Gerado em ${formatInstantSp(table.generatedAt)} · ${table.totals.rowCount} ${table.totals.rowCount === 1 ? "linha" : "linhas"}`, fontSize: 9, color: "#4B5563", margin: [0, 0, 0, 6] })
    for (const n of table.notes) content.push({ text: n, fontSize: 9, italics: true, margin: [0, 0, 0, 2] })
    if (chart) {
        const ct = chartTable(chart.spec)
        content.push(
            { image: `data:image/png;base64,${Buffer.from(chart.png).toString("base64")}`, width: landscape ? 520 : 480, margin: [0, 8, 0, 4] },
            { text: chart.spec.summary, fontSize: 9, margin: [0, 0, 0, 6] },
            { table: { headerRows: 1, body: [ct.header.map((h) => ({ text: h, bold: true, fillColor: HEADER_FILL })), ...ct.rows] }, fontSize: 9, margin: [0, 0, 0, 12], layout: "lightHorizontalLines" },
        )
    }
    content.push({
        table: { headerRows: 1, widths: table.columns.map(() => "auto"), body: [head, ...body, ...(hasTotals ? [totalsRow] : [])] },
        layout: "lightHorizontalLines", fontSize, margin: [0, 8, 0, 0],
    })
    if (table.rows.length === 0) content.push({ text: "Nenhum registro.", margin: [0, 8, 0, 0] })

    const doc = pdfmake.createPdf({
        pageSize: "A4", pageOrientation: landscape ? "landscape" : "portrait", pageMargins: [28, 32, 28, 40],
        compress: opts.compress ?? true,
        info: { title: table.title, creator: "DKSOFT IA Chat" },
        defaultStyle: { font: "Archivo", fontSize },
        footer: (page: number, pages: number) => ({ text: `Página ${page} de ${pages}`, alignment: "center", fontSize: 8, color: "#4B5563" }),
        content,
    } as never)
    return new Uint8Array(await doc.getBuffer())
}
