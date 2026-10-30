import { useCallback, useEffect, useReducer, useRef } from "react";
import { streamChat } from "../api/chat-stream.ts";
import type { ApiClient } from "../api/client.ts";
import { activeTurn, chatReducer, initialView, type ConversationView } from "../lib/chat-reducer.ts";
import { runTurn } from "./run-turn.ts";
import { useAnnouncer } from "./useAnnouncer.ts";

export interface UseChat {
  view: ConversationView;
  isBusy: boolean;
  send(text: string): void;
  stop(): void;
  reset(): void;
  dispatch: React.Dispatch<Parameters<typeof chatReducer>[1]>;
}

export function useChat(options: { client: ApiClient; onConversation?: (conversationId: string) => void }): UseChat {
  const { client, onConversation } = options;
  const [view, dispatch] = useReducer(chatReducer, initialView);
  const announcer = useAnnouncer();
  const viewRef = useRef(view);
  const abortRef = useRef<AbortController | null>(null);
  const onConversationRef = useRef(onConversation);
  useEffect(() => {
    viewRef.current = view;
    onConversationRef.current = onConversation;
  });

  const send = useCallback(
    (text: string) => {
      const current = viewRef.current;
      if (activeTurn(current) || current.phase === "not-found" || current.phase === "loading") return;
      const controller = new AbortController();
      abortRef.current = controller;
      dispatch({ type: "SEND", question: text, key: crypto.randomUUID() });
      const stream = streamChat({ client, message: text, conversationId: current.conversationId, signal: controller.signal });
      void runTurn({
        stream,
        dispatch,
        schedule: (fn) => requestAnimationFrame(fn),
        cancelSchedule: (handle) => cancelAnimationFrame(handle as number),
        announcer,
        signal: controller.signal,
      }).then((result) => {
        if (abortRef.current === controller) abortRef.current = null;
        if (result.conversationId && result.conversationId !== current.conversationId) {
          onConversationRef.current?.(result.conversationId);
        }
      });
    },
    [client, announcer],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "RESET" });
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { view, isBusy: activeTurn(view) !== undefined, send, stop, reset, dispatch };
}
