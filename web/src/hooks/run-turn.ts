import type { Announcer } from "./useAnnouncer.ts";
import type { ChatAction } from "../lib/chat-reducer.ts";
import { toUserError } from "../lib/errors.ts";
import type { StreamEvent } from "../lib/events.ts";
import { toUserErrorFrom } from "../lib/failures.ts";
import { createTokenBuffer } from "../lib/join-tokens.ts";

export interface RunTurnDeps {
  stream: AsyncIterable<StreamEvent>;
  dispatch: (action: ChatAction) => void;
  /** Agenda uma descarga por quadro de animação (injetável nos testes). */
  schedule: (fn: () => void) => unknown;
  cancelSchedule: (handle: unknown) => void;
  announcer: Announcer;
  /** Sinal do "Parar": permite distinguir interrupção de queda de conexão. */
  signal?: AbortSignal;
}

export interface RunTurnResult {
  conversationId: string | null;
}

function errorText(title: string, message: string): string {
  return `${title}. ${message}`;
}

/** Consome o fluxo de eventos e o traduz em ações do reducer, em lote para os tokens. Não é React. */
export async function runTurn(deps: RunTurnDeps): Promise<RunTurnResult> {
  const { stream, dispatch, schedule, cancelSchedule, announcer, signal } = deps;
  const buffer = createTokenBuffer();
  let handle: unknown = null;
  let conversationId: string | null = null;
  let terminal = false;

  const flush = () => {
    if (handle !== null) {
      cancelSchedule(handle);
      handle = null;
    }
    const text = buffer.drain();
    if (text !== "") dispatch({ type: "TOKENS", text });
  };

  const interrupted = () => {
    flush();
    dispatch({ type: "ABORT" });
    announcer.announce("Resposta interrompida.");
    terminal = true;
  };

  try {
    for await (const event of stream) {
      switch (event.event) {
        case "meta":
          conversationId = event.conversationId;
          dispatch({ type: "META", requestId: event.requestId, conversationId: event.conversationId });
          break;
        case "tool":
          flush();
          if (event.phase === "start") {
            dispatch({ type: "TOOL_START", name: event.name, label: event.label });
            announcer.announce(event.label);
          } else {
            dispatch({ type: "TOOL_END", name: event.name, label: event.label, ok: event.ok !== false });
          }
          break;
        case "token":
          buffer.push(event.text);
          if (handle === null) {
            handle = schedule(() => {
              handle = null;
              flush();
            });
          }
          break;
        case "done":
          flush();
          dispatch({ type: "DONE", requestId: event.requestId, model: event.model, partial: event.partial });
          announcer.announce(event.partial ? "Resposta concluída. Resultado parcial." : "Resposta concluída.");
          terminal = true;
          break;
        case "error": {
          flush();
          const error = toUserError({ source: "stream", code: event.code, requestId: event.requestId });
          dispatch({ type: "ERROR", error });
          announcer.alert(errorText(error.title, error.message));
          terminal = true;
          break;
        }
      }
    }
  } catch (cause) {
    if (signal?.aborted) {
      interrupted();
    } else {
      flush();
      const error = toUserErrorFrom(cause);
      dispatch({ type: "ERROR", error });
      announcer.alert(errorText(error.title, error.message));
      terminal = true;
    }
    return { conversationId };
  }

  if (!terminal) {
    if (signal?.aborted) {
      interrupted();
    } else {
      flush();
      const error = toUserError({ source: "client", kind: "connection_lost" });
      dispatch({ type: "ERROR", error });
      announcer.alert(errorText(error.title, error.message));
    }
  }
  return { conversationId };
}
