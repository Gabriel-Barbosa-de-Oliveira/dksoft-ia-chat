import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { expect } from "./expect.ts";
import { ask, startStack, type Stack } from "./helpers.ts";

let stack: Stack;
before(async () => void (stack = await startStack("ok")));
after(async () => stack.close());
beforeEach(() => stack.api.setScenario("ok"));

async function withPage(options: Parameters<Stack["open"]>[0], fn: (page: Awaited<ReturnType<Stack["open"]>>) => Promise<void>) {
  const page = await stack.open({ signedIn: true, ...options });
  try {
    await fn(page);
  } finally {
    await page.context().close();
  }
}

test("pergunta aparece de imediato e a resposta chega com avisos de consulta (SC-001)", async () => {
  stack.api.setScenario("slow");
  await withPage({}, async (page) => {
    await ask(page, "Quais pacotes estão disponíveis?");
    await expect(page.getByText("Quais pacotes estão disponíveis?").first()).toBeVisible(1000);
    await expect(page.getByRole("button", { name: "Parar" })).toBeVisible(1000);
    await expect(page.getByText("Buscando o aluno pela matrícula…")).toBeVisible(5000);
    await expect(page.getByText("palavra24")).toBeVisible(15000);
    await expect(page.getByRole("button", { name: "Copiar" })).toBeVisible(5000);
    assert.equal(await page.getByRole("button", { name: "Parar" }).count(), 0);
  });
});

test("resposta completa, Copiar leva o texto e o campo volta a funcionar", async () => {
  await withPage({}, async (page) => {
    await ask(page, "Como está o aluno?");
    await expect(page.getByText("O aluno está")).toBeVisible(5000);
    await page.getByRole("button", { name: "Copiar" }).click();
    await expect(page.getByRole("button", { name: "Copiado" })).toBeVisible(2000);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "O aluno está **ativo**.");
    assert.equal(await page.getByLabel("Pergunta", { exact: true }).inputValue(), "");
  });
});

test("Parar mantém o texto parcial e marca a resposta como interrompida", async () => {
  stack.api.setScenario("slow");
  await withPage({}, async (page) => {
    await ask(page, "Conte uma história longa");
    await expect(page.getByText("palavra3 ")).toBeVisible(8000);
    await page.getByRole("button", { name: "Parar" }).click();
    await expect(page.getByText("Resposta interrompida")).toBeVisible(2000);
    await expect(page.getByText("não será guardada no histórico")).toBeVisible(2000);
    assert.match((await page.locator("article").textContent()) ?? "", /palavra3/);
    assert.equal(await page.getByRole("button", { name: "Parar" }).count(), 0);
    await ask(page, "Outra pergunta");
    await expect(page.locator("article")).toHaveCount(2, 5000);
  });
});

test("durante a resposta o envio fica bloqueado e o texto digitado é mantido", async () => {
  stack.api.setScenario("slow");
  await withPage({}, async (page) => {
    await ask(page, "Primeira");
    await expect(page.getByRole("button", { name: "Parar" })).toBeVisible(2000);
    await page.getByLabel("Pergunta", { exact: true }).fill("Segunda pergunta");
    // `force`: o Playwright espera botões aria-disabled ficarem ativos; aqui queremos justamente clicar enquanto bloqueado.
    await page.getByRole("button", { name: "Enviar" }).click({ force: true });
    await page.getByLabel("Pergunta", { exact: true }).press("Enter");
    assert.equal(await page.locator("article").count(), 1);
    assert.equal(await page.getByLabel("Pergunta", { exact: true }).inputValue(), "Segunda pergunta");
    await page.getByRole("button", { name: "Parar" }).click();
  });
});

test("Enter envia e Shift+Enter quebra a linha", async () => {
  await withPage({}, async (page) => {
    const field = page.getByLabel("Pergunta", { exact: true });
    await field.fill("linha 1");
    await field.press("Shift+Enter");
    await field.type("linha 2");
    assert.equal(await field.inputValue(), "linha 1\nlinha 2");
    await field.press("Enter");
    await expect(page.locator("article")).toHaveCount(1, 3000);
  });
});

test("rolar para cima durante a resposta mostra Ir para o fim", async () => {
  stack.api.setScenario("slow");
  await withPage({ height: 420 }, async (page) => {
    await ask(page, "Texto longo");
    await expect(page.getByText("palavra8 ")).toBeVisible(8000);
    await page.locator('[role="log"]').evaluate((el) => (el.scrollTop = 0));
    await expect(page.getByRole("button", { name: "Ir para o fim" })).toBeVisible(2000);
    await page.getByRole("button", { name: "Ir para o fim" }).click();
    await expect(page.getByRole("button", { name: "Ir para o fim" })).toBeHidden(2000);
    await page.getByRole("button", { name: "Parar" }).click();
  });
});

test("tabela larga rola dentro do próprio bloco, sem rolagem horizontal da página", async () => {
  stack.api.setScenario("markdown-table");
  await withPage({ width: 320 }, async (page) => {
    await ask(page, "Liste os pacotes");
    const table = page.getByRole("region", { name: "Tabela da resposta" });
    await expect(table).toBeVisible(5000);
    const sizes = await table.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, tabIndex: (el as HTMLElement).tabIndex }));
    assert.ok(sizes.scroll > sizes.client, "a tabela deveria rolar dentro do bloco");
    assert.equal(sizes.tabIndex, 0);
    const page_ = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    assert.ok(page_.s <= page_.c, "a página não deve rolar na horizontal");
  });
});

test("HTML, script e javascript: na resposta não executam (SC-011)", async () => {
  stack.api.setScenario("malicious-markdown");
  await withPage({}, async (page) => {
    await ask(page, "Teste");
    await expect(page.getByText("fim.")).toBeVisible(5000);
    assert.equal(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned), undefined);
    assert.equal(await page.locator("article script").count(), 0);
    assert.equal(await page.locator("article img").count(), 0);
    assert.equal(await page.locator('article a[href^="javascript"]').count(), 0);
    assert.match((await page.locator("article").textContent()) ?? "", /<script>/);
  });
});

test("resultado parcial mostra aviso visível", async () => {
  stack.api.setScenario("partial");
  await withPage({}, async (page) => {
    await ask(page, "Liste tudo");
    await expect(page.getByText("Resultado parcial")).toBeVisible(5000);
    await expect(page.getByText("A lista está incompleta")).toBeVisible(1000);
  });
});

test("consulta que falha aparece com ícone e texto, sem derrubar a resposta", async () => {
  stack.api.setScenario("tool-fail");
  await withPage({}, async (page) => {
    await ask(page, "Teste");
    await expect(page.getByText("falhou")).toBeAttached(5000);
    await expect(page.getByText("O aluno está")).toBeVisible(5000);
  });
});

test("depois de uma conversa, o navegador só guarda a chave (sessão) e o tema (SC-006)", async () => {
  await withPage({ theme: "dark" }, async (page) => {
    await ask(page, "Pergunta com texto identificável XYZ123");
    await expect(page.getByText("O aluno está")).toBeVisible(5000);
    const stored = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      all: JSON.stringify({ ...localStorage, ...sessionStorage }),
    }));
    assert.deepEqual(stored.session, ["dksoft.accessKey"]);
    assert.deepEqual(stored.local, ["dksoft.theme"]);
    assert.ok(!stored.all.includes("XYZ123"));
  });
});
