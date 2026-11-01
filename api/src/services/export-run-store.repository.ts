export type ExportRun = {
    requestId: string
    conversationId: string
    kind: "export" | "chart"
    detail: string
    origin: "chat" | "button"
    rows: number
    durationMs: number
    outcome: "ok" | "too_large" | "timeout" | "not_found" | "error"
    explicitPii: boolean
    createdAt: string
}

// no content, no file name, no fileId, no personal data (FR-023)
export interface ExportRunStore {
    save(run: ExportRun): void
}
