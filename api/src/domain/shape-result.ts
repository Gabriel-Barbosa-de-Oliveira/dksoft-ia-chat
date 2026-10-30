import { z } from "zod"

export type ShapeLimits = { maxRows: number; maxChars: number }
export type ShapedResult = { text: string; truncated: boolean }

const Row = z.record(z.unknown())
const MONEY_FIELDS = ["valor_pago", "valor"] as const
// personal contact data is dropped from list_* results (constitution VI); find_* keep it
const CONTACT_FIELDS = ["cpf", "email", "telefone", "celular", "telefone_contato"] as const

const isListTool = (toolName: string) => /(^|_)list_/.test(toolName)

function stripContact(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) if (!(CONTACT_FIELDS as readonly string[]).includes(k)) out[k] = v
    return out
}

// exact sums in integer cents
function sums(rows: Record<string, unknown>[]): Record<string, number> {
    const out: Record<string, number> = {}
    for (const field of MONEY_FIELDS) {
        let cents = 0
        let seen = false
        for (const r of rows) {
            const v = r[field]
            if (typeof v === "number" && Number.isFinite(v)) { cents += Math.round(v * 100); seen = true }
        }
        if (seen) out[field] = cents / 100
    }
    return out
}

function cutText(text: string, maxChars: number): ShapedResult {
    return text.length <= maxChars ? { text, truncated: false } : { text: `${text.slice(0, maxChars)}…[texto cortado por tamanho]`, truncated: true }
}

// pure: turns the raw tool text into a bounded JSON summary with exact totals
export function shapeToolResult(toolName: string, rawText: string, limits: ShapeLimits): ShapedResult {
    let json: unknown
    try { json = JSON.parse(rawText) } catch { return cutText(rawText, limits.maxChars) }

    let rows: Record<string, unknown>[] | undefined
    let context: Record<string, unknown> = {}
    if (Array.isArray(json)) {
        const parsed = z.array(Row).safeParse(json)
        if (parsed.success) rows = parsed.data
    } else if (json && typeof json === "object") {
        const entries = Object.entries(json as Record<string, unknown>)
        const arrays = entries.filter(([, v]) => Array.isArray(v))
        if (arrays.length === 1) {
            const parsed = z.array(Row).safeParse(arrays[0]![1])
            if (parsed.success) {
                rows = parsed.data
                context = Object.fromEntries(entries.filter(([k]) => k !== arrays[0]![0]))
            }
        }
    }
    if (!rows) return cutText(rawText, limits.maxChars)

    const cleaned = isListTool(toolName) ? rows.map(stripContact) : rows
    const total = cleaned.length
    const somas = sums(cleaned)
    let keep = Math.min(limits.maxRows, total)
    const build = (n: number) => {
        const registros = cleaned.slice(0, n)
        const truncado = n < total
        return JSON.stringify({ ...context, total, ...(Object.keys(somas).length ? { somas } : {}), registros, truncado, omitidos: total - n })
    }
    let text = build(keep)
    while (text.length > limits.maxChars && keep > 0) {
        keep = Math.max(0, Math.floor(keep * 0.8) === keep ? keep - 1 : Math.floor(keep * 0.8))
        text = build(keep)
    }
    return { text, truncated: keep < total }
}
