import type { ChartSpec } from "../../domain/chart-spec.ts"

const U = "11111111-1111-4111-8111-111111111111"
export const sample = (over: Partial<ChartSpec> = {}): ChartSpec => ({
    id: U, type: "bar", title: "Recebimentos por semana — ação", valueKind: "currency", categories: ["Sem 1", "Sem 2", "Sem 3"],
    series: [{ name: "Total recebido", values: [8200.5, 9100, 12300] }], summary: "Resumo do gráfico", resultId: U, partial: false, ...over,
})
