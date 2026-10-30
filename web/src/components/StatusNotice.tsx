import type { ReactNode } from "react";
import { CircleAlert, OctagonX, TriangleAlert } from "lucide-react";
import styles from "./StatusNotice.module.css";

export type NoticeVariant = "error" | "warning" | "interrupted";

const LABELS: Record<NoticeVariant, string> = {
  error: "Erro",
  warning: "Aviso",
  interrupted: "Interrompida",
};

const ICONS = { error: CircleAlert, warning: TriangleAlert, interrupted: OctagonX } as const;

export interface StatusNoticeProps {
  variant: NoticeVariant;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}

/** Erro/aviso/interrupção: moldura + ícone + rótulo + texto (nunca só cor). */
export function StatusNotice({ variant, title, children, actions }: StatusNoticeProps) {
  const Icon = ICONS[variant];
  return (
    <div className={`${styles.root} ${styles[variant]}`} role={variant === "error" ? "alert" : undefined}>
      <div className={styles.label}>
        <Icon className={styles.icon} size={20} aria-hidden="true" />
        <span>{LABELS[variant]}</span>
      </div>
      <p className={styles.title}>{title}</p>
      {children ? <p className={styles.message}>{children}</p> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
