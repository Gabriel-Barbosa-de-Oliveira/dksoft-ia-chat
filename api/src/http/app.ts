import { randomUUID } from "node:crypto"
import Fastify, { type FastifyInstance } from "fastify"
import { buildLoggerOptions, type LogSink } from "../obs/logger.ts"
import rateLimit from "@fastify/rate-limit"
import { registerAuth } from "./auth.ts"
import { registerCors } from "./cors.ts"
import { toHttpError } from "./errors.ts"
import type { ChatService } from "../services/chat.service.ts"
import type { ConversationStore } from "../services/conversation-store.repository.ts"
import { registerChatRoute } from "./routes/chat.ts"
import { registerConversationRoutes } from "./routes/conversations.ts"
import { registerHealthRoute } from "./routes/health.ts"

export type AppOptions = {
    logSink?: LogSink
    logger?: boolean
    chat?: ChatService
    conversations?: ConversationStore
    chatRateLimitPerMin?: number
    accessKey?: string
    corsOrigins?: string[]
    trustProxy?: boolean
}

declare module "fastify" {
    interface FastifyRequest { startedAt: number }
}

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
    const app = Fastify({
        logger: options.logger === false ? false : buildLoggerOptions(options.logSink),
        genReqId: () => randomUUID(), // the client-sent id is ignored
        requestIdHeader: false,
        trustProxy: options.trustProxy ?? false,
        forceCloseConnections: true,
    })

    app.decorateRequest("startedAt", 0)
    app.addHook("onRequest", async (req, reply) => {
        req.startedAt = Date.now()
        reply.header("X-Request-Id", req.id)
    })

    app.setErrorHandler((err, req, reply) => {
        const { status, body } = toHttpError(err, req.id)
        if (status >= 500) req.log.error({ err }, "unhandled error")
        void reply.status(status).send(body)
    })
    app.setNotFoundHandler((req, reply) => {
        void reply.status(404).send({ requestId: req.id, error: "not_found" })
    })

    // order matters: CORS first (so even 401/403/429 carry CORS headers), then auth, then rate limit
    if (options.corsOrigins) await registerCors(app, options.corsOrigins)
    if (options.accessKey) registerAuth(app, options.accessKey)
    await app.register(rateLimit, {
        global: false,
        errorResponseBuilder: (req, ctx) => ({ statusCode: 429, retryAfterSeconds: Math.max(1, Math.ceil(ctx.ttl / 1000)), requestId: req.id }),
    })

    registerHealthRoute(app)
    if (options.chat) registerChatRoute(app, options.chat, options.chatRateLimitPerMin ?? 30)
    if (options.conversations) registerConversationRoutes(app, options.conversations)
    return app
}
