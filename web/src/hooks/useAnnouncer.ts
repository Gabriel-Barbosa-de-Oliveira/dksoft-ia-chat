import { createContext, useContext } from "react";

export interface Announcer {
  /** Anuncia de forma educada (região `aria-live="polite"`). */
  announce(text: string): void;
  /** Anuncia como alerta (`role="alert"`), para erros. */
  alert(text: string): void;
}

const silent: Announcer = { announce() {}, alert() {} };

export const AnnouncerContext = createContext<Announcer>(silent);

export function useAnnouncer(): Announcer {
  return useContext(AnnouncerContext);
}
