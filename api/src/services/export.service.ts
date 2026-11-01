import { randomUUID } from "node:crypto"
import { ChartNotFoundError, ExportBusyError, ExportTimeoutError, ExportTooLargeError, NothingToExportError, ResultNotFoundError } from "../domain/errors.ts"
import { buildExportTable } from "../domain/export-table.ts"
import { exportFileName } from "../domain/export-name.ts"
import { MIME_BY_FORMAT, toDescriptor, type FileDescriptor, type FileFormat } from "../domain/file-descriptor.ts"
import type { DocumentRenderer } from "./document-renderer.ts"
import type { ExportRun, ExportRunStore } from "./export-run-store.repository.ts"
import type { FileStore } from "./file-store.repository.ts"
import type { ResultStore } from "./result-store.repository.ts"

export type ExportServiceDeps = {
    results: ResultStore
    files: FileStore
    renderer: DocumentRenderer
    runs: ExportRunStore
    config: { exportMaxRows: number; exportTtlMs: number }
    now?: () => Date
    newId?: () => string
}

export type ExportRequest = {
    conversationId: string
    resultId?: string | undefined
    format: FileFormat
    maskPersonalData: boolean
    origin: ExportRun["origin"]
    requestId: string
    chartId?: string | undefined
}

function outcomeOf(err: unknown): ExportRun["outcome"] {
    if (err instanceof ResultNotFoundError || err instanceof ChartNotFoundError) return "not_found"
    if (err instanceof ExportTooLargeError) return "too_large"
    if (err instanceof ExportTimeoutError) return "timeout"
    return "error"
}

export function createExportService(deps: ExportServiceDeps) {
    const now = deps.now ?? (() => new Date())
    const newId = deps.newId ?? randomUUID

    return {
        async export(req: ExportRequest): Promise<FileDescriptor> {
            const started = now().getTime()
            let rows = 0
            const record = (outcome: ExportRun["outcome"]) =>
                deps.runs.save({
                    requestId: req.requestId, conversationId: req.conversationId, kind: "export", detail: req.format, origin: req.origin, rows,
                    durationMs: Math.max(0, now().getTime() - started), outcome, explicitPii: !req.maskPersonalData, createdAt: new Date(started).toISOString(),
                })
            try {
                const result = req.resultId ? deps.results.get(req.conversationId, req.resultId) : deps.results.latest(req.conversationId)
                if (!result) throw new ResultNotFoundError()
                rows = result.rows.length
                if (rows === 0) throw new NothingToExportError()
                if (rows > deps.config.exportMaxRows) throw new ExportTooLargeError(rows, deps.config.exportMaxRows)
                let chart
                if (req.chartId) {
                    chart = deps.results.getChart(req.conversationId, req.chartId)
                    if (!chart || chart.resultId !== result.id) throw new ChartNotFoundError()
                }
                const at = now()
                const table = buildExportTable(result, { maskPersonalData: req.maskPersonalData, now: at })
                const bytes = await deps.renderer.render({ format: req.format, table, ...(chart ? { chart } : {}) })
                const name = exportFileName({ toolName: result.toolName, format: req.format, now: at, taken: deps.files.names(req.conversationId) })
                const stored = {
                    id: newId(), conversationId: req.conversationId, resultId: result.id, name, format: req.format, mime: MIME_BY_FORMAT[req.format],
                    sizeBytes: bytes.byteLength, rowCount: rows, includesChart: chart !== undefined, containsFullPersonalData: !req.maskPersonalData,
                    createdAt: at.toISOString(), expiresAt: new Date(at.getTime() + deps.config.exportTtlMs).toISOString(), bytes,
                }
                deps.files.save(stored)
                record("ok")
                return toDescriptor(stored)
            } catch (err) {
                record(outcomeOf(err))
                throw err
            }
        },
    }
}
export type ExportService = ReturnType<typeof createExportService>
export { ExportBusyError }
