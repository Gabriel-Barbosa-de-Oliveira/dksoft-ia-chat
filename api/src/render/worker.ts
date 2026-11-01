import { parentPort } from "node:worker_threads"
import type { ChartSpec } from "../domain/chart-spec.ts"
import type { ExportTable } from "../domain/export-table.ts"
import type { FileFormat } from "../domain/file-descriptor.ts"
import { renderChartPng } from "./chart-png.ts"
import { renderDocx } from "./docx.ts"
import { renderPdf } from "./pdf.ts"
import { renderXlsx } from "./xlsx.ts"

export type WorkerJob = { format: FileFormat; table: ExportTable; chart?: ChartSpec | undefined }

// shared by the worker thread and the inline mode (tests)
export async function runJob(job: WorkerJob): Promise<Uint8Array> {
    const attachment = job.chart ? { spec: job.chart, png: renderChartPng(job.chart) } : undefined
    if (job.format === "pdf") return renderPdf(job.table, attachment)
    if (job.format === "docx") return renderDocx(job.table, attachment)
    return renderXlsx(job.table, attachment)
}

if (parentPort) {
    const port = parentPort
    port.once("message", (job: WorkerJob) => {
        runJob(job).then(
            (bytes) => port.postMessage({ ok: true, bytes }, [bytes.buffer as ArrayBuffer]),
            (err: unknown) => port.postMessage({ ok: false, message: err instanceof Error ? err.message : "erro" }),
        )
    })
}
