import { useEffect, useMemo, useReducer } from "react";
import { getMessages } from "../api/conversations.ts";
import type { ApiClient } from "../api/client.ts";
import { createPreviewQueue } from "./preview-queue.ts";

/** Prévias (trecho da primeira pergunta) buscadas só para itens visíveis, com concorrência 2. */
export function useConversationPreview(client: ApiClient) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const queue = useMemo(() => createPreviewQueue({ getMessages: (id) => getMessages(client, id), onUpdate: bump }), [client]);
  useEffect(() => () => queue.cancel(), [queue]);
  return { preview: queue.get, request: queue.request };
}
