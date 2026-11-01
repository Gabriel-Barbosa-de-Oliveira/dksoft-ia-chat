import { z } from "zod"

const Row = z.record(z.unknown())

export type ExtractedRows = { rows: Record<string, unknown>[]; context: Record<string, unknown> }

// pure: finds the list of records in a tool result (a list of objects, or an object with exactly one list of objects)
export function extractRows(rawText: string): ExtractedRows | undefined {
    let json: unknown
    try { json = JSON.parse(rawText) } catch { return undefined }
    if (Array.isArray(json)) {
        const parsed = z.array(Row).safeParse(json)
        return parsed.success ? { rows: parsed.data, context: {} } : undefined
    }
    if (json && typeof json === "object") {
        const entries = Object.entries(json as Record<string, unknown>)
        const arrays = entries.filter(([, v]) => Array.isArray(v))
        if (arrays.length !== 1) return undefined
        const parsed = z.array(Row).safeParse(arrays[0]![1])
        if (!parsed.success) return undefined
        return { rows: parsed.data, context: Object.fromEntries(entries.filter(([k]) => k !== arrays[0]![0])) }
    }
    return undefined
}
