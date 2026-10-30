import { useCallback, useEffect, useReducer, useRef } from "react";
import { listConversations } from "../api/conversations.ts";
import type { ApiClient } from "../api/client.ts";
import { PAGE_SIZE, conversationListReducer, initialList } from "../lib/conversation-list.ts";
import { toUserErrorFrom } from "../lib/failures.ts";

export function useConversationList(client: ApiClient) {
  const [state, dispatch] = useReducer(conversationListReducer, initialList);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const load = useCallback(() => {
    dispatch({ type: "LOAD_START" });
    listConversations(client, { limit: PAGE_SIZE, offset: 0 }).then(
      (page) => dispatch({ type: "LOAD_OK", page }),
      (error: unknown) => dispatch({ type: "LOAD_ERROR", error: toUserErrorFrom(error) }),
    );
  }, [client]);

  /** Atualização silenciosa (depois de uma pergunta): erros são ignorados, a lista atual continua. */
  const refresh = useCallback(() => {
    listConversations(client, { limit: Math.max(PAGE_SIZE, stateRef.current.items.length), offset: 0 }).then(
      (page) => dispatch({ type: "REFRESH_OK", page }),
      () => {},
    );
  }, [client]);

  const loadMore = useCallback(() => {
    const current = stateRef.current;
    if (current.loadingMore || !current.hasMore) return;
    dispatch({ type: "LOAD_MORE_START" });
    listConversations(client, { limit: PAGE_SIZE, offset: current.items.length }).then(
      (page) => dispatch({ type: "LOAD_MORE_OK", page }),
      (error: unknown) => dispatch({ type: "LOAD_MORE_ERROR", error: toUserErrorFrom(error) }),
    );
  }, [client]);

  useEffect(() => {
    load();
  }, [load]);

  return { state, reload: load, refresh, loadMore };
}
