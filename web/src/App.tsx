import { useMemo } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { createApiClient } from "./api/client.ts";
import { AccessGate } from "./components/AccessGate.tsx";
import { AppShell } from "./components/AppShell.tsx";
import { useAccessKey } from "./hooks/useAccessKey.ts";
import { ChatPage } from "./pages/ChatPage.tsx";
import type { AccessKeyStore } from "./storage/access-key.ts";

export interface AppServices {
  baseUrl: string;
  fetch: typeof fetch;
  accessKeyStore: AccessKeyStore;
}

export function App({ services }: { services: AppServices }) {
  const access = useAccessKey({ store: services.accessKeyStore, baseUrl: services.baseUrl, fetch: services.fetch });
  const { expire } = access;
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
    <BrowserRouter>
      <AppShell onSignOut={access.signOut}>
        <Routes>
          <Route path="/" element={<ChatPage client={client} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
