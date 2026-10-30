import type { ApiClient } from "./client.ts";
import { parseStreamFrame, type StreamEvent } from "../lib/events.ts";
import { ApiFailure, UnexpectedResponseError } from "../lib/failures.ts";
import { createSseDecoder } from "../lib/sse.ts";

export const CLIENT_DEADLINE_MS = 150_000;

export interface StreamChatOptions {
  client: ApiClient;
  message: string;
  conversationId: string | null;
  /** Aborto pedido pela pessoa ("Parar"): o iterável termina sem erro. */
  signal: AbortSignal;
  deadlineMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * `POST /chat` como fluxo de eventos tipados. Termina depois do primeiro evento terminal (`done`/`error`).
 * Lança `ApiFailure` para erro HTTP, rede, corte sem evento terminal (`connection_lost`),
 * prazo total estourado (`client_timeout`) e evento conhecido fora do schema (`unexpected_response`).
 */
export async function* streamChat(options: StreamChatOptions): AsyncGenerator<StreamEvent, void, void> {
  const {
    client,
    message,
    conversationId,
    signal,
    deadlineMs = CLIENT_DEADLINE_MS,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  } = options;

  const inner = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => inner.abort();
  if (signal.aborted) return;
  signal.addEventListener("abort", onCallerAbort, { once: true });
  const timer = setTimer(() => {
    timedOut = true;
    inner.abort();
  }, deadlineMs);

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  const cancelReader = () => void reader?.cancel().catch(() => {});
  inner.signal.addEventListener("abort", cancelReader, { once: true });

  try {
    const body = JSON.stringify(conversationId ? { message, conversationId } : { message });
    let response: Response;
    try {
      response = await client.open("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body,
        signal: inner.signal,
      });
    } catch (error) {
      if (isAbort(error)) {
        if (timedOut) throw new ApiFailure({ source: "client", kind: "client_timeout" });
        return;
      }
      throw error;
    }

    if (!response.body) throw new ApiFailure({ source: "client", kind: "unexpected_response" });
    reader = response.body.getReader();
    if (inner.signal.aborted) cancelReader();

    const text = new TextDecoder();
    const decoder = createSseDecoder();
    let requestId: string | null = null;
    let terminal = false;

    while (!terminal) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        if (isAbort(error) || inner.signal.aborted) break;
        throw new ApiFailure({ source: "network" });
      }
      if (chunk.done) break;

      for (const frame of decoder.feed(text.decode(chunk.value, { stream: true }))) {
        let event: StreamEvent | "ignored";
        try {
          event = parseStreamFrame(frame);
        } catch (error) {
          if (error instanceof UnexpectedResponseError) {
            throw new ApiFailure({ source: "client", kind: "unexpected_response", requestId });
          }
          throw error;
        }
        if (event === "ignored") continue;
        if ("requestId" in event) requestId = event.requestId;
        yield event;
        if (event.event === "done" || event.event === "error") {
          terminal = true;
          break;
        }
      }
    }

    if (terminal) {
      cancelReader();
      return;
    }
    if (timedOut) throw new ApiFailure({ source: "client", kind: "client_timeout", requestId });
    if (signal.aborted) return;
    throw new ApiFailure({ source: "client", kind: "connection_lost", requestId });
  } finally {
    clearTimer(timer);
    signal.removeEventListener("abort", onCallerAbort);
    inner.signal.removeEventListener("abort", cancelReader);
  }
}
