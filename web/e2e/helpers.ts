import AxeBuilder from "@axe-core/playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { preview, type PreviewServer } from "vite";
import { TEST_KEY, startFakeApi, type FakeApi, type Scenario } from "./fake-api.ts";

export { TEST_KEY };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** O bundle E2E é construído com `--mode e2e` e aponta para esta porta (ver `.env.e2e`). */
export const FAKE_API_PORT = 3999;

export const WIDTHS = { phone: 320, tablet: 768, desktop: 1280 } as const;

export interface Stack {
  api: FakeApi;
  appUrl: string;
  browser: Browser;
  /** Abre uma página nova (contexto isolado) já na tela inicial. */
  open(options?: PageOptions): Promise<Page>;
  close(): Promise<void>;
}

export interface PageOptions {
  width?: number;
  height?: number;
  theme?: "light" | "dark";
  /** Tema do sistema (prefers-color-scheme). */
  colorScheme?: "light" | "dark";
  reducedMotion?: boolean;
  path?: string;
  /** Pré-define a chave em `sessionStorage` (pula a tela de acesso). */
  signedIn?: boolean;
}

export async function startStack(scenario: Scenario = "ok"): Promise<Stack> {
  const api = await startFakeApi({ port: FAKE_API_PORT, scenario });
  const server: PreviewServer = await preview({
    root: ROOT,
    configFile: join(ROOT, "vite.config.ts"),
    build: { outDir: "dist-e2e" },
    preview: { port: 0, strictPort: false, host: "127.0.0.1" },
    logLevel: "silent",
  });
  const appUrl = server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "";
  const browser = await chromium.launch();

  return {
    api,
    appUrl,
    browser,
    async open(options = {}) {
      const context = await browser.newContext({
        viewport: { width: options.width ?? WIDTHS.desktop, height: options.height ?? 800 },
        colorScheme: options.colorScheme ?? options.theme ?? "light",
        reducedMotion: options.reducedMotion ? "reduce" : "no-preference",
        locale: "pt-BR",
        permissions: ["clipboard-read", "clipboard-write"],
      });
      if (options.theme || options.signedIn) {
        await context.addInitScript(
          ({ theme, key }) => {
            if (theme) localStorage.setItem("dksoft.theme", theme);
            if (key && !sessionStorage.getItem("dksoft.accessKey")) sessionStorage.setItem("dksoft.accessKey", key);
          },
          { theme: options.theme ?? null, key: options.signedIn ? TEST_KEY : null },
        );
      }
      const page = await context.newPage();
      await page.goto(`${appUrl}${options.path ?? "/"}`);
      return page;
    },
    async close() {
      await browser.close();
      await server.close();
      await api.close();
    },
  };
}

export async function signIn(page: Page, key: string = TEST_KEY): Promise<void> {
  await page.getByLabel("Chave de acesso").fill(key);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByRole("heading", { level: 1, name: "Assistente DKSOFT" }).waitFor();
}

export async function ask(page: Page, text: string): Promise<void> {
  await page.getByLabel("Pergunta", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Enviar" }).click();
}

/** Violações de acessibilidade graves (WCAG 2.1 A/AA) da página no estado atual. */
export async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5) }));
}
