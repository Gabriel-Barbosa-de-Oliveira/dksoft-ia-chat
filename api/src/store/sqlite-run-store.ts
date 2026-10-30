import type { DatabaseSync } from "node:sqlite"
import { maskPii } from "../domain/mask-pii.ts"
import type { RunRecord, RunStore } from "../services/run-store.repository.ts"

export function createSqliteRunStore(db: DatabaseSync): RunStore {
    return {
        save(run: RunRecord) {
            db.prepare(
                "INSERT INTO runs (request_id, conversation_id, started_at, duration_ms, outcome, model_used, tool_calls, error_type) VALUES (?,?,?,?,?,?,?,?)",
            ).run(
                run.requestId, run.conversationId, run.startedAt, Math.max(0, Math.round(run.durationMs)),
                run.outcome, run.modelUsed, run.toolCalls, run.errorType === null ? null : maskPii(run.errorType),
            )
        },
    }
}
