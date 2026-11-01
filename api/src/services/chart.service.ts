import { randomUUID } from "node:crypto"
import { buildChartSpec } from "../domain/build-chart.ts"
import type { ChartRequest } from "../domain/chart-request.ts"
import type { ChartSpec } from "../domain/chart-spec.ts"
import { ChartNotPossibleError, ResultNotFoundError } from "../domain/errors.ts"
import type { ExportRunStore } from "./export-run-store.repository.ts"
import type { ResultStore } from "./result-store.repository.ts"

export type ChartServiceDeps = { results: ResultStore; runs: ExportRunStore; now?: () => Date; newId?: () => string }

export function createChartService(deps: ChartServiceDeps) {
    const now = deps.now ?? (() => new Date())
    const newId = deps.newId ?? randomUUID
    return {
        create(input: { conversationId: string; request: ChartRequest; requestId: string }): ChartSpec {
            const started = now().getTime()
            let points = 0
            const record = (outcome: "ok" | "not_found" | "error") =>
                deps.runs.save({
                    requestId: input.requestId, conversationId: input.conversationId, kind: "chart", detail: input.request.type, origin: "chat", rows: points,
                    durationMs: Math.max(0, now().getTime() - started), outcome, explicitPii: false, createdAt: new Date(started).toISOString(),
                })
            try {
                const rid = input.request.resultId
                const result = rid ? deps.results.get(input.conversationId, rid) : deps.results.latest(input.conversationId)
                if (!result) throw new ResultNotFoundError()
                const spec = buildChartSpec(result, input.request, { newId })
                points = spec.categories.length * spec.series.length
                deps.results.addChart(input.conversationId, spec)
                record("ok")
                return spec
            } catch (err) {
                record(err instanceof ResultNotFoundError ? "not_found" : "error")
                if (err instanceof ChartNotPossibleError || err instanceof ResultNotFoundError) throw err
                throw err
            }
        },
    }
}
export type ChartService = ReturnType<typeof createChartService>
