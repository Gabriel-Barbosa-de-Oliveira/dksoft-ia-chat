import { z } from "zod"

export const StreamErrorCode = z.enum(["timeout", "model_unavailable", "tools_unavailable", "internal_error"])
export type StreamErrorCode = z.infer<typeof StreamErrorCode>

export const StreamEventSchema = z.discriminatedUnion("event", [
    z.object({ event: z.literal("meta"), data: z.object({ requestId: z.string(), conversationId: z.string() }) }),
    z.object({
        event: z.literal("tool"),
        data: z.object({ phase: z.enum(["start", "end"]), name: z.string(), label: z.string(), ok: z.boolean().optional() }),
    }),
    z.object({ event: z.literal("token"), data: z.object({ text: z.string() }) }),
    z.object({
        event: z.literal("done"),
        data: z.object({ requestId: z.string(), conversationId: z.string(), model: z.string().nullable(), durationMs: z.number(), partial: z.boolean() }),
    }),
    z.object({ event: z.literal("error"), data: z.object({ requestId: z.string(), code: StreamErrorCode, message: z.string() }) }),
])
export type StreamEvent = z.infer<typeof StreamEventSchema>
