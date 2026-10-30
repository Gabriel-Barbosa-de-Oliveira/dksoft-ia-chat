import type { UserError } from "./errors.ts";
import type { ConversationPage, ConversationSummary } from "./events.ts";

export const PAGE_SIZE = 20;

export interface ConversationListState {
  status: "loading" | "ready" | "empty" | "error";
  items: ConversationSummary[];
  hasMore: boolean;
  loadingMore: boolean;
  error: UserError | null;
  /** Falha ao carregar a página seguinte (a lista já carregada continua visível). */
  moreError: UserError | null;
}

export type ConversationListAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_OK"; page: ConversationPage }
  | { type: "LOAD_ERROR"; error: UserError }
  | { type: "LOAD_MORE_START" }
  | { type: "LOAD_MORE_OK"; page: ConversationPage }
  | { type: "LOAD_MORE_ERROR"; error: UserError }
  /** Atualização silenciosa (depois de uma pergunta): troca os itens sem voltar ao esqueleto. */
  | { type: "REFRESH_OK"; page: ConversationPage };

export const initialList: ConversationListState = {
  status: "loading",
  items: [],
  hasMore: false,
  loadingMore: false,
  error: null,
  moreError: null,
};

const hasMore = (page: ConversationPage) => page.conversations.length >= page.limit;

function merge(existing: readonly ConversationSummary[], incoming: readonly ConversationSummary[]): ConversationSummary[] {
  const seen = new Set(existing.map((c) => c.id));
  return [...existing, ...incoming.filter((c) => !seen.has(c.id))];
}

export function conversationListReducer(state: ConversationListState, action: ConversationListAction): ConversationListState {
  switch (action.type) {
    case "LOAD_START":
      return initialList;
    case "LOAD_OK":
    case "REFRESH_OK": {
      const items = action.page.conversations;
      return {
        status: items.length === 0 ? "empty" : "ready",
        items: [...items],
        hasMore: hasMore(action.page),
        loadingMore: false,
        error: null,
        moreError: null,
      };
    }
    case "LOAD_ERROR":
      return { ...initialList, status: "error", error: action.error };
    case "LOAD_MORE_START":
      return state.loadingMore ? state : { ...state, loadingMore: true, moreError: null };
    case "LOAD_MORE_OK":
      return {
        ...state,
        items: merge(state.items, action.page.conversations),
        hasMore: hasMore(action.page),
        loadingMore: false,
        moreError: null,
      };
    case "LOAD_MORE_ERROR":
      return { ...state, loadingMore: false, moreError: action.error };
  }
}
