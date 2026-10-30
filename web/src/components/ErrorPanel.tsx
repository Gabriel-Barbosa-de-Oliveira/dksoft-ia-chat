import { useEffect, useRef, useState } from "react";
import { Check, Copy, RotateCw } from "lucide-react";
import { useAnnouncer } from "../hooks/useAnnouncer.ts";
import type { UserError } from "../lib/errors.ts";
import { StatusNotice } from "./StatusNotice.tsx";
import styles from "./ErrorPanel.module.css";

export interface ErrorPanelProps {
  error: UserError;
  onRetry?: () => void;
  onNewConversation?: () => void;
  onReauthenticate?: () => void;
  /** Segundos restantes da espera (quando `error.action === "wait"`); o dono do estado controla o relógio. */
  countdown?: number | null;
}

function CopyCode({ code }: { code: string }) {
  const announcer = useAnnouncer();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") return null;
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          return;
        }
        setCopied(true);
        announcer.announce("Código de suporte copiado.");
        timer.current = setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copiado" : "Copiar código"}
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
    </button>
  );
}

/** Erro apresentado: título, mensagem, ação principal e código de suporte copiável. */
export function ErrorPanel({ error, onRetry, onNewConversation, onReauthenticate, countdown }: ErrorPanelProps) {
  const actions =
    (error.action === "retry" && onRetry) ||
    (error.action === "new-conversation" && onNewConversation) ||
    (error.action === "reauthenticate" && onReauthenticate) ? (
      <>
        {error.action === "retry" && onRetry ? (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Tentar novamente
            <RotateCw size={16} aria-hidden="true" />
          </button>
        ) : null}
        {error.action === "new-conversation" && onNewConversation ? (
          <button type="button" className="btn btn-primary" onClick={onNewConversation}>
            Iniciar nova conversa
          </button>
        ) : null}
        {error.action === "reauthenticate" && onReauthenticate ? (
          <button type="button" className="btn btn-primary" onClick={onReauthenticate}>
            Informar a chave de novo
          </button>
        ) : null}
      </>
    ) : undefined;

  return (
    <StatusNotice variant="error" title={error.title} actions={actions}>
      {error.message}
      {error.action === "wait" && countdown !== undefined && countdown !== null ? (
        <>
          <br />
          <span className={styles.wait}>
            {countdown > 0 ? `Você pode enviar de novo em ${countdown} s.` : "Você já pode enviar de novo."}
          </span>
        </>
      ) : null}
      {error.supportCode ? (
        <>
          <br />
          <span className={styles.support}>
            Código de suporte: <span className={styles.code}>{error.supportCode}</span>
            <CopyCode code={error.supportCode} />
          </span>
        </>
      ) : null}
    </StatusNotice>
  );
}
