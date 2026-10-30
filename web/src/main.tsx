import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/fonts.css";
import "./styles/modernist.css";
import "./styles/app-tokens.css";
import "./styles/app.css";
import { App } from "./App.tsx";
import { DraftProvider } from "./hooks/DraftContext.tsx";
import { createAccessKeyStore } from "./storage/access-key.ts";

const services = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  fetch: ((input, init) => fetch(input, init)) as typeof fetch,
  accessKeyStore: createAccessKeyStore(),
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DraftProvider>
      <App services={services} />
    </DraftProvider>
  </StrictMode>,
);
