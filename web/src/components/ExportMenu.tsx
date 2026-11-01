import { useEffect, useRef, useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";
import { useAnnouncer } from "../hooks/useAnnouncer.ts";
import { useExportApi, type ExportApi } from "../hooks/ExportContext.tsx";
import { useExport, type ExportRequestState } from "../hooks/useExport.ts";
import type { Turn } from "../lib/chat-reducer.ts";
import { deadlineFrom, remainingSeconds, shouldAnnounce } from "../lib/countdown.ts";
import { chartOfResult } from "../lib/export-state.ts";
import type { FileFormat } from "../lib/file-descriptor.ts";
import { menuKeyAction } from "../lib/menu-nav.ts";
import { ErrorPanel } from "./ErrorPanel.tsx";
import styles from "./ExportMenu.module.css";

export interface ExportMenuProps {
  turn: Pick<Turn, "key" | "charts"> & { result: NonNullable<Turn["result"]> };
  api?: ExportApi | null;
  /** Estado inicial do pedido e do menu, injetáveis nos testes. */
  initialState?: ExportRequestState;
  initialOpen?: boolean;
}

/** Espaço livre mínimo acima do botão para o menu abrir para cima (altura do menu + cabeçalho fixo). */
const MENU_ROOM = 320;

export const MASKED_NOTICE = "Dados pessoais saem mascarados. Para o arquivo com dados completos, peça no chat.";

const FORMATS: ReadonlyArray<{ id: FileFormat; label: string }> = [
  { id: "pdf", label: "PDF" },
  { id: "xlsx", label: "Excel (.xlsx)" },
  { id: "docx", label: "Word (.docx)" },
];

/** Controle "Exportar" da resposta: PDF, Excel ou Word, sempre com dados pessoais mascarados. */
export function ExportMenu({ turn, api: apiProp, initialState, initialOpen = false }: ExportMenuProps) {
  const contextApi = useExportApi();
  const api = apiProp === undefined ? contextApi : apiProp;
  const announcer = useAnnouncer();
  const exporter = useExport({ api, turnKey: turn.key, resultId: turn.result.resultId });
  const { clear } = exporter;
  const state = initialState ?? exporter.state;
  const [open, setOpen] = useState(initialOpen);
  const [includeChart, setIncludeChart] = useState(false);
  const [placement, setPlacement] = useState<"above" | "below">("above");
  const [wait, setWait] = useState<{ until: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLElement | null>>([]);
  const root = useRef<HTMLDivElement>(null);
  const chartId = chartOfResult(turn.charts, turn.result.resultId)?.id ?? null;
  const hasChart = chartId !== null;
  const error = state.status === "error" ? state.error : null;
  const gone = error?.kind === "result_not_found";
  const generating = state.status === "generating";
  const busySeconds = error?.kind === "export_busy" ? error.retryAfterSeconds : null;
  const waitLeft = busySeconds !== null ? (wait?.left ?? busySeconds) : null;
  const blocked = generating || waitLeft !== null;
  const count = FORMATS.length + (hasChart ? 1 : 0);

  // Fila cheia: bloqueia os itens e conta de volta sozinho.
  useEffect(() => {
    if (busySeconds === null) return;
    const until = deadlineFrom(Date.now(), busySeconds);
    let previous = busySeconds;
    const timer = setInterval(() => {
      const left = remainingSeconds(Date.now(), until);
      if (left !== previous) {
        if (shouldAnnounce(previous, left)) announcer.announce(left === 0 ? "Você já pode exportar de novo." : `Aguarde ${left} s para exportar de novo.`);
        previous = left;
        setWait(left === 0 ? null : { until, left });
      }
      if (left === 0) {
        clearInterval(timer);
        clear();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [busySeconds, announcer, clear]);

  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const choose = (format: FileFormat) => {
    close(true);
    void exporter.run(format, includeChart && hasChart ? chartId : null);
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const current = items.current.findIndex((el) => el === document.activeElement);
    const action = menuKeyAction(e.key, current, count);
    if (action.type === "none") return;
    if (action.type === "focus") {
      e.preventDefault();
      items.current[action.index]?.focus();
    } else {
      if (action.refocus) e.preventDefault();
      close(action.refocus);
    }
  };

  const label = generating ? "Gerando…" : waitLeft !== null ? `Aguarde ${waitLeft} s` : "Exportar";

  return (
    <div className={styles.root} ref={root}>
      {gone ? null : (
        <div className={styles.anchor}>
          <button
            ref={button}
            type="button"
            className="btn btn-ghost"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-busy={generating || undefined}
            aria-disabled={blocked || undefined}
            onClick={() => {
              if (blocked) return;
              // Perto do topo da tela (cabeçalho fixo) o menu abre para baixo; no resto, para cima.
              if (!open && button.current) setPlacement(button.current.getBoundingClientRect().top > MENU_ROOM ? "above" : "below");
              setOpen((v) => !v);
            }}
          >
            {label}
            {generating ? <LoaderCircle className={styles.spin} size={16} aria-hidden="true" /> : <FileDown size={16} aria-hidden="true" />}
          </button>
          {open ? (
            <div className={`${styles.popup} ${placement === "below" ? styles.below : ""}`}>
              <div role="menu" aria-label="Exportar resposta" className={styles.menu} onKeyDown={onMenuKeyDown}>
                {FORMATS.map((f, i) => (
                  <button
                    key={f.id}
                    ref={(el) => void (items.current[i] = el)}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    className={styles.item}
                    onClick={() => choose(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
                {hasChart ? (
                  <button
                    ref={(el) => void (items.current[FORMATS.length] = el)}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={includeChart}
                    tabIndex={-1}
                    className={styles.item}
                    onClick={() => setIncludeChart((v) => !v)}
                  >
                    <span className={styles.check} aria-hidden="true">
                      {includeChart ? "✓" : ""}
                    </span>
                    Incluir gráfico
                  </button>
                ) : null}
              </div>
              <p className={styles.notice}>{MASKED_NOTICE}</p>
            </div>
          ) : null}
        </div>
      )}
      {error ? (
        <div className={styles.error}>
          <ErrorPanel
            error={error}
            onRetry={error.action === "retry" ? () => void exporter.retry() : undefined}
            countdown={error.kind === "export_busy" ? waitLeft : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
