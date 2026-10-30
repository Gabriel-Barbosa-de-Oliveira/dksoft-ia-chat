import { randomUUID } from "node:crypto"
import Fastify, { type FastifyInstance } from "fastify"
import { buildLoggerOptions, type LogSink } from "../obs/logger.ts"
import { toHttpError } from "./errors.ts"
import { registerHealthRoute } from "./routes/health.ts"

export type AppOptions = {
    logSink?: LogSink
    logger?: boolean
}

declare module "fastify" {
    interface FastifyRequest { startedAt: number }
}

export function createApp(options: AppOptions = {}): FastifyInstance {
    const app = Fastify({
        logger: options.logger === false ? false : buildLoggerOptions(options.logSink),
        genReqId: () => randomUUID(), // the client-sent id is ignored
        requestIdHeader: false,
        disableRequestLogging: false,
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

    registerHealthRoute(app)
    return app
}
