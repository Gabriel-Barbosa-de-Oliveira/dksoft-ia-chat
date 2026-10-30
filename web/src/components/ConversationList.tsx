import { useCallback, useRef, type MouseEvent } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { useInView } from "../hooks/useInView.ts";
import { formatConversationDate, twoDigits } from "../lib/conversation-label.ts";
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
  number,
  current,
  now,
  preview,
  onVisible,
  onOpen,
}: {
  conversation: ConversationSummary;
  number: string;
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
        <span className={styles.number}>{number}</span>
        <span className={styles.text}>
          <span className={styles.preview}>{preview ?? `Conversa de ${date}`}</span>
          {preview ? <span className={styles.date}>{date}</span> : null}
        </span>
      </Link>
    </li>
  );
}

export function ConversationList({ state, currentId, now, preview, onVisible, onNew, onOpen, onLoadMore, onRetry }: ConversationListProps) {
  return (
    <section className={styles.root} aria-labelledby="history-title">
      <div className={styles.top}>
        <button type="button" className={`btn btn-secondary ${styles.new}`} onClick={onNew} data-closes-sidebar>
          <Plus size={16} aria-hidden="true" />
          Nova sessão
        </button>
        <div className={styles.heading}>
          <h2 id="history-title" className={styles.title}>
            Sessões
          </h2>
          {state.status === "ready" ? <span className={styles.count}>{twoDigits(state.items.length)}</span> : null}
        </div>
      </div>

      {state.status === "loading" ? (
        <div className={styles.pad}>
          <Skeleton lines={3} block label="Carregando conversas…" />
        </div>
      ) : null}

      {state.status === "empty" ? <p className={`${styles.empty} ${styles.pad}`}>Nenhuma conversa ainda. Faça sua primeira pergunta.</p> : null}

      {state.status === "error" && state.error ? (
        <div className={styles.pad}>
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
        </div>
      ) : null}

      {state.status === "ready" ? (
        <nav className={styles.nav} aria-label="Conversas">
          <ul className={styles.list}>
            {state.items.map((conversation, index) => (
              <Item
                key={conversation.id}
                conversation={conversation}
                number={twoDigits(state.items.length - index)}
                current={conversation.id === currentId}
                now={now}
                preview={preview(conversation.id)}
                onVisible={onVisible}
                onOpen={onOpen}
              />
            ))}
          </ul>
          {state.moreError ? <p className={styles.problem}>{state.moreError.title}. {state.moreError.message}</p> : null}
          {state.hasMore ? (
            <button type="button" className={`btn btn-secondary ${styles.more}`} onClick={onLoadMore} aria-busy={state.loadingMore || undefined}>
              {state.loadingMore ? "Carregando…" : "Carregar mais"}
            </button>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
