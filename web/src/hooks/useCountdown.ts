import { useEffect, useRef, useState } from "react";
import { deadlineFrom, remainingSeconds, shouldAnnounce } from "../lib/countdown.ts";
import { useAnnouncer } from "./useAnnouncer.ts";

/**
 * Contagem regressiva em segundos a partir de `seconds` (null = inativa). Reinicia quando `resetKey` muda.
 * Anuncia a cada 15 s e ao zerar. O relógio é injetável.
 */
export function useCountdown(seconds: number | null, resetKey: string | null, now: () => number = Date.now): number | null {
  const announcer = useAnnouncer();
  const nowRef = useRef(now);
  const [state, setState] = useState<{ key: string | null; remaining: number | null }>({ key: resetKey, remaining: seconds });

  useEffect(() => {
    if (seconds === null) return;
    const deadline = deadlineFrom(nowRef.current(), seconds);
    let previous = seconds;
    const timer = setInterval(() => {
      const next = remainingSeconds(nowRef.current(), deadline);
      if (next !== previous) {
        if (shouldAnnounce(previous, next)) {
          announcer.announce(next === 0 ? "Você já pode enviar de novo." : `Aguarde ${next} s para enviar de novo.`);
        }
        previous = next;
        setState({ key: resetKey, remaining: next });
      }
      if (next === 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [seconds, resetKey, announcer]);

  if (seconds === null) return null;
  return state.key === resetKey ? state.remaining : seconds;
}
