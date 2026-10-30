import { Check, LoaderCircle, X } from "lucide-react";
import type { ToolNotice } from "../lib/chat-reducer.ts";
import styles from "./ToolNotices.module.css";

const PHASE_TEXT = { running: "em andamento", ok: "concluída", failed: "falhou" } as const;

/** Avisos de consulta: sempre ícone e texto (nunca só cor). */
export function ToolNotices({ tools }: { tools: readonly ToolNotice[] }) {
  if (tools.length === 0) return null;
  return (
    <ul className={styles.list} aria-label="Consultas">
      {tools.map((tool, i) => (
        <li key={`${tool.name}-${i}`} className={styles.item}>
          {tool.phase === "running" ? (
            <LoaderCircle className={styles.spin} size={16} aria-hidden="true" />
          ) : tool.phase === "ok" ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <X size={16} aria-hidden="true" />
          )}
          <span>{tool.label}</span>
          <span className="sr-only"> ({PHASE_TEXT[tool.phase]})</span>
        </li>
      ))}
    </ul>
  );
}
