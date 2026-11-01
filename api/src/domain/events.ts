import { z } from "zod"
import { ChartSpecSchema } from "./chart-spec.ts"
import { FileDescriptorSchema } from "./file-descriptor.ts"

export const StreamErrorCode = z.enum(["timeout", "model_unavailable", "tools_unavailable", "internal_error"])
export type StreamErrorCode = z.infer<typeof StreamErrorCode>

export const StreamEventSchema = z.discriminatedUnion("event", [
    z.object({ event: z.literal("meta"), data: z.object({ requestId: z.string(), conversationId: z.string() }) }),
    z.object({
        event: z.literal("tool"),
        data: z.object({ phase: z.enum(["start", "end"]), name: z.string(), label: z.string(), ok: z.boolean().optional() }),
    }),
    z.object({
        event: z.literal("result"),
        data: z.object({
            resultId: z.string().uuid(), label: z.string(), rows: z.number().int().min(1), totalRows: z.number().int().min(1),
            capped: z.boolean(), expiresAt: z.string(),
        }).refine((d) => d.totalRows >= d.rows, "totalRows deve ser >= rows"),
    }),
    z.object({ event: z.literal("chart"), data: z.object({ chart: ChartSpecSchema }) }),
    z.object({ event: z.literal("file"), data: z.object({ file: FileDescriptorSchema }) }),
    z.object({ event: z.literal("token"), data: z.object({ text: z.string() }) }),
    z.object({
        event: z.literal("done"),
        data: z.object({ requestId: z.string(), conversationId: z.string(), model: z.string().nullable(), durationMs: z.number(), partial: z.boolean() }),
    }),
    z.object({ event: z.literal("error"), data: z.object({ requestId: z.string(), code: StreamErrorCode, message: z.string() }) }),
])
export type StreamEvent = z.infer<typeof StreamEventSchema>
