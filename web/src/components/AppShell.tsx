import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { AnnouncerProvider } from "./LiveRegion.tsx";
import styles from "./AppShell.module.css";

export interface AppShellProps {
  children: ReactNode;
  aside?: ReactNode;
  /** Controles da barra (por exemplo, histórico em tela estreita e tema). */
  tools?: ReactNode;
  onSignOut: () => void;
}

export const MAIN_ID = "conversa";

export function AppShell({ children, aside, tools, onSignOut }: AppShellProps) {
  return (
    <AnnouncerProvider>
      <div className={styles.shell}>
        <a href={`#${MAIN_ID}`} className="skip-link">
          Pular para a conversa
        </a>
        <header className="nav">
          <span className="nav-brand">DKSOFT IA</span>
          <div className={styles.tools}>
            {tools}
            <button type="button" className="btn btn-secondary" onClick={onSignOut}>
              Sair
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className={styles.body}>
          {aside ? (
            <aside className={styles.aside} aria-label="Histórico de conversas">
              {aside}
            </aside>
          ) : null}
          <main id={MAIN_ID} className={styles.main} tabIndex={-1}>
            <h1 className={styles.title}>Assistente DKSOFT</h1>
            {children}
          </main>
        </div>
      </div>
    </AnnouncerProvider>
  );
}
