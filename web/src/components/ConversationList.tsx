import { useCallback, useRef, type MouseEvent } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { useInView } from "../hooks/useInView.ts";
import { formatConversationDate } from "../lib/conversation-label.ts";
import type { ConversationListState } from "../lib/conversation-list.ts";
import type { ConversationSummary } from "../lib/events.ts";
import { conversationPath } from "../lib/route.ts";
import { Skeleton } from "./Skeleton.tsx";
import { StatusNotice } from "./StatusNotice.tsx";
import styles from "./ConversationList.module.css";

export interface ConversationListProps {
  state: ConversationListState;
  currentId: string | null;
  /** Relógio de referência para "Hoje"/"Ontem" (entra por parâmetro). */
  now: number;
  preview: (id: string) => string | null | undefined;
  onVisible: (id: string) => void;
  onNew: () => void;
  onOpen: (id: string, event: MouseEvent) => void;
  onLoadMore: () => void;
  onRetry: () => void;
}

function Item({
  conversation,
  current,
  now,
  preview,
  onVisible,
  onOpen,
}: {
  conversation: ConversationSummary;
  current: boolean;
  now: number;
  preview: string | null | undefined;
  onVisible: (id: string) => void;
  onOpen: (id: string, event: MouseEvent) => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const visible = useCallback(() => onVisible(conversation.id), [onVisible, conversation.id]);
  useInView(ref, visible);
  const date = formatConversationDate(conversation.updatedAt, now);
  return (
    <li>
      <Link
        ref={ref}
        to={conversationPath(conversation.id)}
        className={styles.item}
        aria-current={current ? "true" : undefined}
        onClick={(event) => onOpen(conversation.id, event)}
      >
        {preview ? <span className={styles.preview}>{preview}</span> : null}
        <span className={styles.date}>{preview ? date : `Conversa de ${date}`}</span>
      </Link>
    </li>
  );
}

export function ConversationList({ state, currentId, now, preview, onVisible, onNew, onOpen, onLoadMore, onRetry }: ConversationListProps) {
  return (
    <section className={styles.root} aria-labelledby="history-title">
      <h2 id="history-title" className={styles.title}>
        Conversas
      </h2>
      <button type="button" className={`btn btn-secondary ${styles.new}`} onClick={onNew}>
        Nova conversa
        <Plus size={16} aria-hidden="true" />
      </button>

      {state.status === "loading" ? <Skeleton lines={5} label="Carregando conversas…" /> : null}

      {state.status === "empty" ? <p className={styles.empty}>Nenhuma conversa ainda. Faça sua primeira pergunta.</p> : null}

      {state.status === "error" && state.error ? (
        <StatusNotice
          variant="error"
          title={state.error.title}
          actions={
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              Tentar novamente
            </button>
          }
        >
          {state.error.message}
        </StatusNotice>
      ) : null}

      {state.status === "ready" ? (
        <ul className={styles.list}>
          {state.items.map((conversation) => (
            <Item
              key={conversation.id}
              conversation={conversation}
              current={conversation.id === currentId}
              now={now}
              preview={preview(conversation.id)}
              onVisible={onVisible}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : null}

      {state.status === "ready" && state.moreError ? <p className={styles.problem}>{state.moreError.title}. {state.moreError.message}</p> : null}

      {state.status === "ready" && state.hasMore ? (
        <button type="button" className={`btn btn-secondary ${styles.more}`} onClick={onLoadMore} aria-busy={state.loadingMore || undefined}>
          {state.loadingMore ? "Carregando…" : "Carregar mais"}
        </button>
      ) : null}
    </section>
  );
}
