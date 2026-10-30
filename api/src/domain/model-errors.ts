import { ChatTimeoutError, ModelUnavailableError, ToolsUnavailableError } from "./errors.ts"

const NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_HEADERS_TIMEOUT"])

type ErrLike = { name?: string; status?: unknown; statusCode?: unknown; code?: unknown; response?: { status?: unknown }; cause?: unknown; message?: unknown }

function statusOf(err: ErrLike): number | undefined {
    for (const v of [err.status, err.statusCode, err.response?.status]) if (typeof v === "number") return v
    return undefined
}

// pure: 408, 429, >= 500 and network/timeout codes are worth retrying; 400/401/403/404 are not
export function isTransientModelError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false
    const e = err as ErrLike
    const status = statusOf(e)
    if (status !== undefined) return status === 408 || status === 429 || status >= 500
    if (typeof e.code === "string" && NETWORK_CODES.has(e.code)) return true
    if (e.name === "TimeoutError") return true
    return e.cause ? isTransientModelError(e.cause) : false
}

// pure: raw error from the agent run -> domain error (or the original when unknown)
export function classifyAgentError(err: unknown): unknown {
    if (err instanceof ChatTimeoutError || err instanceof ModelUnavailableError || err instanceof ToolsUnavailableError) return err
    if (!err || typeof err !== "object") return err
    const e = err as ErrLike
    if (e.name === "TimeoutError") return new ChatTimeoutError()
    if (e.name === "AbortError") return err
    if (e.name === "ToolException" || e.name === "McpError" || e.name === "ToolInvocationError") return new ToolsUnavailableError({ cause: err })
    if (statusOf(e) !== undefined || (typeof e.code === "string" && NETWORK_CODES.has(e.code))) return new ModelUnavailableError({ cause: err })
    return err
}
