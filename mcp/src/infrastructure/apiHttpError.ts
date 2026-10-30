import type { z } from "zod";

export class ApiHttpError extends Error {
    readonly status: number
    readonly retryAfterSeconds?: number
    constructor(status: number, message: string, retryAfterSeconds?: number) {
        super(message)
        this.name = "ApiHttpError"
        this.status = status
        if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds
    }
}

type ResponseLike = { ok: boolean; status: number; headers: { get(name: string): string | null }; text(): Promise<string> }

function messageFromBody(body: string): string {
    try {
        const parsed = JSON.parse(body) as { mensagem?: unknown; message?: unknown }
        const msg = parsed.mensagem ?? parsed.message
        if (typeof msg === "string") return msg
    } catch {
        // not JSON
    }
    return body.length > 200 ? `${body.slice(0, 200)}…` : body
}

// throws ApiHttpError when the response is not 2xx; the message never includes request headers (token)
export async function assertOk(res: ResponseLike): Promise<void> {
    if (res.ok) return
    const raw = res.headers.get("Retry-After")
    const retry = raw !== null && /^\d+$/.test(raw.trim()) ? Number(raw) : undefined
    const body = (await res.text().catch(() => "")).trim()
    const detail = body ? messageFromBody(body) : "no body"
    const suffix = retry !== undefined ? ` (Retry-After: ${retry}s)` : ""
    throw new ApiHttpError(res.status, `HTTP ${res.status}: ${detail}${suffix}`, retry)
}

// validates the JSON with zod; the error names the failing field path, never the raw body
export function parseResponse<S extends z.ZodTypeAny>(schema: S, json: unknown): z.infer<S> {
    const result = schema.safeParse(json)
    if (!result.success) {
        const issue = result.error.issues[0]
        const path = issue?.path.join(".") || "(root)"
        throw new Error(`Unexpected response shape from DKSOFT API: ${path}`)
    }
    return result.data
}
