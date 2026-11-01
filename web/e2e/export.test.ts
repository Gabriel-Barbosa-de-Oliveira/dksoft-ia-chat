import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { expect } from "./expect.ts";
import { FILE_BYTES } from "./fake-api.ts";
import { TEST_KEY, ask, startStack, type Stack } from "./helpers.ts";

let stack: Stack;
before(async () => void (stack = await startStack("export")));
after(async () => stack.close());
beforeEach(() => stack.api.setScenario("export"));

async function withPage(fn: (page: Awaited<ReturnType<Stack["open"]>>) => Promise<void>) {
  const page = await stack.open({ signedIn: true });
  try {
    await fn(page);
  } finally {
    await page.context().close();
  }
}

test("pedir o arquivo mostra o cartão e baixar entrega o conteúdo, com a chave só no cabeçalho", async () => {
  await withPage(async (page) => {
    await ask(page, "me manda isso em PDF");
    const card = page.getByRole("region", { name: /Arquivo contas-recebidas/ });
    await expect(card).toBeVisible(5000);
    await expect(card.getByText(/PDF · 47 KB · 312 linhas/)).toBeVisible();
    await expect(card.getByText(/Válido até \d{2}:\d{2}/)).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "Baixar" }).click()]);
    assert.match(download.suggestedFilename(), /^contas-recebidas-.*\.pdf$/);
    const path = await download.path();
    const { readFileSync } = await import("node:fs");
    assert.deepEqual(readFileSync(path), FILE_BYTES);
    await expect(card.getByRole("button", { name: "Baixado" })).toBeVisible();
    const get = stack.api.requests.find((r) => r.path.includes("/exports/") && r.method === "GET");
    assert.equal(get?.auth, `Bearer ${TEST_KEY}`);
    assert.ok(!get?.path.includes(TEST_KEY), "a chave nunca vai na URL");
  });
});

test("download sem chave é recusado pela API", async () => {
  const response = await fetch(`${stack.api.url}/conversations/x/exports/y`);
  assert.equal(response.status, 401);
});
