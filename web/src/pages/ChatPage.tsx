import { useCallback, useRef, useState } from "react";
import type { ApiClient } from "../api/client.ts";
import { Composer } from "../components/Composer.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { Thread } from "../components/Thread.tsx";
import { useChat } from "../hooks/useChat.ts";
import styles from "./ChatPage.module.css";

export function ChatPage({ client }: { client: ApiClient }) {
  const chat = useChat({ client });
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const send = useCallback(
    (text: string) => {
      setDraft("");
      chat.send(text);
      inputRef.current?.focus();
    },
    [chat],
  );

  const pick = useCallback((text: string) => {
    setDraft(text);
    inputRef.current?.focus();
  }, []);

  return (
    <div className={styles.page}>
      {chat.view.turns.length === 0 ? <EmptyState onPick={pick} /> : <Thread turns={chat.view.turns} />}
      <Composer value={draft} onChange={setDraft} onSubmit={send} onStop={chat.stop} busy={chat.isBusy} inputRef={inputRef} />
    </div>
  );
}
