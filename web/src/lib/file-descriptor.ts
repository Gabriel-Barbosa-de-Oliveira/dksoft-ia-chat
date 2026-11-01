import { z } from "zod";

/** Espelho de `api/src/domain/file-descriptor.ts` (sem `bytes`: o conteúdo nunca vai no stream). */
export const FileFormatSchema = z.enum(["pdf", "xlsx", "docx"]);
export type FileFormat = z.infer<typeof FileFormatSchema>;

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
});
export type FileDescriptor = z.infer<typeof FileDescriptorSchema>;

export const FORMAT_LABEL: Record<FileFormat, string> = { pdf: "PDF", xlsx: "Excel", docx: "Word" };
