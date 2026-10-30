import type { ApiClient } from "./client.ts";
import { ConversationPageSchema, MessagesResponseSchema, type ConversationPage, type MessagesResponse } from "../lib/events.ts";
import { ApiFailure } from "../lib/failures.ts";
import { isUuid } from "../lib/validation.ts";

export function listConversations(client: ApiClient, params: { limit: number; offset: number }): Promise<ConversationPage> {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  return client.request(`/conversations?${query}`, ConversationPageSchema);
}

/** Id que não é UUID nunca chega à rede: vira `conversation_not_found` localmente. */
export function getMessages(client: ApiClient, conversationId: string): Promise<MessagesResponse> {
  if (!isUuid(conversationId)) return Promise.reject(new ApiFailure({ source: "client", kind: "conversation_not_found" }));
  return client.request(`/conversations/${conversationId}/messages`, MessagesResponseSchema);
}
