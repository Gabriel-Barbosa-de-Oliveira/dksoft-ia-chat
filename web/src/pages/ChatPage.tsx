import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import type { ApiClient } from "../api/client.ts";
import { AppShell } from "../components/AppShell.tsx";
import { Composer } from "../components/Composer.tsx";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { ConversationList } from "../components/ConversationList.tsx";
import { ErrorPanel } from "../components/ErrorPanel.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { SectionBoundary } from "../components/SectionBoundary.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { StatusNotice } from "../components/StatusNotice.tsx";
import { StorageNotice } from "../components/StorageNotice.tsx";
import { Thread } from "../components/Thread.tsx";
import { useDraft } from "../hooks/DraftContext.tsx";
import { useChat } from "../hooks/useChat.ts";
import { useConversation } from "../hooks/useConversation.ts";
import { useConversationList } from "../hooks/useConversationList.ts";
import { useConversationPreview } from "../hooks/useConversationPreview.ts";
import { useCountdown } from "../hooks/useCountdown.ts";
import type { Turn } from "../lib/chat-reducer.ts";
import { conversationTitle, twoDigits } from "../lib/conversation-label.ts";
import { connectionStatus } from "../lib/conversation-list.ts";
import { toUserError } from "../lib/errors.ts";
import { conversationPath, parseRoute } from "../lib/route.ts";
import { isUuid } from "../lib/validation.ts";
import styles from "./ChatPage.module.css";

export interface ChatPageProps {
  client: ApiClient;
  onSignOut: () => void;
  /** `false` quando o navegador bloqueou o armazenamento (aviso discreto). */
  persisted?: boolean;
}

export function ChatPage({ client, onSignOut, persisted = true }: ChatPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(() => parseRoute(location.pathname), [location.pathname]);
  const routeId = route.kind === "conversation" ? route.id : null;

  // Id da conversa que o estado já representa; evita recarregar o histórico quando nós mesmos navegamos.
  const shownRef = useRef<string | null>(null);
  const chat = useChat({
    client,
    onConversation: (id) => {
      shownRef.current = id;
      navigate(conversationPath(id), { replace: true });
    },
  });
  const { dispatch, reset, stop } = chat;
  const conversation = useConversation({ client, dispatch });
  const list = useConversationList(client);
  const previews = useConversationPreview(client);
  const [now] = useState(() => Date.now());
  const { draft, setDraft, beginSend, endSend } = useDraft();
  const [pendingTarget, setPendingTarget] = useState<string | null | undefined>(undefined);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // A URL manda: abrir, trocar, voltar à conversa nova.
  const { load } = conversation;
  const cancelLoad = conversation.cancel;
  useEffect(() => {
    if (route.kind === "unknown") {
      navigate("/", { replace: true });
      return;
    }
    if (routeId === shownRef.current) return;
    shownRef.current = routeId;
    stop();
    if (routeId === null) {
      cancelLoad();
      reset();
    } else if (!isUuid(routeId)) {
      cancelLoad();
      dispatch({ type: "LOAD_NOT_FOUND", conversationId: routeId });
    } else {
      load(routeId);
    }
  }, [route.kind, routeId, navigate, stop, reset, dispatch, load, cancelLoad]);

  // Depois de cada pergunta, a lista de conversas é atualizada em silêncio.
  const wasBusy = useRef(false);
  const { refresh } = list;
  useEffect(() => {
    if (wasBusy.current && !chat.isBusy) refresh();
    wasBusy.current = chat.isBusy;
  }, [chat.isBusy, refresh]);

  const { view } = chat;
  const lastTurn = view.turns.at(-1);

  // Pergunta enviada: sai do campo, mas fica "em voo" até o fim (se a chave for recusada, volta ao campo).
  const send = useCallback(
    (text: string) => {
      // Reenviar a mesma pergunta que terminou em erro substitui o turno com erro (sem duplicar).
      if (lastTurn?.status === "error" && lastTurn.question === text) dispatch({ type: "DISCARD_ERROR_TURN", key: lastTurn.key });
      setDraft("");
      beginSend(text);
      chat.send(text);
      inputRef.current?.focus();
    },
    [chat, lastTurn, dispatch, setDraft, beginSend],
  );

  const retry = useCallback(
    (turn: Turn) => {
      dispatch({ type: "DISCARD_ERROR_TURN", key: turn.key });
      setDraft((current) => (current === turn.question ? "" : current));
      beginSend(turn.question);
      chat.send(turn.question);
      inputRef.current?.focus();
    },
    [chat, dispatch, setDraft, beginSend],
  );

  // Fim do turno: nada mais em voo. Erro: a pergunta volta ao campo (se vazio) para ser revista ou reenviada.
  const handledError = useRef<string | null>(null);
  useEffect(() => {
    if (!chat.isBusy) endSend();
  }, [chat.isBusy, endSend]);
  useEffect(() => {
    if (lastTurn?.status !== "error" || handledError.current === lastTurn.key) return;
    handledError.current = lastTurn.key;
    setDraft((current) => (current === "" ? lastTurn.question : current));
  }, [lastTurn, setDraft]);

  // Limite de uso: envio bloqueado até a contagem zerar.
  const rateTurn = lastTurn?.status === "error" && lastTurn.error?.kind === "rate_limited" ? lastTurn : null;
  const remaining = useCountdown(rateTurn?.error?.retryAfterSeconds ?? null, rateTurn?.key ?? null);
  const blocked = rateTurn !== null && remaining !== null && remaining > 0;

  const pick = useCallback(
    (text: string) => {
      setDraft(text);
      inputRef.current?.focus();
    },
    [setDraft],
  );

  const startNew = useCallback(() => {
    shownRef.current = null;
    cancelLoad();
    reset();
    navigate("/");
  }, [cancelLoad, reset, navigate]);

  const onNew = useCallback(() => {
    if (chat.isBusy) setPendingTarget(null);
    else startNew();
  }, [chat.isBusy, startNew]);

  const onOpen = useCallback(
    (id: string, event: MouseEvent) => {
      if (chat.isBusy) {
        event.preventDefault();
        setPendingTarget(id);
      }
    },
    [chat.isBusy],
  );

  const confirmSwitch = useCallback(() => {
    const target = pendingTarget;
    setPendingTarget(undefined);
    stop();
    if (target === null) startNew();
    else if (target !== undefined) navigate(conversationPath(target));
  }, [pendingTarget, stop, startNew, navigate]);

  const notFound = toUserError({ source: "client", kind: "conversation_not_found" });

  let content;
  if (view.phase === "loading") {
    content = (
      <div className={styles.loading}>
        <Skeleton lines={6} label="Carregando conversa…" />
      </div>
    );
  } else if (view.phase === "not-found") {
    content = (
      <div className={styles.notice}>
        <StatusNotice
          variant="error"
          title={notFound.title}
          actions={
            <button type="button" className="btn btn-primary" onClick={startNew}>
              Iniciar nova conversa
            </button>
          }
        >
          {notFound.message}
        </StatusNotice>
      </div>
    );
  } else if (view.phase === "error" && view.loadError) {
    content = (
      <div className={styles.notice}>
        <StatusNotice
          variant="error"
          title={view.loadError.title}
          actions={
            <button type="button" className="btn btn-secondary" onClick={conversation.reload}>
              Tentar novamente
            </button>
          }
        >
          {view.loadError.message}
        </StatusNotice>
      </div>
    );
  } else if (view.turns.length === 0) {
    content = <EmptyState onPick={pick} />;
  } else {
    content = (
      <SectionBoundary>
        <Thread
          turns={view.turns}
          renderError={(turn) =>
            turn.error ? (
              <ErrorPanel
                error={turn.error}
                onRetry={turn.key === lastTurn?.key ? () => retry(turn) : undefined}
                onNewConversation={startNew}
                countdown={turn.key === rateTurn?.key ? remaining : undefined}
              />
            ) : null
          }
        />
      </SectionBoundary>
    );
  }

  const canCompose = view.phase !== "not-found" && view.phase !== "loading";
  const openId = view.conversationId;
  const position = list.state.items.findIndex((item) => item.id === openId);

  return (
    <AppShell
      title={conversationTitle(openId, view.turns[0]?.question, openId ? previews.preview(openId) : null)}
      sessionLabel={position >= 0 ? twoDigits(list.state.items.length - position) : undefined}
      connection={connectionStatus(list.state.status)}
      onSignOut={onSignOut}
      banner={<StorageNotice persisted={persisted} />}
      aside={
        <SectionBoundary>
          <ConversationList
            state={list.state}
            currentId={openId}
            now={now}
            preview={previews.preview}
            onVisible={previews.request}
            onNew={onNew}
            onOpen={onOpen}
            onLoadMore={list.loadMore}
            onRetry={list.reload}
          />
        </SectionBoundary>
      }
    >
      <div className={styles.page}>
        {content}
        {canCompose ? (
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={send}
            onStop={chat.stop}
            busy={chat.isBusy}
            blocked={blocked}
            blockedReason={blocked ? `Aguarde ${remaining} s para enviar de novo.` : undefined}
            inputRef={inputRef}
          />
        ) : null}
      </div>
      <ConfirmDialog
        open={pendingTarget !== undefined}
        title="Interromper a resposta?"
        message="Ao trocar de conversa a resposta em andamento será interrompida e não ficará no histórico."
        confirmLabel="Interromper e trocar"
        cancelLabel="Continuar aqui"
        onConfirm={confirmSwitch}
        onCancel={() => setPendingTarget(undefined)}
      />
    </AppShell>
  );
}
