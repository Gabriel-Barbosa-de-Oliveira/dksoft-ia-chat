import { useId, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { ArrowUp, CircleAlert, Square } from "lucide-react";
import { MAX_MESSAGE_LENGTH, showCounter, validateMessage } from "../lib/validation.ts";
import styles from "./Composer.module.css";

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Recebe o texto já validado e com `trim`. */
  onSubmit: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  /** Bloqueia o envio por outro motivo (por exemplo, limite de uso), mantendo o texto. */
  blocked?: boolean;
  blockedReason?: string;
  inputRef?: Ref<HTMLTextAreaElement>;
  /** Espaço reservado para controles futuros (por exemplo, voz). */
  actions?: ReactNode;
}

export function Composer({ value, onChange, onSubmit, onStop, busy, blocked = false, blockedReason, inputRef, actions }: ComposerProps) {
  const id = useId();
  const [attempted, setAttempted] = useState(false);
  const check = validateMessage(value);
  const problem =
    !check.ok && check.reason === "too_long"
      ? `A pergunta passou de ${MAX_MESSAGE_LENGTH} caracteres em ${check.excess}. Encurte para enviar.`
      : attempted && !check.ok && check.reason === "empty"
        ? "Escreva uma pergunta para enviar."
        : null;
  const cannotSend = busy || blocked;

  const submit = () => {
    if (cannotSend) return;
    setAttempted(true);
    if (!check.ok) return;
    setAttempted(false);
    onSubmit(check.text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape" && busy) {
      event.preventDefault();
      onStop();
    }
  };

  const describedBy = [`${id}-hint`, showCounter(value.length) ? `${id}-count` : null, problem ? `${id}-problem` : null, blockedReason ? `${id}-blocked` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <form
      className={styles.root}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className={styles.box}>
        <label htmlFor={`${id}-input`} className="sr-only">
          Pergunta
        </label>
        <textarea
          id={`${id}-input`}
          ref={inputRef}
          className={styles.textarea}
          rows={1}
          placeholder="Escreva uma mensagem…"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby={describedBy}
          aria-invalid={problem ? true : undefined}
          autoComplete="off"
        />
        {problem ? (
          <p id={`${id}-problem`} className={styles.problem}>
            <CircleAlert size={16} aria-hidden="true" />
            {problem}
          </p>
        ) : null}
        {blockedReason ? (
          <p id={`${id}-blocked`} className={styles.problem}>
            <CircleAlert size={16} aria-hidden="true" />
            {blockedReason}
          </p>
        ) : null}
        <div className={styles.footer}>
          <p id={`${id}-hint`} className={styles.hint}>
            {busy ? "O agente está respondendo…" : "Enter envia · Shift + Enter quebra linha"}
          </p>
          {showCounter(value.length) ? (
            <p id={`${id}-count`} className={styles.hint}>
              {value.trim().length} / {MAX_MESSAGE_LENGTH} caracteres
            </p>
          ) : null}
          <div className={styles.actions}>
            {actions}
            {busy ? (
              <button type="button" className={`btn btn-icon btn-secondary ${styles.round}`} aria-label="Parar" title="Parar" onClick={onStop}>
                <Square size={16} aria-hidden="true" />
              </button>
            ) : null}
            <button type="submit" className={`btn btn-icon btn-primary ${styles.round} ${styles.send}`} aria-label="Enviar" title="Enviar" aria-disabled={cannotSend || undefined}>
              <ArrowUp size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
