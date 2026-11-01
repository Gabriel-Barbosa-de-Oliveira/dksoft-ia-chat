import type { ChartSpec } from "../domain/chart-spec.ts"
import type { ExportTable } from "../domain/export-table.ts"
import type { FileFormat } from "../domain/file-descriptor.ts"

export type RenderInput = { format: FileFormat; table: ExportTable; chart?: ChartSpec }

// CPU-heavy: implementations run outside the main event loop (render/worker-pool.ts)
export interface DocumentRenderer {
    render(input: RenderInput): Promise<Uint8Array>
    close?(): Promise<void>
}
