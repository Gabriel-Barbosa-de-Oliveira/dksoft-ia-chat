import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { expect } from "./expect.ts";
import { TEST_KEY, ask, startStack, type Stack } from "./helpers.ts";

let stack: Stack;
before(async () => void (stack = await startStack("ok")));
after(async () => stack.close());
beforeEach(() => {
  stack.api.setScenario("ok");
  stack.api.seed(3);
});

type P = Awaited<ReturnType<Stack["open"]>>;
async function withPage(options: Parameters<Stack["open"]>[0], fn: (page: P) => Promise<void>) {
  const page = await stack.open({ signedIn: true, ...options });
  try {
    await fn(page);
  } finally {
    await page.context().close();
  }
}

const conversationLinks = (page: P) => page.getByRole("complementary").getByRole("link");
const log = (page: P) => page.getByRole("log", { name: "Conversa" });

test("lista com a mais recente primeiro e prévias que chegam depois", async () => {
  await withPage({}, async (page) => {
    await expect(conversationLinks(page)).toHaveCount(3, 5000);
    await expect(page.getByRole("complementary").getByText(/Pergunta de exemplo número 1/)).toBeVisible(5000);
    const first = await conversationLinks(page).first().textContent();
    assert.match(first ?? "", /número 1/);
    const last = await conversationLinks(page).last().textContent();
    assert.match(last ?? "", /número 3/);
  });
});

test("Carregar mais até a página curta", async () => {
  stack.api.seed(45);
  await withPage({}, async (page) => {
    await expect(conversationLinks(page)).toHaveCount(20, 5000);
    await page.getByRole("button", { name: "Carregar mais" }).click();
    await expect(conversationLinks(page)).toHaveCount(40, 5000);
    await page.getByRole("button", { name: "Carregar mais" }).click();
    await expect(conversationLinks(page)).toHaveCount(45, 5000);
    await expect(page.getByRole("button", { name: "Carregar mais" })).toBeHidden(2000);
  });
});

test("lista vazia mostra a próxima ação", async () => {
  stack.api.seed(0);
  await withPage({}, async (page) => {
    await expect(page.getByText("Nenhuma conversa ainda. Faça sua primeira pergunta.")).toBeVisible(5000);
    await expect(page.getByRole("button", { name: "Nova sessão" })).toBeVisible(1000);
  });
});

test("abrir uma conversa mostra as mensagens em ordem e marca a conversa aberta", async () => {
  await withPage({}, async (page) => {
    await page.getByRole("link", { name: /número 2/ }).click();
    await expect(page.getByText("Pergunta de exemplo número 2: quais pacotes estão disponíveis?").first()).toBeVisible(5000);
    await expect(log(page).getByText("do assistente.")).toBeVisible(5000);
    assert.match(page.url(), /\/c\/[0-9a-f-]{36}$/);
    const current = page.getByRole("complementary").locator('[aria-current="true"]');
    assert.match((await current.textContent()) ?? "", /número 2/);
  });
});

test("continuar a conversa acrescenta o par ao histórico do servidor", async () => {
  await withPage({}, async (page) => {
    await page.getByRole("link", { name: /número 2/ }).click();
    await expect(log(page).getByText("do assistente.")).toBeVisible(5000);
    const id = page.url().split("/c/")[1]!;
    await ask(page, "e a seguinte?");
    await expect(page.locator("article")).toHaveCount(2, 5000);
    await expect(page.locator("article").nth(1).getByRole("button", { name: "Copiar" })).toBeVisible(5000);
    assert.ok(page.url().endsWith(`/c/${id}`), "a URL continua na mesma conversa");
    const res = await fetch(`${stack.api.url}/conversations/${id}/messages`, { headers: { Authorization: `Bearer ${TEST_KEY}` } });
    const body = (await res.json()) as { messages: unknown[] };
    assert.equal(body.messages.length, 4);
  });
});

test("primeira pergunta leva a /c/:id e recarregar reabre a mesma conversa (SC-007)", async () => {
  await withPage({}, async (page) => {
    await ask(page, "Pergunta que eu quero rever");
    await expect(page.getByRole("button", { name: "Copiar" })).toBeVisible(5000);
    assert.match(page.url(), /\/c\/[0-9a-f-]{36}$/);
    const url = page.url();
    await page.reload();
    await expect(page.getByText("Pergunta que eu quero rever").first()).toBeVisible(5000);
    await expect(page.getByText("O aluno está")).toBeVisible(5000);
    assert.equal(page.url(), url);
    // A nova conversa também aparece na lista.
    await expect(conversationLinks(page)).toHaveCount(4, 5000);
  });
});

test("Nova sessão volta ao estado vazio e à raiz", async () => {
  await withPage({}, async (page) => {
    await page.getByRole("link", { name: /número 1/ }).click();
    await expect(log(page).getByText("do assistente.")).toBeVisible(5000);
    await page.getByRole("button", { name: "Nova sessão" }).click();
    await expect(page.getByRole("heading", { name: "Como posso ajudar hoje?" })).toBeVisible(5000);
    assert.equal(new URL(page.url()).pathname, "/");
  });
});

test("ids inválidos ou inexistentes mostram Conversa não encontrada", async () => {
  for (const path of ["/c/abc", "/c/00000000-0000-0000-0000-000000000000"]) {
    await withPage({ path }, async (page) => {
      await expect(page.getByText("Conversa não encontrada")).toBeVisible(5000);
      await page.getByRole("button", { name: "Iniciar nova conversa" }).click();
      await expect(page.getByRole("heading", { name: "Como posso ajudar hoje?" })).toBeVisible(5000);
      assert.equal(new URL(page.url()).pathname, "/");
    });
  }
});

test("rota desconhecida redireciona para a raiz", async () => {
  await withPage({ path: "/qualquer/coisa" }, async (page) => {
    await expect(page.getByRole("heading", { name: "Como posso ajudar hoje?" })).toBeVisible(5000);
    assert.equal(new URL(page.url()).pathname, "/");
  });
});

test("acionar uma sugestão só preenche o campo e foca nele", async () => {
  await withPage({}, async (page) => {
    await page.getByRole("button", { name: "Liste os pacotes disponíveis" }).click();
    const field = page.getByLabel("Pergunta", { exact: true });
    assert.equal(await field.inputValue(), "Liste os pacotes disponíveis");
    assert.equal(await field.evaluate((el) => el === document.activeElement), true);
    assert.equal(await page.locator("article").count(), 0);
  });
});

test("trocar de conversa durante a resposta pede confirmação (FR-026)", async () => {
  stack.api.setScenario("slow");
  await withPage({}, async (page) => {
    await ask(page, "Resposta longa");
    await expect(page.getByRole("button", { name: "Parar" })).toBeVisible(3000);
    const before = new URL(page.url()).pathname;
    await page.getByRole("link", { name: /número 2/ }).click();
    const dialog = page.getByRole("dialog", { name: "Interromper a resposta?" });
    await expect(dialog).toBeVisible(2000);

    await dialog.getByRole("button", { name: "Continuar aqui" }).click();
    await expect(dialog).toBeHidden(2000);
    assert.equal(await page.getByRole("button", { name: "Parar" }).count(), 1, "a resposta segue em andamento");
    assert.notEqual(before, "", "sanidade");

    await page.getByRole("link", { name: /número 2/ }).click();
    await dialog.getByRole("button", { name: "Interromper e trocar" }).click();
    await expect(page.getByText("Pergunta de exemplo número 2: quais pacotes estão disponíveis?").first()).toBeVisible(5000);
    assert.equal(await page.getByRole("button", { name: "Parar" }).count(), 0);
  });
});
