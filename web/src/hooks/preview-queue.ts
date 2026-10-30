import type { MessagesResponse } from "../lib/events.ts";
import { previewOf } from "../lib/conversation-label.ts";

export interface PreviewQueueOptions {
  getMessages: (conversationId: string) => Promise<MessagesResponse>;
  concurrency?: number;
  /** Avisa que um item novo ficou disponível (para re-renderizar). */
  onUpdate: () => void;
}

export interface PreviewQueue {
  /** Enfileira a busca da prévia (uma vez por conversa). */
  request(conversationId: string): void;
  /** `undefined`: ainda não buscada; `null`: falhou ou sem pergunta; string: prévia. */
  get(conversationId: string): string | null | undefined;
  /** Descarta o que ainda está na fila e ignora resultados em voo. */
  cancel(): void;
}

/** Busca prévias (trecho da primeira pergunta) com concorrência limitada e cache em memória. */
export function createPreviewQueue({ getMessages, concurrency = 2, onUpdate }: PreviewQueueOptions): PreviewQueue {
  const cache = new Map<string, string | null>();
  const seen = new Set<string>();
  let queue: string[] = [];
  let running = 0;
  let generation = 0;

  const pump = () => {
    while (running < concurrency && queue.length > 0) {
      const id = queue.shift()!;
      const mine = generation;
      running++;
      void getMessages(id)
        .then(
          (res) => {
            const first = res.messages.find((m) => m.role === "user");
            return first ? previewOf(first.content) : null;
          },
          () => null,
        )
        .then((value) => {
          running--;
          if (mine === generation) {
            cache.set(id, value);
            onUpdate();
          }
          pump();
        });
    }
  };

  return {
    request(id) {
      if (seen.has(id)) return;
      seen.add(id);
      queue.push(id);
      pump();
    },
    get: (id) => cache.get(id),
    cancel() {
      generation++;
      queue = [];
      seen.clear();
      cache.clear();
    },
  };
}
