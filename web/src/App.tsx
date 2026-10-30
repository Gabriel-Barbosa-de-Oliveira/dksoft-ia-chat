import { useCallback, useMemo } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { createApiClient } from "./api/client.ts";
import { AccessGate } from "./components/AccessGate.tsx";
import { AnnouncerProvider } from "./components/LiveRegion.tsx";
import { useDraft } from "./hooks/DraftContext.tsx";
import { useAccessKey } from "./hooks/useAccessKey.ts";
import { ChatPage } from "./pages/ChatPage.tsx";
import type { AccessKeyStore } from "./storage/access-key.ts";

export interface AppServices {
  baseUrl: string;
  fetch: typeof fetch;
  accessKeyStore: AccessKeyStore;
}

export function App({ services }: { services: AppServices }) {
  const draft = useDraft();
  const access = useAccessKey({ store: services.accessKeyStore, baseUrl: services.baseUrl, fetch: services.fetch });
  const { expire: expireAccess, signOut: signOutAccess } = access;
  const { restoreInFlight, clear: clearDraft } = draft;
  // Chave recusada durante o uso: a pergunta em voo volta ao campo antes de ir à tela de acesso.
  const expire = useCallback(() => {
    restoreInFlight();
    expireAccess();
  }, [restoreInFlight, expireAccess]);
  const signOut = useCallback(() => {
    clearDraft();
    signOutAccess();
  }, [clearDraft, signOutAccess]);
  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: services.baseUrl,
        fetch: services.fetch,
        getKey: () => services.accessKeyStore.get(),
        onUnauthorized: expire,
      }),
    [services, expire],
  );

  if (!access.key) {
    return <AccessGate onSubmit={(k) => void access.signIn(k)} validating={access.validating} error={access.error} reason={access.reason} />;
  }

  return (
    <AnnouncerProvider>
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<ChatPage client={client} onSignOut={signOut} persisted={services.accessKeyStore.persisted} />} />
        </Routes>
      </BrowserRouter>
    </AnnouncerProvider>
  );
}
