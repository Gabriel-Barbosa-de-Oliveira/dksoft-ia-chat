import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export interface Draft {
  draft: string;
  setDraft: (value: string | ((previous: string) => string)) => void;
  /** Marca a pergunta que está sendo enviada (para recuperá-la se a chave for recusada no meio). */
  beginSend: (text: string) => void;
  endSend: () => void;
  /** Devolve ao campo a pergunta em voo, se o campo estiver vazio. */
  restoreInFlight: () => void;
  /** Esquece rascunho e pergunta em voo (ao sair). */
  clear: () => void;
}

const DraftContext = createContext<Draft | null>(null);

/** Rascunho em memória, acima da tela de acesso, para sobreviver à volta a ela. Nada vai a armazenamento. */
export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState("");
  const inFlight = useRef<string | null>(null);

  const setDraft = useCallback<Draft["setDraft"]>((value) => setDraftState(value), []);
  const beginSend = useCallback((text: string) => void (inFlight.current = text), []);
  const endSend = useCallback(() => void (inFlight.current = null), []);
  const restoreInFlight = useCallback(() => {
    const text = inFlight.current;
    inFlight.current = null;
    if (text) setDraftState((current) => (current === "" ? text : current));
  }, []);
  const clear = useCallback(() => {
    inFlight.current = null;
    setDraftState("");
  }, []);

  const value = useMemo(
    () => ({ draft, setDraft, beginSend, endSend, restoreInFlight, clear }),
    [draft, setDraft, beginSend, endSend, restoreInFlight, clear],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): Draft {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useDraft precisa de <DraftProvider>");
  return value;
}
