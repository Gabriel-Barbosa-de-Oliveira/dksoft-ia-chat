import { useId, useState, type FormEvent } from "react";
import { CircleAlert, KeyRound } from "lucide-react";
import type { UserError } from "../lib/errors.ts";
import { StatusNotice } from "./StatusNotice.tsx";
import styles from "./AccessGate.module.css";

export interface AccessGateProps {
  onSubmit: (key: string) => void;
  validating: boolean;
  error: UserError | null;
  /** `session`: a chave foi recusada durante o uso. */
  reason?: "session" | null;
}

export function AccessGate({ onSubmit, validating, error, reason = null }: AccessGateProps) {
  const id = useId();
  const [key, setKey] = useState("");
  const errorId = `${id}-error`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (validating || key.trim() === "") return;
    onSubmit(key.trim());
  };

  return (
    <main className={styles.root}>
      <form className={styles.panel} onSubmit={submit} noValidate>
        <h1 className={styles.title}>Acesso ao chat</h1>
        <p className={styles.lead}>A chave de acesso é fornecida pela DKSOFT. Ela fica só nesta aba do navegador.</p>
        {reason === "session" ? (
          <StatusNotice variant="warning" title="Sua sessão expirou">
            Informe a chave de acesso de novo para continuar. A sua pergunta foi mantida.
          </StatusNotice>
        ) : null}
        <div className="field">
          <label htmlFor={`${id}-key`}>Chave de acesso</label>
          <input
            id={`${id}-key`}
            className="input"
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
          />
          {error ? (
            <p id={errorId} className={styles.error} role="alert">
              <CircleAlert className={styles.errorIcon} size={16} aria-hidden="true" />
              <span>
                <strong>{error.title}.</strong> {error.message}
                {error.supportCode ? ` Código de suporte: ${error.supportCode}.` : ""}
              </span>
            </p>
          ) : null}
        </div>
        <button type="submit" className={`btn btn-primary ${styles.submit}`} aria-busy={validating || undefined}>
          {validating ? "Verificando…" : "Entrar"}
          <KeyRound size={16} aria-hidden="true" />
        </button>
      </form>
    </main>
  );
}
