import type { OutgoingHttpHeaders } from "node:http"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { safeLog } from "../../obs/logger.ts"
import type { ChatService } from "../../services/chat.service.ts"
import { toStreamError } from "../errors.ts"
import { formatSseEvent } from "../sse.ts"

export const ChatRequestSchema = z.object({
    message: z.string().trim().min(1).max(4000),
    conversationId: z.string().uuid().optional(),
})

export function registerChatRoute(app: FastifyInstance, chat: ChatService, rateLimitPerMin: number): void {
    app.post("/chat", { config: { rateLimit: { max: rateLimitPerMin, timeWindow: "1 minute" } } }, async (req, reply) => {
        const body = ChatRequestSchema.parse(req.body)
        const abort = new AbortController()
        // throws ConversationNotFoundError (404) before the stream opens
        const run = chat.start({ message: body.message, conversationId: body.conversationId, requestId: req.id, signal: abort.signal })

        reply.hijack()
        const raw = reply.raw
        raw.writeHead(200, {
            ...(reply.getHeaders() as OutgoingHttpHeaders),
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Conversation-Id": run.conversationId,
        })
        raw.on("close", () => { if (!raw.writableEnded) abort.abort() })

        const write = (chunk: string) => { if (!raw.destroyed && !raw.writableEnded) raw.write(chunk) }
        try {
            for await (const event of run.events) write(formatSseEvent(event))
        } catch (err) {
            const { code, message } = toStreamError(err)
            safeLog(req.log, "error", `chat run failed: ${err instanceof Error ? `${err.name}: ${err.message}` : "unknown"}`, { code })
            write(formatSseEvent({ event: "error", data: { requestId: req.id, code, message } }))
        }
        if (!raw.writableEnded) raw.end()
    })
}
