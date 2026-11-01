import { useEffect, useReducer, useState } from "react";
import { Check, Download, FileSpreadsheet, FileText, FileType, LoaderCircle, RotateCw } from "lucide-react";
import { useAnnouncer } from "../hooks/useAnnouncer.ts";
import { useExportApi, type ExportApi } from "../hooks/ExportContext.tsx";
import { type UserError } from "../lib/errors.ts";
import { fileExpiry, formatClock, formatSize, formatUntil, initialFileState, nextFileState, type FileCardState } from "../lib/export-state.ts";
import { FORMAT_LABEL, type FileDescriptor } from "../lib/file-descriptor.ts";
import { ApiFailure, toUserErrorFrom } from "../lib/failures.ts";
import styles from "./FileCard.module.css";

export interface FileCardProps {
  file: FileDescriptor;
  /** Gráfico do turno, reaproveitado ao gerar de novo um arquivo que o incluía. */
  chartId?: string;
  /** Operações de arquivo; por padrão vêm do `ExportContext`. */
  api?: ExportApi | null;
  /** Relógio inicial (ms) e estado inicial, injetáveis nos testes. */
  now?: number;
  initialState?: FileCardState;
}

const ICONS = { pdf: FileText, xlsx: FileSpreadsheet, docx: FileType } as const;

function isMissing(cause: unknown): boolean {
  return cause instanceof ApiFailure && cause.input.source === "http" && cause.input.body?.error === "file_not_found";
}

/** Cartão de um arquivo gerado: dados, validade e ação de baixar (ou gerar de novo). */
export function FileCard({ file, chartId, api: apiProp, now: nowProp, initialState = initialFileState }: FileCardProps) {
  const contextApi = useExportApi();
  const api = apiProp === undefined ? contextApi : apiProp;
  const announcer = useAnnouncer();
  const [state, dispatch] = useReducer(nextFileState, initialState);
  const [replaced, setReplaced] = useState<FileDescriptor | null>(null);
  const [regenError, setRegenError] = useState<UserError | null>(null);
  const [now, setNow] = useState(() => nowProp ?? Date.now());
  const shown = replaced ?? file;
  const expiry = fileExpiry(now, shown.expiresAt);

  useEffect(() => {
    if (expiry.expired) {
      dispatch({ type: "TICK", expired: true });
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiry.expired, shown.id]);

  const download = async () => {
    if (!api) return;
    dispatch({ type: "START" });
    try {
      await api.download(shown);
      dispatch({ type: "OK" });
      announcer.announce(`Download iniciado: ${shown.name}.`);
    } catch (cause) {
      if (isMissing(cause)) {
        dispatch({ type: "NOT_FOUND" });
        announcer.alert("Este arquivo não está mais disponível.");
        return;
      }
      const error = toUserErrorFrom(cause, "download");
      dispatch({ type: "FAIL", error });
      announcer.alert(`${error.title}. ${error.message}`);
    }
  };

  const regenerate = async () => {
    if (!api) return;
    setRegenError(null);
    dispatch({ type: "REGENERATE" });
    try {
      const next = await api.request({ resultId: shown.resultId, format: shown.format, ...(shown.includesChart && chartId ? { chartId } : {}) });
      setReplaced(next);
      setNow(Date.now());
      dispatch({ type: "READY" });
      announcer.announce(`Arquivo pronto: ${next.name}.`);
    } catch (cause) {
      const error = toUserErrorFrom(cause, "export");
      setRegenError(error);
      dispatch({ type: "REGEN_FAIL" });
      announcer.alert(`${error.title}. ${error.message}`);
    }
  };

  const Icon = ICONS[shown.format];
  const busy = state.kind === "downloading" || state.kind === "regenerating";
  const until = formatUntil(shown.expiresAt);

  return (
    <section className={styles.card} aria-label={`Arquivo ${shown.name}`} aria-busy={busy || undefined} data-state={state.kind}>
      <Icon className={styles.icon} size={24} aria-hidden="true" />
      <div className={styles.info}>
        <p className={styles.name}>{shown.name}</p>
        <p className={styles.meta}>
          {FORMAT_LABEL[shown.format]} · {formatSize(shown.sizeBytes)} · {shown.rowCount.toLocaleString("pt-BR")} {shown.rowCount === 1 ? "linha" : "linhas"}
          {state.kind !== "expired" && until !== "" ? ` · Válido até ${until}` : ""}
        </p>
        {state.kind !== "expired" && expiry.showCountdown ? <p className={styles.meta}>Expira em {formatClock(expiry.secondsLeft)}</p> : null}
        {shown.includesChart || shown.containsFullPersonalData ? (
          <p className={styles.badges}>
            {shown.includesChart ? <span className={styles.badge}>Com gráfico</span> : null}
            {shown.containsFullPersonalData ? <span className={styles.badge}>Dados pessoais completos</span> : null}
          </p>
        ) : null}
        {state.kind === "expired" ? (
          <p className={styles.notice}>{state.reason === "missing" ? "Este arquivo não está mais disponível." : "Este link expirou."}</p>
        ) : null}
        {state.kind === "error" ? (
          <p className={styles.notice} role="alert">
            {state.error.message}
            {state.error.supportCode ? <span className={styles.code}> Código de suporte: {state.error.supportCode}</span> : null}
          </p>
        ) : null}
        {regenError && state.kind === "expired" ? (
          <p className={styles.notice} role="alert">
            {regenError.message}
            {regenError.supportCode ? <span className={styles.code}> Código de suporte: {regenError.supportCode}</span> : null}
          </p>
        ) : null}
        {state.kind === "regenerating" ? <p className={styles.notice}>Gerando de novo…</p> : null}
      </div>
      <div className={styles.actions}>
        {state.kind === "ready" || state.kind === "downloaded" || state.kind === "error" || state.kind === "downloading" ? (
          <button type="button" className="btn btn-primary" onClick={download} disabled={!api || state.kind === "downloading"} aria-busy={state.kind === "downloading" || undefined}>
            {state.kind === "downloading" ? (
              <>
                Baixando…
                <LoaderCircle className={styles.spin} size={16} aria-hidden="true" />
              </>
            ) : state.kind === "downloaded" ? (
              <>
                Baixado
                <Check size={16} aria-hidden="true" />
              </>
            ) : state.kind === "error" ? (
              <>
                Tentar de novo
                <RotateCw size={16} aria-hidden="true" />
              </>
            ) : (
              <>
                Baixar
                <Download size={16} aria-hidden="true" />
              </>
            )}
          </button>
        ) : null}
        {state.kind === "downloaded" ? (
          <button type="button" className="btn btn-ghost" onClick={download}>
            Baixar de novo
          </button>
        ) : null}
        {state.kind === "expired" && api ? (
          <button type="button" className="btn btn-secondary" onClick={regenerate}>
            Gerar de novo
            <RotateCw size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

