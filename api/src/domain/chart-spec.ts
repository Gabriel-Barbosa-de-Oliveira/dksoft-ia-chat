import { z } from "zod"
import { ChartNotPossibleError } from "./errors.ts"

export const MAX_SERIES = 6
export const MAX_CATEGORIES = 24
export const MAX_PIE_SLICES = 8

export const ChartTypeSchema = z.enum(["bar", "line", "pie"])
export type ChartType = z.infer<typeof ChartTypeSchema>

export const ChartSpecSchema = z.object({
    id: z.string().uuid(),
    type: ChartTypeSchema,
    title: z.string().min(1).max(120),
    subtitle: z.string().max(160).optional(),
    xLabel: z.string().max(60).optional(),
    yLabel: z.string().max(60).optional(),
    valueKind: z.enum(["currency", "integer"]),
    categories: z.array(z.string().min(1).max(80)).min(1).max(MAX_CATEGORIES),
    series: z.array(z.object({ name: z.string().min(1).max(80), values: z.array(z.number().finite()) })).min(1).max(MAX_SERIES),
    summary: z.string().min(1).max(400),
    resultId: z.string().uuid(),
    partial: z.boolean(),
})
export type ChartSpec = z.infer<typeof ChartSpecSchema>

const decimals = (n: number) => Math.abs(Math.round(n * 100) / 100 - n) < 1e-9

// pure: validates the shape and the cross-field rules; throws ChartNotPossibleError
export function validateChartSpec(input: unknown): ChartSpec {
    const parsed = ChartSpecSchema.safeParse(input)
    if (!parsed.success) throw new ChartNotPossibleError(`Gráfico inválido: ${parsed.error.issues[0]?.message ?? "formato"}`)
    const s = parsed.data
    if (new Set(s.categories).size !== s.categories.length) throw new ChartNotPossibleError("Categorias repetidas no gráfico")
    if (new Set(s.series.map((x) => x.name)).size !== s.series.length) throw new ChartNotPossibleError("Séries repetidas no gráfico")
    for (const serie of s.series) {
        if (serie.values.length !== s.categories.length) throw new ChartNotPossibleError("Quantidade de valores diferente da de categorias")
        if (s.valueKind === "currency" && !serie.values.every(decimals)) throw new ChartNotPossibleError("Valores em reais com mais de 2 casas decimais")
    }
    if (s.type === "pie") {
        if (s.series.length !== 1) throw new ChartNotPossibleError("A pizza aceita uma única série")
        if (s.categories.length > MAX_PIE_SLICES) throw new ChartNotPossibleError(`A pizza aceita até ${MAX_PIE_SLICES} fatias`)
        if (s.series[0]!.values.some((v) => v < 0)) throw new ChartNotPossibleError("A pizza não aceita valores negativos")
    }
    return s
}
