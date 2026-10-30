import type { UserError } from "./errors.ts";

export type TurnStatus = "pending" | "working" | "streaming" | "done" | "error" | "interrupted";
export type ToolPhase = "running" | "ok" | "failed";

export interface ToolNotice {
  name: string;
  label: string;
  phase: ToolPhase;
}

export interface Turn {
  key: string;
  question: string;
  status: TurnStatus;
  tools: ToolNotice[];
  text: string;
  partial: boolean;
  error: UserError | null;
  requestId: string | null;
  model: string | null;
}

export type ConversationPhase = "empty" | "loading" | "ready" | "not-found" | "error";

export interface ConversationView {
  conversationId: string | null;
  phase: ConversationPhase;
  turns: Turn[];
  loadError: UserError | null;
}

export type ChatAction =
  | { type: "SEND"; question: string; key: string }
  | { type: "META"; requestId: string; conversationId: string }
  | { type: "TOOL_START"; name: string; label: string }
  | { type: "TOOL_END"; name: string; label: string; ok: boolean }
  | { type: "TOKENS"; text: string }
  | { type: "DONE"; requestId: string; model: string | null; partial: boolean }
  | { type: "ERROR"; error: UserError }
  | { type: "ABORT" }
  | { type: "RESET" };

export const initialView: ConversationView = {
  conversationId: null,
  phase: "empty",
  turns: [],
  loadError: null,
};

const ACTIVE: ReadonlySet<TurnStatus> = new Set(["pending", "working", "streaming"]);

export function isActive(turn: Turn | undefined): turn is Turn {
  return turn !== undefined && ACTIVE.has(turn.status);
}

export function activeTurn(view: ConversationView): Turn | undefined {
  const last = view.turns.at(-1);
  return isActive(last) ? last : undefined;
}

function updateLast(view: ConversationView, fn: (turn: Turn) => Turn): ConversationView {
  const last = view.turns.at(-1);
  if (!isActive(last)) return view; // eventos atrasados depois de um estado terminal são descartados
  return { ...view, turns: [...view.turns.slice(0, -1), fn(last)] };
}

function newTurn(question: string, key: string): Turn {
  return {
    key,
    question,
    status: "pending",
    tools: [],
    text: "",
    partial: false,
    error: null,
    requestId: null,
    model: null,
  };
}

function closeTool(tools: ToolNotice[], name: string, label: string, ok: boolean): ToolNotice[] {
  const phase: ToolPhase = ok ? "ok" : "failed";
  const index = tools.findIndex((t) => t.name === name && t.phase === "running");
  if (index === -1) return [...tools, { name, label, phase }];
  return tools.map((t, i) => (i === index ? { ...t, label, phase } : t));
}

export function chatReducer(view: ConversationView, action: ChatAction): ConversationView {
  switch (action.type) {
    case "SEND":
      if (activeTurn(view) || view.phase === "not-found" || view.phase === "loading") return view;
      return { ...view, phase: "ready", loadError: null, turns: [...view.turns, newTurn(action.question, action.key)] };
    case "META": {
      const next = updateLast(view, (t) => ({
        ...t,
        requestId: action.requestId,
        status: t.status === "pending" ? "working" : t.status,
      }));
      return next === view ? view : { ...next, conversationId: action.conversationId };
    }
    case "TOOL_START":
      return updateLast(view, (t) => ({
        ...t,
        status: t.status === "pending" ? "working" : t.status,
        tools: [...t.tools, { name: action.name, label: action.label, phase: "running" }],
      }));
    case "TOOL_END":
      return updateLast(view, (t) => ({
        ...t,
        status: t.status === "pending" ? "working" : t.status,
        tools: closeTool(t.tools, action.name, action.label, action.ok),
      }));
    case "TOKENS":
      if (action.text === "") return view;
      return updateLast(view, (t) => ({ ...t, status: "streaming", text: t.text + action.text }));
    case "DONE":
      return updateLast(view, (t) => ({
        ...t,
        status: "done",
        partial: action.partial,
        model: action.model,
        requestId: action.requestId,
        tools: t.tools.map((n) => (n.phase === "running" ? { ...n, phase: "ok" } : n)),
      }));
    case "ERROR":
      return updateLast(view, (t) => ({
        ...t,
        status: "error",
        error: action.error,
        requestId: action.error.supportCode ?? t.requestId,
        tools: t.tools.map((n) => (n.phase === "running" ? { ...n, phase: "failed" } : n)),
      }));
    case "ABORT":
      return updateLast(view, (t) => ({
        ...t,
        status: "interrupted",
        tools: t.tools.map((n) => (n.phase === "running" ? { ...n, phase: "failed" } : n)),
      }));
    case "RESET":
      return initialView;
  }
}
