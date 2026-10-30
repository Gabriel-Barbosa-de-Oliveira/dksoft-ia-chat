import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import type { ApiClient } from "../api/client.ts";
import { AppShell } from "../components/AppShell.tsx";
import { Composer } from "../components/Composer.tsx";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { ConversationList } from "../components/ConversationList.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { StatusNotice } from "../components/StatusNotice.tsx";
import { Thread } from "../components/Thread.tsx";
import { useChat } from "../hooks/useChat.ts";
import { useConversation } from "../hooks/useConversation.ts";
import { useConversationList } from "../hooks/useConversationList.ts";
import { useConversationPreview } from "../hooks/useConversationPreview.ts";
import { toUserError } from "../lib/errors.ts";
import { conversationPath, parseRoute } from "../lib/route.ts";
import { isUuid } from "../lib/validation.ts";
import styles from "./ChatPage.module.css";

export interface ChatPageProps {
  client: ApiClient;
  onSignOut: () => void;
}

export function ChatPage({ client, onSignOut }: ChatPageProps) {
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
  const [draft, setDraft] = useState("");
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

  const { view } = chat;
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
    content = <Thread turns={view.turns} />;
  }

  const canCompose = view.phase !== "not-found" && view.phase !== "loading";

  return (
    <AppShell
      onSignOut={onSignOut}
      aside={
        <ConversationList
          state={list.state}
          currentId={view.conversationId}
          now={now}
          preview={previews.preview}
          onVisible={previews.request}
          onNew={onNew}
          onOpen={onOpen}
          onLoadMore={list.loadMore}
          onRetry={list.reload}
        />
      }
    >
      <div className={styles.page}>
        {content}
        {canCompose ? (
          <Composer value={draft} onChange={setDraft} onSubmit={send} onStop={chat.stop} busy={chat.isBusy} inputRef={inputRef} />
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
