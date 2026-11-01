import { formatChartValue } from "./chart-summary.ts"
import type { ChartSpec } from "./chart-spec.ts"

// pure: the chart's data as a text table (same values that the chart draws)
export function chartTable(spec: ChartSpec): { header: string[]; rows: string[][] } {
    const f = (n: number) => formatChartValue(spec.valueKind, n)
    if (spec.type === "pie") {
        const total = spec.series[0]!.values.reduce((a, b) => a + b, 0)
        return {
            header: [spec.xLabel ?? "Categoria", spec.series[0]!.name, "Participação"],
            rows: spec.categories.map((c, i) => [c, f(spec.series[0]!.values[i]!), total > 0 ? `${Math.round((spec.series[0]!.values[i]! / total) * 100)}%` : "0%"]),
        }
    }
    return {
        header: [spec.xLabel ?? "Categoria", ...spec.series.map((s) => s.name)],
        rows: spec.categories.map((c, i) => [c, ...spec.series.map((s) => f(s.values[i]!))]),
    }
}
