import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { ConversationNotFoundError } from "../../domain/errors.ts"
import type { ConversationStore } from "../../services/conversation-store.repository.ts"

const ListQuery = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
})
const UuidSchema = z.string().uuid()

export function registerConversationRoutes(app: FastifyInstance, store: ConversationStore): void {
    app.get("/conversations", async (req) => {
        const { limit, offset } = ListQuery.parse(req.query)
        return { conversations: store.listConversations(limit, offset), limit, offset }
    })

    app.get<{ Params: { id: string } }>("/conversations/:id/messages", async (req) => {
        const id = req.params.id
        if (!UuidSchema.safeParse(id).success || !store.exists(id)) throw new ConversationNotFoundError(id)
        return { conversationId: id, messages: store.listMessages(id) }
    })
}
