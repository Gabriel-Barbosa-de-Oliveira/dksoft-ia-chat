import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { expect } from "./expect.ts";
import { ask, seriousViolations, startStack, type Stack } from "./helpers.ts";

let stack: Stack;
before(async () => void (stack = await startStack("chart")));
after(async () => stack.close());
beforeEach(() => stack.api.setScenario("chart"));

type Page = Awaited<ReturnType<Stack["open"]>>;
async function withPage(options: Parameters<Stack["open"]>[0], fn: (page: Page) => Promise<void>) {
  const page = await stack.open({ signedIn: true, ...options });
  try {
    await fn(page);
  } finally {
    await page.context().close();
  }
}

test("os três gráficos aparecem com título, legenda e descrição", async () => {
  await withPage({}, async (page) => {
    await ask(page, "como foram os recebimentos?");
    await expect(page.getByText("Recebido por semana").first()).toBeVisible(5000);
    await expect(page.getByText("Matrículas por mês").first()).toBeVisible();
    await expect(page.getByText("Alunos por pacote").first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Legenda" }).first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Legenda" }).getByText("Renovações")).toBeVisible();
  });
});

test("'Ver dados em tabela' abre só com o teclado e traz todos os valores", async () => {
  await withPage({}, async (page) => {
    await ask(page, "como foram os recebimentos?");
    await expect(page.getByText("Recebido por semana").first()).toBeVisible(5000);
    const summary = page.getByText("Ver dados em tabela").first();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("cell", { name: "R$ 12.300,00" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Sem 3" })).toBeVisible();
  });
});

test("reabrir a conversa pelo histórico mostra os mesmos gráficos; pergunta sem gráfico não mostra", async () => {
  await withPage({}, async (page) => {
    await ask(page, "como foram os recebimentos?");
    await expect(page.getByText("Alunos por pacote").first()).toBeVisible(5000);
    await expect(page.getByRole("button", { name: "Copiar" })).toBeVisible(5000);
    const path = new URL(page.url()).pathname;
    await page.goto(`${stack.appUrl}${path}`);
    await expect(page.getByText("Alunos por pacote").first()).toBeVisible(5000);
    assert.equal(await page.locator("figure").count(), 3);
  });
  stack.api.setScenario("ok");
  await withPage({}, async (page) => {
    await ask(page, "quantos alunos?");
    await expect(page.getByRole("button", { name: "Copiar" })).toBeVisible(5000);
    assert.equal(await page.locator("figure").count(), 0);
  });
});

for (const theme of ["light", "dark"] as const) {
  test(`axe sem violações graves com gráficos, tema ${theme}`, async () => {
    await withPage({ theme }, async (page) => {
      await ask(page, "como foram os recebimentos?");
      await expect(page.getByText("Alunos por pacote").first()).toBeVisible(5000);
      await page.getByText("Ver dados em tabela").first().click();
      assert.deepEqual(await seriousViolations(page), []);
    });
  });
}

test("em ~360 px não há rolagem horizontal da página e o axe passa", async () => {
  await withPage({ width: 360, height: 800 }, async (page) => {
    await ask(page, "como foram os recebimentos?");
    await expect(page.getByText("Alunos por pacote").first()).toBeVisible(5000);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `rolagem horizontal de ${overflow}`);
    assert.deepEqual(await seriousViolations(page), []);
  });
});
