import type { ChartSpec } from "../domain/chart-spec.ts"
import type { ResultFilters } from "../domain/result-label.ts"

export type StoredResult = {
    id: string
    conversationId: string
    toolName: string
    label: string
    filters: ResultFilters
    rows: Record<string, unknown>[]
    totalRows: number
    capped: boolean
    createdAt: string
    expiresAt: string
}

export interface ResultStore {
    save(result: Omit<StoredResult, "createdAt" | "expiresAt" | "rows" | "capped"> & { rows: Record<string, unknown>[] }): StoredResult
    get(conversationId: string, resultId: string): StoredResult | undefined
    latest(conversationId: string): StoredResult | undefined
    list(conversationId: string): StoredResult[] // newest first
    addChart(conversationId: string, chart: ChartSpec): void
    getChart(conversationId: string, chartId: string): ChartSpec | undefined
    latestChart(conversationId: string, resultId: string): ChartSpec | undefined
    sweep(): void
}
