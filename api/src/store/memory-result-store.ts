import { randomUUID } from "node:crypto"
import type { ChartSpec } from "../domain/chart-spec.ts"
import type { ResultStore, StoredResult } from "../services/result-store.repository.ts"

export type MemoryResultStoreOptions = { ttlMs: number; maxRows: number; maxBytes: number; maxPerConversation?: number; now?: () => number }

type Entry = { result: StoredResult; expiresMs: number; bytes: number; charts: ChartSpec[] }

const estimateBytes = (rows: Record<string, unknown>[]) => JSON.stringify(rows).length * 2

// in memory only (never disk), per conversation, with TTL and caps
export function createMemoryResultStore(opts: MemoryResultStoreOptions): ResultStore {
    const now = opts.now ?? Date.now
    const perConv = opts.maxPerConversation ?? 10
    const entries: Entry[] = [] // oldest first

    const alive = (e: Entry) => e.expiresMs > now()
    const sweep = () => { for (let i = entries.length - 1; i >= 0; i--) if (!alive(entries[i]!)) entries.splice(i, 1) }
    const total = () => entries.reduce((n, e) => n + e.bytes, 0)
    const find = (conversationId: string, resultId: string) => entries.find((e) => e.result.conversationId === conversationId && e.result.id === resultId && alive(e))

    return {
        save(input) {
            sweep()
            const kept = input.rows.slice(0, opts.maxRows)
            const createdMs = now()
            const result: StoredResult = {
                ...input, id: input.id || randomUUID(), rows: kept, capped: input.totalRows > kept.length,
                createdAt: new Date(createdMs).toISOString(), expiresAt: new Date(createdMs + opts.ttlMs).toISOString(),
            }
            entries.push({ result, expiresMs: createdMs + opts.ttlMs, bytes: estimateBytes(kept), charts: [] })
            const mine = entries.filter((e) => e.result.conversationId === input.conversationId)
            for (let i = 0; i < mine.length - perConv; i++) entries.splice(entries.indexOf(mine[i]!), 1)
            while (entries.length > 1 && total() > opts.maxBytes) entries.shift()
            return result
        },
        get: (c, id) => find(c, id)?.result,
        list(conversationId) {
            return entries.filter((e) => e.result.conversationId === conversationId && alive(e)).map((e) => e.result).reverse()
        },
        latest(conversationId) { return this.list(conversationId)[0] },
        addChart(conversationId, chart) {
            const e = find(conversationId, chart.resultId)
            if (e) e.charts.push(chart)
        },
        getChart(conversationId, chartId) {
            for (const e of entries) if (e.result.conversationId === conversationId && alive(e)) { const c = e.charts.find((x) => x.id === chartId); if (c) return c }
            return undefined
        },
        latestChart(conversationId, resultId) { return find(conversationId, resultId)?.charts.at(-1) },
        sweep,
    }
}
