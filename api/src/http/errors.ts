import { ZodError } from "zod"
import {
    ChartNotFoundError, ChatTimeoutError, ConversationNotFoundError, ExportBusyError, ExportTimeoutError, ExportTooLargeError, FileNotFoundError, ModelUnavailableError,
    NothingToExportError, OriginNotAllowedError, ResultNotFoundError, ToolsUnavailableError, UnauthorizedError,
} from "../domain/errors.ts"
import type { StreamErrorCode } from "../domain/events.ts"

export type HttpErrorBody = { requestId: string; error: string; [k: string]: unknown }

export function toHttpError(err: unknown, requestId: string): { status: number; body: HttpErrorBody } {
    if (err instanceof ZodError) return { status: 400, body: { requestId, error: "invalid_body", issues: err.issues.map((i) => ({ path: i.path, message: i.message })) } }
    if (err instanceof UnauthorizedError) return { status: 401, body: { requestId, error: "unauthorized" } }
    if (err instanceof OriginNotAllowedError) return { status: 403, body: { requestId, error: "origin_not_allowed" } }
    if (err instanceof ConversationNotFoundError) return { status: 404, body: { requestId, error: "conversation_not_found", conversationId: err.conversationId } }
    if (err instanceof ResultNotFoundError) return { status: 404, body: { requestId, error: "result_not_found" } }
    if (err instanceof ChartNotFoundError) return { status: 404, body: { requestId, error: "chart_not_found" } }
    if (err instanceof FileNotFoundError) return { status: 404, body: { requestId, error: "file_not_found" } }
    if (err instanceof ExportTooLargeError) return { status: 413, body: { requestId, error: "export_too_large", rows: err.rows, maxRows: err.maxRows } }
    if (err instanceof NothingToExportError) return { status: 422, body: { requestId, error: "nothing_to_export" } }
    if (err instanceof ExportBusyError) return { status: 429, body: { requestId, error: "export_busy", retryAfterSeconds: err.retryAfterSeconds } }
    if (err instanceof ExportTimeoutError) return { status: 504, body: { requestId, error: "export_timeout" } }
    const e = err as { statusCode?: number; code?: string; retryAfterSeconds?: number }
    if (e?.statusCode === 429) return { status: 429, body: { requestId, error: "rate_limited", retryAfterSeconds: e.retryAfterSeconds ?? 60 } }
    if (e?.statusCode === 400 || e?.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") return { status: 400, body: { requestId, error: "invalid_body" } }
    return { status: 500, body: { requestId, error: "internal_error" } }
}

// the only place where a domain error becomes the terminal `error` event of the stream
export function toStreamError(err: unknown): { code: StreamErrorCode; message: string } {
    if (err instanceof ChatTimeoutError) return { code: "timeout", message: "A pergunta demorou mais que o tempo máximo. Tente de novo ou simplifique o pedido." }
    if (err instanceof ModelUnavailableError) return { code: "model_unavailable", message: "O assistente de IA está indisponível no momento. Tente novamente em instantes." }
    if (err instanceof ToolsUnavailableError) return { code: "tools_unavailable", message: "Não consegui consultar os dados da escola agora. Tente novamente em instantes." }
    return { code: "internal_error", message: "Ocorreu um erro inesperado. Tente novamente." }
}
