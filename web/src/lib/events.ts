import { z } from "zod";
import { ChartSpecSchema } from "./chart-spec.ts";
import { FileDescriptorSchema } from "./file-descriptor.ts";
import { UnexpectedResponseError } from "./failures.ts";
import type { SseFrame } from "./sse.ts";

export const StreamErrorCodeSchema = z.enum(["timeout", "model_unavailable", "tools_unavailable", "internal_error"]);
export type StreamErrorCode = z.infer<typeof StreamErrorCodeSchema>;

const MetaData = z.object({ requestId: z.string(), conversationId: z.string() });
const ToolData = z.object({
  phase: z.enum(["start", "end"]),
  name: z.string(),
  label: z.string(),
  ok: z.boolean().optional(),
});
const TokenData = z.object({ text: z.string() });
const DoneData = z.object({
  requestId: z.string(),
  conversationId: z.string(),
  model: z.string().nullable(),
  durationMs: z.number(),
  partial: z.boolean(),
});
const ErrorData = z.object({ requestId: z.string(), code: StreamErrorCodeSchema, message: z.string().optional() });

const ResultData = z.object({
  resultId: z.string().uuid(),
  label: z.string(),
  rows: z.number().int().min(1),
  totalRows: z.number().int().min(1),
  capped: z.boolean(),
  expiresAt: z.string(),
});
const ChartData = z.object({ chart: ChartSpecSchema });
const FileData = z.object({ file: FileDescriptorSchema });

export type ResultNotice = z.infer<typeof ResultData>;

export type StreamEvent =
  | ({ event: "meta" } & z.infer<typeof MetaData>)
  | ({ event: "tool" } & z.infer<typeof ToolData>)
  | ({ event: "token" } & z.infer<typeof TokenData>)
  | ({ event: "done" } & z.infer<typeof DoneData>)
  | ({ event: "error" } & z.infer<typeof ErrorData>)
  | ({ event: "result" } & z.infer<typeof ResultData>)
  | ({ event: "chart" } & z.infer<typeof ChartData>)
  | ({ event: "file" } & z.infer<typeof FileData>);

export const ApiErrorCodeSchema = z.enum([
  "invalid_body",
  "unauthorized",
  "origin_not_allowed",
  "conversation_not_found",
  "rate_limited",
  "internal_error",
  // spec 004 (exportação e download)
  "result_not_found",
  "file_not_found",
  "chart_not_found",
  "export_too_large",
  "nothing_to_export",
  "export_busy",
  "export_timeout",
]);
export const ApiErrorBodySchema = z.object({
  requestId: z.string(),
  error: ApiErrorCodeSchema,
  retryAfterSeconds: z.number().optional(),
  conversationId: z.string().optional(),
  rows: z.number().optional(),
  maxRows: z.number().optional(),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export const ConversationSummarySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const ConversationPageSchema = z.object({
  conversations: z.array(ConversationSummarySchema),
  limit: z.number(),
  offset: z.number(),
});
export type ConversationPage = z.infer<typeof ConversationPageSchema>;

export const ChatMessageSchema = z.object({
  id: z.number(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string(),
  /** Só nas respostas que tiveram gráfico (spec 004); arquivos e resultados nunca são persistidos. */
  charts: z.array(ChartSpecSchema).optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const MessagesResponseSchema = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(ChatMessageSchema),
});
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;

const schemas = { meta: MetaData, tool: ToolData, token: TokenData, done: DoneData, error: ErrorData, result: ResultData, chart: ChartData, file: FileData } as const;

/** Quadro SSE → evento tipado. Evento desconhecido é ignorado; conhecido com dados inválidos lança. */
export function parseStreamFrame(frame: SseFrame): StreamEvent | "ignored" {
  if (!(frame.event in schemas)) return "ignored";
  const name = frame.event as keyof typeof schemas;
  let json: unknown;
  try {
    json = JSON.parse(frame.data);
  } catch {
    throw new UnexpectedResponseError(`${name}: json inválido`);
  }
  const parsed = schemas[name].safeParse(json);
  if (!parsed.success) throw new UnexpectedResponseError(`${name}: fora do schema`);
  return { event: name, ...parsed.data } as StreamEvent;
}
