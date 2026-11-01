import type { UserError } from "./errors.ts";
import { remainingSeconds } from "./countdown.ts";

/** Estados do cartão de arquivo (contracts/ui.md). Puro: o relógio entra por parâmetro. */
export type FileCardState =
  | { kind: "ready" }
  | { kind: "downloading" }
  | { kind: "downloaded" }
  | { kind: "expired"; reason: "clock" | "missing" }
  | { kind: "error"; error: UserError }
  | { kind: "regenerating" };

export type FileCardEvent =
  | { type: "START" }
  | { type: "OK" }
  | { type: "FAIL"; error: UserError }
  | { type: "NOT_FOUND" }
  | { type: "TICK"; expired: boolean }
  | { type: "REGENERATE" }
  | { type: "READY" }
  | { type: "REGEN_FAIL" };

export const initialFileState: FileCardState = { kind: "ready" };

export function nextFileState(state: FileCardState, event: FileCardEvent): FileCardState {
  switch (event.type) {
    case "START":
      return state.kind === "ready" || state.kind === "downloaded" || state.kind === "error" ? { kind: "downloading" } : state;
    case "OK":
      return state.kind === "downloading" ? { kind: "downloaded" } : state;
    case "FAIL":
      return state.kind === "downloading" ? { kind: "error", error: event.error } : state;
    case "NOT_FOUND":
      return state.kind === "downloading" || state.kind === "ready" ? { kind: "expired", reason: "missing" } : state;
    case "TICK":
      if (!event.expired) return state;
      return state.kind === "ready" || state.kind === "downloaded" || state.kind === "error" ? { kind: "expired", reason: "clock" } : state;
    case "REGENERATE":
      return state.kind === "expired" ? { kind: "regenerating" } : state;
    case "READY":
      return state.kind === "regenerating" ? { kind: "ready" } : state;
    case "REGEN_FAIL":
      return state.kind === "regenerating" ? { kind: "expired", reason: "clock" } : state;
  }
}

export interface FileExpiry {
  expired: boolean;
  secondsLeft: number;
  /** A contagem textual aparece só nos últimos 5 minutos. */
  showCountdown: boolean;
}

export const COUNTDOWN_WINDOW_SECONDS = 300;

export function fileExpiry(now: number, expiresAt: string): FileExpiry {
  const deadline = Date.parse(expiresAt);
  if (Number.isNaN(deadline)) return { expired: true, secondsLeft: 0, showCountdown: false };
  const secondsLeft = remainingSeconds(now, deadline);
  return { expired: secondsLeft === 0, secondsLeft, showCountdown: secondsLeft > 0 && secondsLeft <= COUNTDOWN_WINDOW_SECONDS };
}

/** "mm:ss" para a contagem regressiva. */
export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** "Válido até hh:mm" no horário local. */
export function formatUntil(expiresAt: string, locale = "pt-BR"): string {
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
