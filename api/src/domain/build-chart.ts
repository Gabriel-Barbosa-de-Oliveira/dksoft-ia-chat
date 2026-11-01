import type { ChartRequest } from "./chart-request.ts"
import { summarizeChart } from "./chart-summary.ts"
import { MAX_CATEGORIES, MAX_PIE_SLICES, MAX_SERIES, validateChartSpec, type ChartSpec } from "./chart-spec.ts"
import { describeColumn, SENSITIVE_FIELDS } from "./column-dictionary.ts"
import { ChartNotPossibleError } from "./errors.ts"
import { brDate, type ResultFilters } from "./result-label.ts"

export type ChartSource = { id: string; rows: Record<string, unknown>[]; filters: ResultFilters; capped: boolean }

const NONE = "Sem informação"
const OTHERS = "Outros"
const ISO = /^(\d{4})-(\d{2})-(\d{2})/

type Gran = "day" | "week" | "month"
type Bucket = { key: string; label: string }

function numberOf(v: unknown): number | null {
    if (typeof v === "number") return Number.isFinite(v) ? v : null
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
    return null
}

function mondayOf(y: number, m: number, d: number): Date {
    const dt = new Date(Date.UTC(y, m - 1, d))
    const dow = (dt.getUTCDay() + 6) % 7
    dt.setUTCDate(dt.getUTCDate() - dow)
    return dt
}
const p2 = (n: number) => String(n).padStart(2, "0")

function bucketOf(value: string, gran: Gran): Bucket {
    const m = ISO.exec(value)!
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
    if (gran === "month") return { key: `${y}-${p2(mo)}`, label: `${p2(mo)}/${y}` }
    if (gran === "week") {
        const mon = mondayOf(y, mo, d)
        return { key: mon.toISOString().slice(0, 10), label: `Sem ${p2(mon.getUTCDate())}/${p2(mon.getUTCMonth() + 1)}` }
    }
    return { key: `${y}-${p2(mo)}-${p2(d)}`, label: `${p2(d)}/${p2(mo)}` }
}

const fieldsOf = (rows: Record<string, unknown>[]) => [...new Set(rows.flatMap((r) => Object.keys(r)))]

function checkField(field: string, fields: string[], role: string): void {
    if (SENSITIVE_FIELDS.includes(field)) throw new ChartNotPossibleError("Não é permitido agrupar por dados de contato.")
    if (!fields.includes(field)) throw new ChartNotPossibleError(`O campo '${field}' não existe neste resultado. Campos disponíveis: ${fields.filter((f) => !SENSITIVE_FIELDS.includes(f)).join(", ")}.`)
    void role
}

function isDateField(rows: Record<string, unknown>[], field: string): boolean {
    const vals = rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined && v !== "")
    return vals.length > 0 && vals.every((v) => typeof v === "string" && ISO.test(v))
}

function pickGranularity(rows: Record<string, unknown>[], field: string, wanted: Gran | undefined): Gran {
    if (wanted) return wanted
    for (const g of ["day", "week", "month"] as const) {
        const keys = new Set(rows.map((r) => r[field]).filter((v): v is string => typeof v === "string" && ISO.test(v)).map((v) => bucketOf(v, g).key))
        if (keys.size <= MAX_CATEGORIES) return g
    }
    return "month"
}

// pure: aggregates ALL rows of the result into a validated ChartSpec (sums in integer cents)
export function buildChartSpec(result: ChartSource, req: ChartRequest, deps: { newId: () => string }): ChartSpec {
    const { rows } = result
    if (rows.length === 0) throw new ChartNotPossibleError("O resultado não tem registros; um gráfico não ajudaria. Responda em texto.")
    const fields = fieldsOf(rows)
    checkField(req.groupBy, fields, "groupBy")
    if (req.splitBy) checkField(req.splitBy, fields, "splitBy")
    const sumField = req.measure.kind === "sum" ? req.measure.field : undefined
    if (sumField !== undefined) {
        if (!fields.includes(sumField)) throw new ChartNotPossibleError(`O campo '${sumField}' não existe neste resultado. Campos disponíveis: ${fields.filter((f) => !SENSITIVE_FIELDS.includes(f)).join(", ")}.`)
        if (!rows.some((r) => numberOf(r[sumField]) !== null)) throw new ChartNotPossibleError(`O campo '${sumField}' não é numérico; use contagem ou outro campo.`)
    }

    const dateGroup = isDateField(rows, req.groupBy)
    const gran = dateGroup ? pickGranularity(rows, req.groupBy, req.granularity) : undefined
    const catOf = (r: Record<string, unknown>): Bucket => {
        const v = r[req.groupBy]
        if (v === null || v === undefined || v === "") return { key: `~${NONE}`, label: NONE }
        if (gran && typeof v === "string" && ISO.test(v)) return bucketOf(v, gran)
        const s = typeof v === "object" ? JSON.stringify(v) : String(v)
        return { key: s, label: s.length > 80 ? `${s.slice(0, 79)}…` : s }
    }
    const splitOf = (r: Record<string, unknown>): string => {
        if (!req.splitBy) return "__single__"
        const v = r[req.splitBy]
        return v === null || v === undefined || v === "" ? NONE : String(v).slice(0, 80)
    }

    // cents (or counts) per category x series
    const cells = new Map<string, Map<string, number>>() // category key -> series -> amount
    const labels = new Map<string, string>()
    const seriesTotals = new Map<string, number>()
    for (const r of rows) {
        const c = catOf(r)
        const s = splitOf(r)
        const amount = sumField !== undefined ? (numberOf(r[sumField]) !== null ? Math.round(numberOf(r[sumField])! * 100) : 0) : 1
        labels.set(c.key, c.label)
        const row = cells.get(c.key) ?? new Map<string, number>()
        row.set(s, (row.get(s) ?? 0) + amount)
        cells.set(c.key, row)
        seriesTotals.set(s, (seriesTotals.get(s) ?? 0) + amount)
    }

    // series: top MAX_SERIES (rest folded into Outros)
    let seriesNames = [...seriesTotals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
    const foldSeries = seriesNames.length > MAX_SERIES
    if (foldSeries) seriesNames = seriesNames.slice(0, MAX_SERIES - 1)
    const amountOf = (catKey: string, s: string) => {
        if (s === OTHERS && foldSeries) {
            let sum = 0
            for (const [name, v] of cells.get(catKey) ?? []) if (!seriesNames.includes(name)) sum += v
            return sum
        }
        return cells.get(catKey)?.get(s) ?? 0
    }
    const finalSeries = foldSeries ? [...seriesNames, OTHERS] : seriesNames
    const catTotal = (k: string) => finalSeries.reduce((n, s) => n + amountOf(k, s), 0)

    let catKeys = [...cells.keys()]
    const chronological = dateGroup && req.sort !== "value"
    const cmpX = (a: string, b: string) => (a.startsWith("~") ? 1 : b.startsWith("~") ? -1 : dateGroup ? a.localeCompare(b) : (labels.get(a) ?? a).localeCompare(labels.get(b) ?? b, "pt-BR"))
    const byValue = (a: string, b: string) => catTotal(b) - catTotal(a) || cmpX(a, b)
    const maxCats = req.type === "pie" ? MAX_PIE_SLICES : MAX_CATEGORIES
    const limit = Math.min(req.limit ?? maxCats, maxCats)
    if (chronological) catKeys.sort(cmpX)
    else if (req.sort === "x") catKeys.sort(cmpX)
    else catKeys.sort(byValue)

    let othersTotals: number[] | undefined
    if (catKeys.length > limit) {
        if (dateGroup && req.limit === undefined && req.type !== "pie") throw new ChartNotPossibleError(`Há ${catKeys.length} períodos; reduza o intervalo ou use granularity maior.`)
        const keep = new Set([...catKeys].sort(byValue).slice(0, limit - 1))
        const dropped = catKeys.filter((k) => !keep.has(k))
        othersTotals = finalSeries.map((s) => dropped.reduce((n, k) => n + amountOf(k, s), 0))
        catKeys = catKeys.filter((k) => keep.has(k))
    }
    if (catKeys.length + (othersTotals ? 1 : 0) < 2 && !(req.type === "pie" && catKeys.length >= 1)) {
        throw new ChartNotPossibleError("Os dados têm só 1 categoria; um gráfico não ajudaria. Responda em texto.")
    }

    const currency = sumField !== undefined && (describeColumn(sumField).kind === "money" || rows.some((r) => { const n = numberOf(r[sumField]); return n !== null && !Number.isInteger(n) }))
    const scale = (cents: number) => (sumField !== undefined && currency ? cents / 100 : sumField !== undefined ? cents / 100 : cents)
    const categories = [...catKeys.map((k) => labels.get(k) ?? k), ...(othersTotals ? [OTHERS] : [])]
    const series = finalSeries.map((s, i) => ({
        name: s === "__single__" ? (sumField !== undefined ? describeColumn(sumField).label : "Quantidade") : s,
        values: [...catKeys.map((k) => scale(amountOf(k, s))), ...(othersTotals ? [scale(othersTotals[i]!)] : [])],
    }))

    const f = result.filters
    const subtitle = f.dataInicial && f.dataFinal ? `${brDate(f.dataInicial)} a ${brDate(f.dataFinal)}` : undefined
    const draft = {
        id: deps.newId(), type: req.type, title: req.title, ...(subtitle ? { subtitle } : {}),
        ...(req.type === "pie" ? {} : { xLabel: describeColumn(req.groupBy).label, yLabel: sumField !== undefined ? describeColumn(sumField).label : "Quantidade" }),
        valueKind: (currency ? "currency" : "integer") as ChartSpec["valueKind"], categories, series, resultId: result.id, partial: result.capped,
    }
    return validateChartSpec({ ...draft, summary: summarizeChart({ ...draft, summary: "" }) })
}
