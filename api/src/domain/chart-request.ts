import { z } from "zod"
import { ChartTypeSchema } from "./chart-spec.ts"

export const ChartRequestSchema = z.object({
    resultId: z.string().uuid().optional().describe("Resultado de onde vêm os dados; omita para usar o mais recente"),
    type: ChartTypeSchema.describe("bar = barras, line = linhas (evolução no tempo), pie = pizza (distribuição, até 8 fatias)"),
    title: z.string().min(1).max(120).describe("Título curto do gráfico"),
    groupBy: z.string().min(1).describe("Campo do registro que vira as categorias (ex.: data_pagamento, pacote, banco)"),
    granularity: z.enum(["day", "week", "month"]).optional().describe("Só para campo de data: agrupa por dia, semana ou mês"),
    measure: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("count") }),
        z.object({ kind: z.literal("sum"), field: z.string().min(1).describe("Campo numérico a somar, ex.: valor_pago") }),
    ]).describe("O que medir: contagem de registros ou soma de um campo"),
    splitBy: z.string().min(1).optional().describe("Segundo campo que vira séries (até 6); não vale para pizza"),
    sort: z.enum(["x", "value"]).optional(),
    limit: z.number().int().min(1).max(24).optional().describe("Mostra só as N maiores categorias; o resto vira Outros"),
}).superRefine((r, ctx) => {
    if (r.type === "pie" && r.splitBy) ctx.addIssue({ code: "custom", message: "A pizza não aceita splitBy", path: ["splitBy"] })
    if (r.granularity && r.measure === undefined) ctx.addIssue({ code: "custom", message: "granularity exige measure", path: ["granularity"] })
})
export type ChartRequest = z.infer<typeof ChartRequestSchema>
