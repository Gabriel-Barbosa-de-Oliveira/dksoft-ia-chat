import { REQUEST_ID } from "./stream.ts";

export const httpErrors = {
  400: { requestId: REQUEST_ID, error: "invalid_body", issues: [{ path: ["message"], message: "x" }] },
  401: { requestId: REQUEST_ID, error: "unauthorized" },
  403: { requestId: REQUEST_ID, error: "origin_not_allowed" },
  404: { requestId: REQUEST_ID, error: "conversation_not_found" },
  429: { requestId: REQUEST_ID, error: "rate_limited", retryAfterSeconds: 30 },
  500: { requestId: REQUEST_ID, error: "internal_error" },
} as const;

const iso = (n: number) => `2026-10-${String(n).padStart(2, "0")}T12:00:00.000Z`;

export const conversationsFull = {
  conversations: Array.from({ length: 20 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    createdAt: iso(10),
    updatedAt: iso(10),
  })),
  limit: 20,
  offset: 0,
};

export const conversationsShort = {
  conversations: conversationsFull.conversations.slice(0, 3),
  limit: 20,
  offset: 20,
};

export const messages = {
  conversationId: "22222222-2222-4222-8222-222222222222",
  messages: [
    { id: 1, role: "user", content: "Quais pacotes estão disponíveis?", createdAt: iso(10) },
    { id: 2, role: "assistant", content: "Estes são os **pacotes**.", createdAt: iso(10) },
  ],
} as const;
