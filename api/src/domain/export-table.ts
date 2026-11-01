import { COLUMN_ORDER, describeColumn, type ColumnKind } from "./column-dictionary.ts"
import { maskPii } from "./mask-pii.ts"
import { brDate, subjectTitle, type ResultFilters } from "./result-label.ts"

export type Cell = string | number | Date | null
export type ExportColumn = { key: string; label: string; kind: ColumnKind }
export type ExportTable = {
    title: string
    subtitle: string
    generatedAt: Date
    columns: ExportColumn[]
    rows: Cell[][]
    totals: { rowCount: number; sums: Record<string, number> }
    notes: string[]
    maskedPersonalData: boolean
}
export type TableSource = { toolName: string; filters: ResultFilters; rows: Record<string, unknown>[]; totalRows: number; capped: boolean }

const FREE_TEXT = ["historico"]

function flatten(v: unknown): string {
    if (v === null || v === undefined) return ""
    if (typeof v === "string") return v
    if (typeof v === "number" || typeof v === "boolean") return String(v)
    if (Array.isArray(v)) return v.map(flatten).filter(Boolean).join("; ")
    if (typeof v === "object") return Object.values(v as Record<string, unknown>).map(flatten).filter(Boolean).join(", ")
    return ""
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/
function toDate(v: string): Date | null {
    const m = ISO_DATE.exec(v)
    if (!m) return null
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    return Number.isNaN(d.getTime()) ? null : d
}
function toNumber(v: unknown): number | null {
    if (typeof v === "number") return Number.isFinite(v) ? v : null
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
    return null
}

function orderedKeys(rows: Record<string, unknown>[]): string[] {
    const seen = new Set<string>()
    for (const r of rows) for (const k of Object.keys(r)) seen.add(k)
    const known = COLUMN_ORDER.filter((k) => seen.has(k))
    const rest = [...seen].filter((k) => !COLUMN_ORDER.includes(k)).sort((a, b) => a.localeCompare(b))
    return [...known, ...rest]
}

function subtitleOf(f: ResultFilters): string {
    const parts: string[] = []
    if (f.dataInicial && f.dataFinal) parts.push(`Período: ${brDate(f.dataInicial)} a ${brDate(f.dataFinal)}`)
    if (f.aluno) parts.push(`Aluno: ${f.aluno}`)
    if (f.pacote) parts.push(`Pacote: ${f.pacote}`)
    return parts.join(" · ")
}

// pure: typed cells (numbers stay numbers, dates stay dates), exact totals in cents, optional PII masking
export function buildExportTable(src: TableSource, opts: { maskPersonalData: boolean; now: Date }): ExportTable {
    const keys = orderedKeys(src.rows)
    const columns: ExportColumn[] = keys.map((key) => {
        const info = describeColumn(key)
        return { key, label: info.label, kind: info.kind }
    })
    let masked = false
    const centsByCol: Record<string, number> = {}
    const rows: Cell[][] = src.rows.map((row) =>
        columns.map((col): Cell => {
            const v = row[col.key]
            if (v === null || v === undefined || v === "") return null
            const info = describeColumn(col.key)
            if (col.kind === "money" || col.kind === "integer") {
                const n = toNumber(v)
                if (n !== null) {
                    if (col.kind === "money") centsByCol[col.key] = (centsByCol[col.key] ?? 0) + Math.round(n * 100)
                    return n
                }
            }
            if ((col.kind === "date" || col.kind === "datetime") && typeof v === "string") {
                const d = toDate(v)
                if (d) return d
            }
            let text = flatten(v)
            if (text === "") return null
            const nested = typeof v === "object"
            if (opts.maskPersonalData && (info.sensitive || nested || FREE_TEXT.includes(col.key))) {
                const m = maskPii(text)
                if (m !== text) masked = true
                text = m
            }
            return text
        }),
    )
    const sums: Record<string, number> = {}
    for (const [k, cents] of Object.entries(centsByCol)) sums[k] = cents / 100
    const hasSensitive = columns.some((c) => describeColumn(c.key).sensitive)
    const notes: string[] = []
    if (src.capped) notes.push(`Resultado parcial: a consulta devolveu ${src.totalRows} registros e este arquivo traz os ${src.rows.length} primeiros.`)
    if (opts.maskPersonalData && (masked || hasSensitive)) notes.push("Dados pessoais (CPF, e-mail e telefone) estão mascarados.")
    return {
        title: subjectTitle(src.toolName), subtitle: subtitleOf(src.filters), generatedAt: opts.now, columns, rows,
        totals: { rowCount: rows.length, sums }, notes, maskedPersonalData: opts.maskPersonalData && (masked || hasSensitive),
    }
}
