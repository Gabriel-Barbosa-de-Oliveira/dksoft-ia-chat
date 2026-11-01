import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { expect } from "./expect.ts";
import { ask, seriousViolations, startStack, type Stack } from "./helpers.ts";

let stack: Stack;
before(async () => void (stack = await startStack("result-only")));
after(async () => stack.close());
beforeEach(() => stack.api.setScenario("result-only"));

type Page = Awaited<ReturnType<Stack["open"]>>;
async function withPage(options: Parameters<Stack["open"]>[0], fn: (page: Page) => Promise<void>) {
  const page = await stack.open({ signedIn: true, ...options });
  try {
    await fn(page);
  } finally {
    await page.context().close();
  }
}

const exportButton = (page: Page) => page.getByRole("button", { name: "Exportar" });

test("resposta com dados mostra Exportar; escolher Excel gera o cartão com o pedido sempre mascarado", async () => {
  await withPage({}, async (page) => {
    await ask(page, "contas recebidas em outubro");
    await expect(exportButton(page)).toBeVisible(5000);
    await exportButton(page).click();
    await expect(page.getByText("Dados pessoais saem mascarados.")).toBeVisible();
    await page.getByRole("menuitem", { name: "Excel (.xlsx)" }).click();
    await expect(page.getByRole("region", { name: /Arquivo contas-recebidas.*\.xlsx/ })).toBeVisible(5000);
    const post = stack.api.requests.find((r) => r.method === "POST" && r.path === "/exports");
    assert.ok(post, "POST /exports feito");
  });
});

test("resposta sem dados não mostra Exportar", async () => {
  stack.api.setScenario("ok");
  await withPage({}, async (page) => {
    await ask(page, "olá");
    await expect(page.getByRole("button", { name: "Copiar" })).toBeVisible(5000);
    assert.equal(await exportButton(page).count(), 0);
  });
});

test("menu operável só com o teclado: Enter abre, setas navegam, Esc fecha e devolve o foco", async () => {
  await withPage({}, async (page) => {
    await ask(page, "contas recebidas em outubro");
    await expect(exportButton(page)).toBeVisible(5000);
    await exportButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "PDF" })).toBeVisible();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "PDF");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Excel (.xlsx)");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: "PDF" })).toBeHidden();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Exportar");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: /Arquivo contas-recebidas.*\.docx/ })).toBeVisible(5000);
  });
});

for (const theme of ["light", "dark"] as const) {
  test(`axe sem violações graves com o menu aberto, tema ${theme}`, async () => {
    await withPage({ theme }, async (page) => {
      await ask(page, "contas recebidas em outubro");
      await expect(exportButton(page)).toBeVisible(5000);
      await exportButton(page).click();
      await expect(page.getByRole("menuitem", { name: "PDF" })).toBeVisible();
      assert.deepEqual(await seriousViolations(page), []);
    });
  });
}

test("com gráfico: 'Incluir gráfico' desmarcado por padrão; marcado, o cartão ganha o selo e o pedido leva o gráfico", async () => {
  stack.api.setScenario("result-chart");
  await withPage({}, async (page) => {
    await ask(page, "recebimentos");
    await expect(exportButton(page)).toBeVisible(5000);
    // sem marcar: sem selo
    await exportButton(page).click();
    const box = page.getByRole("menuitemcheckbox", { name: "Incluir gráfico" });
    assert.equal(await box.getAttribute("aria-checked"), "false");
    await page.getByRole("menuitem", { name: "PDF" }).click();
    const first = page.getByRole("region", { name: /Arquivo contas-recebidas/ }).first();
    await expect(first).toBeVisible(5000);
    assert.equal(await first.getByText("Com gráfico").count(), 0);
    // marcado: com selo
    await exportButton(page).click();
    await page.getByRole("menuitemcheckbox", { name: "Incluir gráfico" }).click();
    assert.equal(await page.getByRole("menuitemcheckbox", { name: "Incluir gráfico" }).getAttribute("aria-checked"), "true");
    await page.getByRole("menuitem", { name: "Word (.docx)" }).click();
    await expect(page.getByText("Com gráfico")).toBeVisible(5000);
    assert.deepEqual(await seriousViolations(page), []);
  });
});
