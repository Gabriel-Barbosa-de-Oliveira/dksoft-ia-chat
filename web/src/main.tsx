import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/fonts.css";
import "./styles/modernist.css";
import "./styles/app-tokens.css";
import "./styles/app.css";
import { App } from "./App.tsx";
import { createAccessKeyStore } from "./storage/access-key.ts";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App
      services={{
        baseUrl,
        fetch: (input, init) => fetch(input, init),
        accessKeyStore: createAccessKeyStore(),
      }}
    />
  </StrictMode>,
);
