import cors from "@fastify/cors"
import type { FastifyInstance } from "fastify"
import { OriginNotAllowedError } from "../domain/errors.ts"

// exact allowlist: a browser origin outside the list gets 403 (request and preflight); no Origin passes
export async function registerCors(app: FastifyInstance, origins: string[]): Promise<void> {
    app.addHook("onRequest", async (req) => {
        const origin = req.headers.origin
        if (origin !== undefined && !origins.includes(origin)) throw new OriginNotAllowedError()
    })
    await app.register(cors, {
        origin: origins,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Authorization", "Content-Type"],
        exposedHeaders: ["X-Request-Id", "X-Conversation-Id"],
        maxAge: 600,
    })
}
