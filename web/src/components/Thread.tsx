import { useRef, type ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { useAutoFollow } from "../hooks/useAutoFollow.ts";
import type { Turn } from "../lib/chat-reducer.ts";
import { TurnView } from "./TurnView.tsx";
import styles from "./Thread.module.css";

export interface ThreadProps {
  turns: readonly Turn[];
  renderError?: (turn: Turn) => ReactNode;
}

export function Thread({ turns, renderError }: ThreadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const last = turns.at(-1);
  const { following, onScroll, scrollToEnd } = useAutoFollow(ref, `${turns.length}:${last?.text.length ?? 0}:${last?.tools.length ?? 0}:${last?.status ?? ""}`);

  return (
    <div className={styles.root}>
      <div ref={ref} className={styles.scroller} onScroll={onScroll} role="log" aria-label="Conversa" tabIndex={-1}>
        <div className={styles.column}>
          {turns.map((turn) => (
            <TurnView key={turn.key} turn={turn} renderError={renderError} />
          ))}
        </div>
      </div>
      {!following ? (
        <button type="button" className={`btn btn-secondary ${styles.follow}`} onClick={scrollToEnd}>
          Ir para o fim
          <ArrowDown size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
