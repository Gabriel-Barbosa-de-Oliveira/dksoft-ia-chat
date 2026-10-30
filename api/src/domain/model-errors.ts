import { ChatTimeoutError, ModelUnavailableError, ToolsUnavailableError } from "./errors.ts"

const NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_HEADERS_TIMEOUT"])

const CONNECTION_NAMES = new Set(["APIConnectionError", "APIConnectionTimeoutError"])
const isConnectionError = (e: ErrLike) => (typeof e.name === "string" && CONNECTION_NAMES.has(e.name)) || (typeof e.message === "string" && /^connection error\.?$/i.test(e.message))

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
    if (e.name === "TimeoutError" || isConnectionError(e)) return true
    return e.cause ? isTransientModelError(e.cause) : false
}

function causeChain(err: unknown): ErrLike[] {
    const out: ErrLike[] = []
    let cur: unknown = err
    for (let i = 0; i < 4 && cur && typeof cur === "object"; i++) {
        out.push(cur as ErrLike)
        cur = (cur as ErrLike).cause
    }
    return out
}

// pure: raw error from the agent run -> domain error (or the original when unknown); looks through `cause` wrappers
export function classifyAgentError(err: unknown): unknown {
    if (err instanceof ChatTimeoutError || err instanceof ModelUnavailableError || err instanceof ToolsUnavailableError) return err
    const chain = causeChain(err)
    if (chain.some((e) => e.name === "TimeoutError")) return new ChatTimeoutError()
    if (chain.some((e) => e.name === "AbortError")) return err
    if (chain.some((e) => e.name === "ToolException" || e.name === "McpError" || e.name === "ToolInvocationError")) return new ToolsUnavailableError({ cause: err })
    if (chain.some((e) => statusOf(e) !== undefined || (typeof e.code === "string" && NETWORK_CODES.has(e.code)) || isConnectionError(e))) return new ModelUnavailableError({ cause: err })
    return err
}
