import { z } from "zod"

export const FileFormatSchema = z.enum(["pdf", "xlsx", "docx"])
export type FileFormat = z.infer<typeof FileFormatSchema>

export const MIME_BY_FORMAT: Record<FileFormat, string> = {
    pdf: "application/pdf",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

export const FileDescriptorSchema = z.object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    resultId: z.string().uuid(),
    name: z.string().min(1),
    format: FileFormatSchema,
    mime: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    rowCount: z.number().int().nonnegative(),
    includesChart: z.boolean(),
    containsFullPersonalData: z.boolean(),
    createdAt: z.string(),
    expiresAt: z.string(),
    downloadPath: z.string().min(1),
})
export type FileDescriptor = z.infer<typeof FileDescriptorSchema>

export type StoredFile = Omit<FileDescriptor, "downloadPath"> & { bytes: Uint8Array }

export const downloadPathOf = (conversationId: string, fileId: string) => `/conversations/${conversationId}/exports/${fileId}`

// pure: public view of a stored file (never carries the content)
export function toDescriptor(f: StoredFile): FileDescriptor {
    const { bytes: _bytes, ...rest } = f
    return { ...rest, downloadPath: downloadPathOf(f.conversationId, f.id) }
}
