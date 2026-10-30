import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import type { ConnectionStatus } from "../lib/conversation-list.ts";
import { ThemeSwitch } from "./ThemeSwitch.tsx";
import styles from "./AppShell.module.css";

export interface AppShellProps {
  children: ReactNode;
  /** Título da conversa aberta (o `h1` da tela). */
  title: string;
  /** Número da sessão aberta, quando ela já está na lista. */
  sessionLabel?: string | undefined;
  connection?: ConnectionStatus;
  /** Conteúdo da barra lateral (histórico de conversas). */
  aside?: ReactNode;
  /** Avisos discretos logo abaixo do cabeçalho (por exemplo, armazenamento bloqueado). */
  banner?: ReactNode;
  onSignOut: () => void;
}

export const MAIN_ID = "conversa";

const CONNECTION_LABELS: Record<ConnectionStatus, string> = {
  connecting: "Conectando…",
  connected: "Conectado",
  offline: "Sem conexão",
};

export function AppShell({ children, title, sessionLabel, connection, aside, banner, onSignOut }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    menuRef.current?.focus();
  }, []);

  // Barra aberta em tela estreita: o foco entra nela e `Esc` fecha.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Escolher uma conversa fecha a barra; os demais controles dela a mantêm aberta.
  const closeOnPick = (event: MouseEvent<HTMLElement>) => {
    if (open && (event.target as Element).closest("a, [data-closes-sidebar]")) close();
  };

  return (
    <div className={styles.shell}>
      <a href={`#${MAIN_ID}`} className="skip-link">
        Pular para a conversa
      </a>
      <aside id="sidebar" className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`} aria-label="Histórico de conversas" onClick={closeOnPick}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.brandName}>DKSoft IA</span>
          <button ref={closeRef} type="button" className={`btn btn-icon ${styles.close}`} aria-label="Fechar menu" onClick={close}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.content}>{aside}</div>
        <div className={styles.footer}>
          <button type="button" className={`btn btn-secondary ${styles.signOut}`} onClick={onSignOut}>
            <LogOut size={16} aria-hidden="true" />
            Sair
          </button>
          <ThemeSwitch />
        </div>
      </aside>
      {open ? <div className={styles.scrim} aria-hidden="true" onClick={close} /> : null}
      <main id={MAIN_ID} className={styles.main} tabIndex={-1}>
        <header className={styles.header}>
          <button
            ref={menuRef}
            type="button"
            className={`btn btn-icon btn-secondary ${styles.menu}`}
            aria-label="Abrir sessões"
            aria-expanded={open}
            aria-controls="sidebar"
            onClick={() => setOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className={styles.heading}>
            <h1 className={styles.title}>{title}</h1>
            {sessionLabel ? <span className={styles.session}>Sessão {sessionLabel}</span> : null}
          </div>
          {connection ? (
            <span className={styles.status} data-status={connection}>
              <span className={styles.dot} aria-hidden="true" />
              {CONNECTION_LABELS[connection]}
            </span>
          ) : null}
        </header>
        {banner}
        {children}
      </main>
    </div>
  );
}
