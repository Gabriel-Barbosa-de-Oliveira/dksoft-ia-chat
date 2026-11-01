import type { ChartSpec } from "./chart-spec.ts"

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const INT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })
const PCT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })

export const formatChartValue = (kind: ChartSpec["valueKind"], n: number) => (kind === "currency" ? BRL.format(n) : INT.format(n)).replace(/ /g, " ")

const TYPE_NAME = { bar: "barras", line: "linhas", pie: "pizza" } as const

// pure: alternative text (<= 400 chars) generated from the spec itself
export function summarizeChart(spec: Omit<ChartSpec, "summary"> | ChartSpec): string {
    const n = spec.categories.length
    const totals = spec.categories.map((_, i) => spec.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))
    let max = 0
    let min = 0
    totals.forEach((t, i) => { if (t > totals[max]!) max = i; if (t < totals[min]!) min = i })
    const f = (v: number) => formatChartValue(spec.valueKind, v)
    let text: string
    if (spec.type === "pie") {
        const all = totals.reduce((a, b) => a + b, 0)
        const share = all > 0 ? ` (${PCT.format((totals[max]! / all) * 100)}%)` : ""
        text = `Gráfico de pizza com ${n} ${n === 1 ? "fatia" : "fatias"}; maior fatia: ${spec.categories[max]}, ${f(totals[max]!)}${share}.`
    } else {
        const series = spec.series.length > 1 ? ` e ${spec.series.length} séries` : ""
        text = `Gráfico de ${TYPE_NAME[spec.type]} com ${n} ${n === 1 ? "categoria" : "categorias"}${series}; maior valor: ${f(totals[max]!)} em ${spec.categories[max]}`
        text += n > 1 ? `; menor: ${f(totals[min]!)} em ${spec.categories[min]}.` : "."
    }
    return text.length <= 400 ? text : `${text.slice(0, 397)}...`
}
