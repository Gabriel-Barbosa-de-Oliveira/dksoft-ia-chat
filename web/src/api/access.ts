import { createApiClient } from "./client.ts";
import { ConversationPageSchema } from "../lib/events.ts";
import { toUserErrorFrom } from "../lib/failures.ts";
import type { UserError } from "../lib/errors.ts";

export type AccessResult = { ok: true } | { ok: false; error: UserError };

/** Valida uma chave candidata com `GET /conversations?limit=1`. A chave só viaja no cabeçalho Authorization. */
export async function validateAccessKey(options: { baseUrl: string; key: string; fetch: typeof fetch }): Promise<AccessResult> {
  const client = createApiClient({ baseUrl: options.baseUrl, getKey: () => options.key, fetch: options.fetch });
  try {
    await client.request("/conversations?limit=1", ConversationPageSchema);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toUserErrorFrom(error, "gate") };
  }
}
