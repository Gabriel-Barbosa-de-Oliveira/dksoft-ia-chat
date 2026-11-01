import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { expect } from "./expect.ts";
import { ask, startStack, type Stack } from "./helpers.ts";

let stack: Stack;
before(async () => void (stack = await startStack("result-only")));
after(async () => stack.close());

type Page = Awaited<ReturnType<Stack["open"]>>;
async function withPage(scenario: Parameters<Stack["api"]["setScenario"]>[0], fn: (page: Page) => Promise<void>) {
  stack.api.setScenario(scenario);
  const page = await stack.open({ signedIn: true });
  try {
    await fn(page);
  } finally {
    await page.context().close();
  }
}

async function exportAs(page: Page, item: string) {
  await ask(page, "contas recebidas");
  await page.getByRole("button", { name: "Exportar" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Exportar" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("resultado grande demais mostra o limite e a sugestão, com código de suporte", async () => {
  await withPage("export-too-large", async (page) => {
    await exportAs(page, "PDF");
    await expect(page.getByText("Esse resultado tem 7.000 linhas e o limite por arquivo é 5.000. Reduza o período ou use um filtro e tente de novo.")).toBeVisible();
    await expect(page.getByText(/Código de suporte/)).toBeVisible();
  });
});

test("fila ocupada bloqueia o botão com contagem e reabilita sozinho", async () => {
  await withPage("export-busy", async (page) => {
    await exportAs(page, "Excel (.xlsx)");
    await expect(page.getByText("Há outras exportações em andamento. Tente de novo em 3 segundos.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Aguarde \d s/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar" })).toBeVisible(6000);
    assert.equal(await page.locator("article").getByText(/Há outras exportações/).count(), 0, "o aviso some da resposta ao reabilitar");
  });
});

test("tempo esgotado e resultado vencido têm os textos do contrato; vencido esconde o botão", async () => {
  await withPage("export-timeout", async (page) => {
    await exportAs(page, "Word (.docx)");
    await expect(page.getByText("A geração do arquivo demorou mais que o esperado. Tente de novo ou reduza o período.")).toBeVisible();
  });
  await withPage("export-result-gone", async (page) => {
    await ask(page, "contas recebidas");
    await page.getByRole("button", { name: "Exportar" }).waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: "Exportar" }).click();
    await page.getByRole("menuitem", { name: "PDF" }).click();
    await expect(page.getByText(/Os dados dessa consulta não estão mais disponíveis para exportar\. Refaça a pergunta e exporte em seguida\./)).toBeVisible();
    assert.equal(await page.getByRole("button", { name: "Exportar" }).count(), 0);
  });
});

test("download com 404 antes do prazo mostra 'não está mais disponível' e Gerar de novo funciona", async () => {
  await withPage("export-gone", async (page) => {
    await ask(page, "me manda em PDF");
    const card = page.getByRole("region", { name: /Arquivo contas-recebidas/ });
    await card.getByRole("button", { name: "Baixar" }).click();
    await expect(card.getByText("Este arquivo não está mais disponível.")).toBeVisible();
    await card.getByRole("button", { name: "Gerar de novo" }).click();
    await expect(card.getByRole("button", { name: "Baixar" })).toBeVisible(5000);
  });
});

test("cartão vencido pelo relógio vira 'Este link expirou' e Gerar de novo traz um cartão válido", async () => {
  await withPage("file-short", async (page) => {
    await ask(page, "me manda em PDF");
    const card = page.getByRole("region", { name: /Arquivo contas-recebidas/ });
    await expect(card.getByText("Este link expirou.")).toBeVisible(8000);
    await card.getByRole("button", { name: "Gerar de novo" }).click();
    await expect(card.getByRole("button", { name: "Baixar" })).toBeVisible(5000);
    assert.equal(await card.getByText("Este link expirou.").count(), 0);
  });
});

test("conversa reaberta pelo histórico não mostra Exportar nem cartões", async () => {
  await withPage("export", async (page) => {
    await ask(page, "me manda em PDF");
    await expect(page.getByRole("region", { name: /Arquivo contas-recebidas/ })).toBeVisible(5000);
    await expect(page.getByRole("button", { name: "Copiar" })).toBeVisible(5000);
    const path = new URL(page.url()).pathname;
    await page.goto(`${stack.appUrl}${path}`);
    await expect(page.getByText("Encontrei 312 registros.")).toBeVisible(5000);
    assert.equal(await page.getByRole("button", { name: "Exportar" }).count(), 0);
    assert.equal(await page.getByRole("region", { name: /Arquivo / }).count(), 0);
  });
});
