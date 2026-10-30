import { useCallback, useMemo, useState } from "react";
import { validateAccessKey } from "../api/access.ts";
import type { UserError } from "../lib/errors.ts";
import type { AccessKeyStore } from "../storage/access-key.ts";

export interface AccessKeyState {
  key: string | null;
  validating: boolean;
  error: UserError | null;
  /** `session` quando a chave foi recusada durante o uso. */
  reason: "session" | null;
  signIn(key: string): Promise<void>;
  signOut(): void;
  /** Chave recusada durante o uso: limpa e volta à tela de acesso. */
  expire(): void;
}

export function useAccessKey(options: { store: AccessKeyStore; baseUrl: string; fetch: typeof fetch }): AccessKeyState {
  const { store, baseUrl, fetch: fetchFn } = options;
  const [key, setKey] = useState<string | null>(() => store.get());
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<UserError | null>(null);
  const [reason, setReason] = useState<"session" | null>(null);

  const signIn = useCallback(
    async (candidate: string) => {
      setValidating(true);
      setError(null);
      const result = await validateAccessKey({ baseUrl, key: candidate, fetch: fetchFn });
      setValidating(false);
      if (result.ok) {
        store.set(candidate);
        setKey(candidate);
        setReason(null);
      } else {
        setError(result.error);
      }
    },
    [store, baseUrl, fetchFn],
  );

  const signOut = useCallback(() => {
    store.clear();
    setKey(null);
    setError(null);
    setReason(null);
  }, [store]);

  const expire = useCallback(() => {
    store.clear();
    setKey(null);
    setError(null);
    setReason("session");
  }, [store]);

  return useMemo(() => ({ key, validating, error, reason, signIn, signOut, expire }), [key, validating, error, reason, signIn, signOut, expire]);
}
