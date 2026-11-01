import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { ConversationNotFoundError, FileNotFoundError } from "../../domain/errors.ts"
import { FileFormatSchema } from "../../domain/file-descriptor.ts"
import type { ConversationStore } from "../../services/conversation-store.repository.ts"
import type { ExportService } from "../../services/export.service.ts"
import type { FileStore } from "../../services/file-store.repository.ts"

const Uuid = z.string().uuid()
// no option for complete personal data: the button always exports masked
export const ExportRequestSchema = z.object({
    conversationId: Uuid,
    resultId: Uuid,
    format: FileFormatSchema,
    chartId: Uuid.optional(),
}).strict()

export type ExportRoutesDeps = { exports: ExportService; files: FileStore; conversations: ConversationStore; rateLimitPerMin: number }

export function registerExportRoutes(app: FastifyInstance, deps: ExportRoutesDeps): void {
    app.post("/exports", { config: { rateLimit: { max: deps.rateLimitPerMin, timeWindow: "1 minute" } } }, async (req, reply) => {
        const body = ExportRequestSchema.parse(req.body)
        if (!deps.conversations.exists(body.conversationId)) throw new ConversationNotFoundError(body.conversationId)
        const file = await deps.exports.export({
            conversationId: body.conversationId, resultId: body.resultId, format: body.format, maskPersonalData: true, origin: "button", requestId: req.id, chartId: body.chartId,
        })
        return reply.status(201).send({ requestId: req.id, file })
    })

    app.get<{ Params: { conversationId: string; fileId: string } }>("/conversations/:conversationId/exports/:fileId", async (req, reply) => {
        const { conversationId, fileId } = req.params
        // unknown, expired and other-conversation files are the same answer
        if (!Uuid.safeParse(conversationId).success || !Uuid.safeParse(fileId).success) throw new FileNotFoundError()
        const file = deps.files.get(conversationId, fileId)
        if (!file) throw new FileNotFoundError()
        const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
        return reply
            .header("Content-Type", file.mime)
            .header("Content-Disposition", `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`)
            .header("Content-Length", file.bytes.byteLength)
            .header("Cache-Control", "no-store")
            .header("X-Content-Type-Options", "nosniff")
            .send(Buffer.from(file.bytes))
    })
}
