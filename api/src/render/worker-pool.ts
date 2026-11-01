import { Worker } from "node:worker_threads"
import { ExportBusyError, ExportFailedError, ExportTimeoutError } from "../domain/errors.ts"
import type { DocumentRenderer, RenderInput } from "../services/document-renderer.ts"
import { runJob, type WorkerJob } from "./worker.ts"

export type RendererOptions = { timeoutMs: number; maxConcurrency: number; inline?: boolean; retryAfterSeconds?: number }

const WORKER_URL = new URL("./worker.ts", import.meta.url)

// Each job runs in its own worker thread (CPU work stays off the event loop that serves SSE).
// No free slot -> ExportBusyError; over the time limit -> the worker is terminated and ExportTimeoutError is thrown.
export function createDocumentRenderer(opts: RendererOptions): DocumentRenderer {
    let running = 0
    const live = new Set<Worker>()
    const job = (input: RenderInput): WorkerJob => ({ format: input.format, table: input.table, ...(input.chart ? { chart: input.chart } : {}) })

    return {
        async render(input) {
            if (running >= opts.maxConcurrency) throw new ExportBusyError(opts.retryAfterSeconds ?? 10)
            running++
            try {
                if (opts.inline) {
                    let timer: ReturnType<typeof setTimeout> | undefined
                    const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new ExportTimeoutError()), opts.timeoutMs) })
                    try { return await Promise.race([runJob(job(input)).catch((e: unknown) => { throw new ExportFailedError({ cause: e }) }), timeout]) } finally { clearTimeout(timer) }
                }
                return await new Promise<Uint8Array>((resolve, reject) => {
                    const worker = new Worker(WORKER_URL, { execArgv: ["--import", "tsx"] })
                    live.add(worker)
                    let settled = false
                    const done = (fn: () => void) => { if (settled) return; settled = true; clearTimeout(timer); live.delete(worker); void worker.terminate(); fn() }
                    const timer = setTimeout(() => done(() => reject(new ExportTimeoutError())), opts.timeoutMs)
                    worker.once("message", (m: { ok: boolean; bytes?: Uint8Array; message?: string }) =>
                        done(() => (m.ok && m.bytes ? resolve(new Uint8Array(m.bytes)) : reject(new ExportFailedError({ cause: new Error(m.message ?? "falha") })))))
                    worker.once("error", (e) => done(() => reject(new ExportFailedError({ cause: e }))))
                    worker.once("exit", (code) => done(() => reject(new ExportFailedError({ cause: new Error(`worker saiu (${code})`) }))))
                    worker.postMessage(job(input))
                })
            } finally {
                running--
            }
        },
        async close() { await Promise.all([...live].map((w) => w.terminate())); live.clear() },
    }
}
