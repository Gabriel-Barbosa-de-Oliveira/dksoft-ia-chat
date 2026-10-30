import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnnouncerContext, type Announcer } from "../hooks/useAnnouncer.ts";

export function LiveRegion({ polite, alert }: { polite: string; alert: string }) {
  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="live-polite">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-atomic="true" data-testid="live-alert">
        {alert}
      </div>
    </>
  );
}

/** Limpa e reescreve a região em dois quadros, para o mesmo texto ser anunciado de novo. */
function useRewrite(): [string, (text: string) => void] {
  const [text, setText] = useState("");
  const frame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const write = useCallback((next: string) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    setText("");
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setText(next);
      });
    });
  }, []);
  return [text, write];
}

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, announce] = useRewrite();
  const [alertText, alert] = useRewrite();
  const value = useMemo<Announcer>(() => ({ announce, alert }), [announce, alert]);
  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <LiveRegion polite={polite} alert={alertText} />
    </AnnouncerContext.Provider>
  );
}
