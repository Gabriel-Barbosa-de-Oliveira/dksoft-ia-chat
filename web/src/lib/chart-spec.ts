import { z } from "zod";

/** Espelho de `api/src/domain/chart-spec.ts` (contrato: specs/004-exportacao-graficos/data-model.md, seção 2). */
export const ChartTypeSchema = z.enum(["bar", "line", "pie"]);
export type ChartType = z.infer<typeof ChartTypeSchema>;

export const ChartSpecSchema = z.object({
  id: z.string().uuid(),
  type: ChartTypeSchema,
  title: z.string().min(1).max(120),
  subtitle: z.string().max(160).optional(),
  xLabel: z.string().max(60).optional(),
  yLabel: z.string().max(60).optional(),
  valueKind: z.enum(["currency", "integer"]),
  categories: z.array(z.string().min(1).max(80)).min(1).max(24),
  series: z
    .array(z.object({ name: z.string().min(1).max(80), values: z.array(z.number().finite()) }))
    .min(1)
    .max(6),
  summary: z.string().min(1).max(400),
  resultId: z.string().uuid(),
  partial: z.boolean(),
});
export type ChartSpec = z.infer<typeof ChartSpecSchema>;
