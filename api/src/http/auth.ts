import { createHash, timingSafeEqual } from "node:crypto"
import type { FastifyInstance } from "fastify"
import { UnauthorizedError } from "../domain/errors.ts"

const sha256 = (s: string) => createHash("sha256").update(s).digest()

// pure: constant-time comparison (hashes first so the lengths always match)
export function verifyAccessKey(provided: string | undefined, expected: string): boolean {
    if (!provided) return false
    return timingSafeEqual(sha256(provided), sha256(expected))
}

export function bearerToken(header: string | undefined): string | undefined {
    const m = /^Bearer\s+(.+)$/i.exec(header ?? "")
    return m?.[1]
}

export function registerAuth(app: FastifyInstance, accessKey: string): void {
    app.addHook("onRequest", async (req) => {
        if (req.method === "OPTIONS") return
        if (req.url.split("?")[0] === "/health") return
        if (!verifyAccessKey(bearerToken(req.headers.authorization), accessKey)) throw new UnauthorizedError()
    })
}
