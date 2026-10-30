import { z } from "zod";
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

export type StreamEvent =
  | ({ event: "meta" } & z.infer<typeof MetaData>)
  | ({ event: "tool" } & z.infer<typeof ToolData>)
  | ({ event: "token" } & z.infer<typeof TokenData>)
  | ({ event: "done" } & z.infer<typeof DoneData>)
  | ({ event: "error" } & z.infer<typeof ErrorData>);

export const ApiErrorCodeSchema = z.enum([
  "invalid_body",
  "unauthorized",
  "origin_not_allowed",
  "conversation_not_found",
  "rate_limited",
  "internal_error",
]);
export const ApiErrorBodySchema = z.object({
  requestId: z.string(),
  error: ApiErrorCodeSchema,
  retryAfterSeconds: z.number().optional(),
  conversationId: z.string().optional(),
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
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const MessagesResponseSchema = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(ChatMessageSchema),
});
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;

const schemas = { meta: MetaData, tool: ToolData, token: TokenData, done: DoneData, error: ErrorData } as const;

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
