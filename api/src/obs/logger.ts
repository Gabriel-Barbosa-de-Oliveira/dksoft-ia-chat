import type { FastifyServerOptions } from "fastify"
import { maskPii } from "../domain/mask-pii.ts"

export type LogSink = { write(chunk: string): void }

// pino options for Fastify: no request bodies, no auth headers, PII masked in any free text
export function buildLoggerOptions(sink?: LogSink): NonNullable<FastifyServerOptions["logger"]> {
    return {
        level: process.env.LOG_LEVEL ?? "info",
        redact: { paths: ["req.headers.authorization", "req.headers.cookie", "req.body", "res.headers['set-cookie']"], censor: "[redacted]" },
        serializers: {
            req: (req: { id?: string; method?: string; url?: string }) => ({ id: req.id, method: req.method, url: maskPii(req.url ?? "") }),
            res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
            err: (err: Error) => ({ type: err.name, message: maskPii(err.message), stack: maskPii(err.stack ?? "") }),
        },
        ...(sink ? { stream: sink } : {}),
    } as NonNullable<FastifyServerOptions["logger"]>
}

type LevelLogger = { info(o: object, m?: string): void; warn(o: object, m?: string): void; error(o: object, m?: string): void }

// free text always passes through maskPii before reaching the logger
export function safeLog(logger: LevelLogger, level: "info" | "warn" | "error", text: string, fields: Record<string, unknown> = {}): void {
    logger[level](fields, maskPii(text))
}
