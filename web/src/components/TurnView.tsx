import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, LoaderCircle } from "lucide-react";
import { useAnnouncer } from "../hooks/useAnnouncer.ts";
import type { Turn } from "../lib/chat-reducer.ts";
import { Markdown } from "./Markdown.tsx";
import { StatusNotice } from "./StatusNotice.tsx";
import { ToolNotices } from "./ToolNotices.tsx";
import styles from "./TurnView.module.css";

export interface TurnViewProps {
  turn: Turn;
  /** Substitui o aviso de erro padrão (por exemplo, pelo painel com nova tentativa). */
  renderError?: (turn: Turn) => ReactNode;
  canCopy?: boolean;
}

const clipboardAvailable = () => typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";

function CopyButton({ text }: { text: string }) {
  const announcer = useAnnouncer();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    announcer.announce("Resposta copiada.");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button" className="btn btn-secondary" onClick={copy}>
      {copied ? "Copiado" : "Copiar"}
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
    </button>
  );
}

export function TurnView({ turn, renderError, canCopy }: TurnViewProps) {
  const streaming = turn.status === "pending" || turn.status === "working" || turn.status === "streaming";
  const showCopy = (canCopy ?? clipboardAvailable()) && turn.status === "done" && turn.text !== "";

  return (
    <article className={styles.turn} aria-label="Pergunta e resposta">
      <div>
        <h3 className={styles.label}>Você</h3>
        <p className={styles.question}>{turn.question}</p>
      </div>
      <div aria-busy={streaming || undefined}>
        <h3 className={styles.label}>Assistente</h3>
        <ToolNotices tools={turn.tools} />
        {turn.status === "pending" || (turn.status === "working" && turn.text === "" && turn.tools.length === 0) ? (
          <p className={styles.pending}>
            <LoaderCircle className={styles.spin} size={16} aria-hidden="true" />
            Consultando…
          </p>
        ) : null}
        {turn.text !== "" ? <Markdown text={turn.text} /> : null}
        {turn.status === "done" && turn.partial ? (
          <div className={styles.notice}>
            <StatusNotice variant="warning" title="Resultado parcial">
              A lista está incompleta. Refine a pergunta para ver o restante.
            </StatusNotice>
          </div>
        ) : null}
        {turn.status === "interrupted" ? (
          <div className={styles.notice}>
            <StatusNotice variant="interrupted" title="Resposta interrompida">
              Ela não será guardada no histórico.
            </StatusNotice>
          </div>
        ) : null}
        {turn.status === "error" && turn.error ? (
          <div className={styles.notice}>
            {renderError ? (
              renderError(turn)
            ) : (
              <StatusNotice variant="error" title={turn.error.title}>
                {turn.error.message}
              </StatusNotice>
            )}
          </div>
        ) : null}
        {turn.status === "done" ? (
          <div className={styles.footer}>
            {showCopy ? <CopyButton text={turn.text} /> : null}
            {turn.model ? <p className={`text-muted ${styles.model}`}><small>{turn.model}</small></p> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
