import type { StoredFile } from "../domain/file-descriptor.ts"
import type { FileStore } from "../services/file-store.repository.ts"

export type MemoryFileStoreOptions = { maxBytes: number; maxPerConversation?: number; now?: () => number }

// in memory only (never disk); expiry comes from each file's own expiresAt
export function createMemoryFileStore(opts: MemoryFileStoreOptions): FileStore {
    const now = opts.now ?? Date.now
    const perConv = opts.maxPerConversation ?? 20
    const files: StoredFile[] = [] // oldest first
    const alive = (f: StoredFile) => Date.parse(f.expiresAt) > now()
    const sweep = () => { for (let i = files.length - 1; i >= 0; i--) if (!alive(files[i]!)) files.splice(i, 1) }
    const total = () => files.reduce((n, f) => n + f.bytes.byteLength, 0)
    return {
        save(file) {
            sweep()
            files.push(file)
            const mine = files.filter((f) => f.conversationId === file.conversationId)
            for (let i = 0; i < mine.length - perConv; i++) files.splice(files.indexOf(mine[i]!), 1)
            while (files.length > 1 && total() > opts.maxBytes) files.shift()
        },
        get: (c, id) => files.find((f) => f.conversationId === c && f.id === id && alive(f)),
        names: (c) => files.filter((f) => f.conversationId === c && alive(f)).map((f) => f.name),
        sweep,
    }
}
