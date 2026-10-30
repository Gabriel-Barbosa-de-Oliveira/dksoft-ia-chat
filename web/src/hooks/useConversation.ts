import { useCallback, useRef, type Dispatch } from "react";
import { getMessages } from "../api/conversations.ts";
import type { ApiClient } from "../api/client.ts";
import type { ChatAction } from "../lib/chat-reducer.ts";
import { ApiFailure, toUserErrorFrom } from "../lib/failures.ts";
import { useAnnouncer } from "./useAnnouncer.ts";

function isNotFound(error: unknown): boolean {
  if (!(error instanceof ApiFailure)) return false;
  const input = error.input;
  return (input.source === "http" && input.status === 404) || (input.source === "client" && input.kind === "conversation_not_found");
}

/** Carrega o histórico de uma conversa para o reducer; cargas antigas (de outra conversa) são descartadas. */
export function useConversation({ client, dispatch }: { client: ApiClient; dispatch: Dispatch<ChatAction> }) {
  const announcer = useAnnouncer();
  const tokenRef = useRef(0);
  const lastRef = useRef<string | null>(null);

  const load = useCallback(
    (conversationId: string) => {
      lastRef.current = conversationId;
      const mine = ++tokenRef.current;
      dispatch({ type: "LOAD_START", conversationId });
      getMessages(client, conversationId).then(
        (res) => {
          if (mine !== tokenRef.current) return;
          dispatch({ type: "LOAD_OK", conversationId, messages: res.messages });
          announcer.announce(`Conversa aberta com ${res.messages.length} mensagens.`);
        },
        (error: unknown) => {
          if (mine !== tokenRef.current) return;
          if (isNotFound(error)) dispatch({ type: "LOAD_NOT_FOUND", conversationId });
          else dispatch({ type: "LOAD_ERROR", conversationId, error: toUserErrorFrom(error) });
        },
      );
    },
    [client, dispatch, announcer],
  );

  const reload = useCallback(() => {
    if (lastRef.current) load(lastRef.current);
  }, [load]);

  /** Invalida cargas em andamento (ao sair da conversa). */
  const cancel = useCallback(() => {
    tokenRef.current++;
    lastRef.current = null;
  }, []);

  return { load, reload, cancel };
}
