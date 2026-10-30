import type { StreamEvent } from "../domain/events.ts"

// pure: one SSE frame with a single JSON data line
export function formatSseEvent(event: StreamEvent): string {
    return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
}
