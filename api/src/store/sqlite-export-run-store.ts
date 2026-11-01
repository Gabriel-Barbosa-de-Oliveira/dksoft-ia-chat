import type { DatabaseSync } from "node:sqlite"
import type { ExportRun, ExportRunStore } from "../services/export-run-store.repository.ts"

export function createSqliteExportRunStore(db: DatabaseSync): ExportRunStore {
    return {
        save(r: ExportRun) {
            db.prepare("INSERT INTO export_runs (request_id, conversation_id, kind, detail, origin, rows, duration_ms, outcome, explicit_pii, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
                .run(r.requestId, r.conversationId, r.kind, r.detail, r.origin, r.rows, r.durationMs, r.outcome, r.explicitPii ? 1 : 0, r.createdAt)
        },
    }
}
