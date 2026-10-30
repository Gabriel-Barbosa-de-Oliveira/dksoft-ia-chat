import { randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import type { ChatTurn } from "../domain/agent-port.ts"
import type { ConversationStore, ConversationSummary, StoredMessage } from "../services/conversation-store.repository.ts"

export function createSqliteConversationStore(db: DatabaseSync, now: () => Date = () => new Date()): ConversationStore {
    const iso = () => now().toISOString()
    return {
        create() {
            const id = randomUUID()
            const t = iso()
            db.prepare("INSERT INTO conversations (id, created_at, updated_at) VALUES (?,?,?)").run(id, t, t)
            return id
        },
        exists(id) {
            return db.prepare("SELECT 1 AS x FROM conversations WHERE id = ?").get(id) !== undefined
        },
        lastMessages(id, n): ChatTurn[] {
            const rows = db
                .prepare("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?")
                .all(id, n) as { role: "user" | "assistant"; content: string }[]
            return rows.reverse().map((r) => ({ role: r.role, content: r.content }))
        },
        appendPair(id, user, assistant) {
            const t = iso()
            db.exec("BEGIN")
            try {
                const ins = db.prepare("INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?,?,?,?)")
                ins.run(id, "user", user, t)
                ins.run(id, "assistant", assistant, t)
                db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(t, id)
                db.exec("COMMIT")
            } catch (e) {
                db.exec("ROLLBACK")
                throw e
            }
        },
        listConversations(limit, offset): ConversationSummary[] {
            const rows = db
                .prepare("SELECT id, created_at, updated_at FROM conversations ORDER BY updated_at DESC, rowid DESC LIMIT ? OFFSET ?")
                .all(limit, offset) as { id: string; created_at: string; updated_at: string }[]
            return rows.map((r) => ({ id: r.id, createdAt: r.created_at, updatedAt: r.updated_at }))
        },
        listMessages(id): StoredMessage[] {
            const rows = db
                .prepare("SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id")
                .all(id) as { id: number; role: "user" | "assistant"; content: string; created_at: string }[]
            return rows.map((r) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.created_at }))
        },
    }
}
