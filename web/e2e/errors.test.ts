import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { expect } from "./expect.ts";
import { TEST_KEY, ask, signIn, startStack, type Stack } from "./helpers.ts";

let stack: Stack;
before(async () => void (stack = await startStack("ok")));
after(async () => stack.close());
beforeEach(async () => {
  await stack.startApi("ok");
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
const field = (page: P) => page.getByLabel("Pergunta", { exact: true });

async function noLeaks(page: P) {
  const text = await page.locator("body").innerText();
  assert.doesNotMatch(text, /TEXTO CRU|TypeError|stack|undefined|\[object|ECONN/i);
  assert.ok(!text.includes(TEST_KEY), "a chave não pode aparecer na tela");
}

test("servidor fora do ar: Sem conexão, pergunta de volta no campo e nova tentativa que funciona", async () => {
  await withPage({}, async (page) => {
    await stack.stopApi();
    await ask(page, "Pergunta sem servidor");
    await expect(page.locator("article").getByText("Sem conexão")).toBeVisible(5000);
    await expect(page.getByRole("button", { name: "Tentar novamente" }).last()).toBeVisible(1000);
    assert.equal(await field(page).inputValue(), "Pergunta sem servidor");
    await noLeaks(page);

    await stack.startApi("ok");
    await page.locator("article").getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByText("O aluno está")).toBeVisible(5000);
    assert.equal(await page.locator("article").count(), 1, "o turno com erro foi substituído");
  });
});

test("chave recusada durante o uso: volta à tela de acesso e a pergunta continua no campo (FR-018)", async () => {
  await withPage({}, async (page) => {
    await expect(page.getByRole("complementary").getByRole("link").first()).toBeVisible(5000);
    await expect(page.getByRole("complementary").getByText("Pergunta de exemplo número 3", { exact: false })).toBeVisible(5000); // prévias já carregadas
    const novaChave = "outra-chave-valida-com-32-caracteres";
    stack.api.setKey(novaChave);
    await ask(page, "Pergunta antes do 401");
    await expect(page.getByRole("heading", { level: 1, name: "Acesso ao chat" })).toBeVisible(5000);
    await expect(page.getByText("Sua sessão expirou")).toBeVisible(1000);
    await signIn(page, novaChave);
    assert.equal(await field(page).inputValue(), "Pergunta antes do 401");
  });
});

test("origem não autorizada: mensagem própria e código de suporte, sem nova tentativa", async () => {
  stack.api.setScenario("origin-denied");
  await withPage({}, async (page) => {
    await ask(page, "Teste");
    await expect(page.getByText("Endereço não autorizado")).toBeVisible(5000);
    await expect(page.getByText("Código de suporte:")).toBeVisible(1000);
    assert.equal(await page.locator("article").getByRole("button", { name: "Tentar novamente" }).count(), 0);
    await noLeaks(page);
  });
});

test("limite de uso: contagem regressiva, envio bloqueado e liberado ao zerar (FR-017)", async () => {
  stack.api.setScenario("rate-limited");
  await withPage({}, async (page) => {
    await ask(page, "Pergunta limitada");
    await expect(page.getByText("Muitas perguntas em pouco tempo")).toBeVisible(5000);
    await expect(page.getByText(/Você pode enviar de novo em \d+ s\./).first()).toBeVisible(2000);
    assert.equal(await field(page).inputValue(), "Pergunta limitada");
    assert.equal(await page.getByRole("button", { name: "Enviar" }).getAttribute("aria-disabled"), "true");

    await field(page).press("Enter");
    assert.equal(await page.locator("article").count(), 1, "bloqueado: nada foi reenviado");

    stack.api.setScenario("ok");
    await expect(page.getByText("Você já pode enviar de novo.").first()).toBeVisible(8000);
    assert.equal(await page.getByRole("button", { name: "Enviar" }).getAttribute("aria-disabled"), null);
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("O aluno está")).toBeVisible(5000);
    assert.equal(await page.locator("article").count(), 1, "o turno com erro foi substituído pelo reenvio");
  });
});

for (const [scenario, title] of [
  ["error-timeout", "A resposta demorou demais"],
  ["error-model", "Assistente indisponível"],
  ["error-tools", "Não foi possível consultar os dados"],
  ["error-internal", "Algo deu errado"],
] as const) {
  test(`erro no meio do stream (${scenario}): texto parcial mantido, mensagem própria e nova tentativa`, async () => {
    stack.api.setScenario(scenario);
    await withPage({}, async (page) => {
      await ask(page, "Pergunta que falha no meio");
      await expect(page.getByText(title)).toBeVisible(5000);
      assert.match((await page.locator("article").textContent()) ?? "", /Resultado parcial/);
      await expect(page.getByText("Código de suporte:")).toBeVisible(1000);
      await noLeaks(page);

      stack.api.setScenario("ok");
      await page.locator("article").getByRole("button", { name: "Tentar novamente" }).click();
      await expect(page.getByText("O aluno está")).toBeVisible(5000);
      assert.equal(await page.locator("article").count(), 1);
    });
  });
}

test("conexão cortada sem done: Conexão interrompida, nunca fica esperando (FR-019)", async () => {
  stack.api.setScenario("cut");
  await withPage({}, async (page) => {
    await ask(page, "Pergunta cortada");
    await expect(page.getByText("Conexão interrompida")).toBeVisible(5000);
    assert.match((await page.locator("article").textContent()) ?? "", /Resposta cortada/);
    assert.equal(await page.getByRole("button", { name: "Parar" }).count(), 0);
  });
});

test("evento fora do formato: Resposta inesperada", async () => {
  stack.api.setScenario("bad-body");
  await withPage({}, async (page) => {
    await ask(page, "Teste");
    await expect(page.getByText("Resposta inesperada")).toBeVisible(5000);
    await noLeaks(page);
  });
});

test("erro 500 antes do stream: Algo deu errado com código de suporte", async () => {
  stack.api.setScenario("server-500");
  await withPage({}, async (page) => {
    await ask(page, "Teste");
    await expect(page.getByText("Algo deu errado")).toBeVisible(5000);
    await expect(page.getByText("Código de suporte:")).toBeVisible(1000);
    assert.equal(await field(page).inputValue(), "Teste");
  });
});

test("falha ao listar conversas fica só no painel de histórico; o chat segue utilizável (FR-020)", async () => {
  stack.api.setScenario("list-fail");
  await withPage({}, async (page) => {
    const aside = page.getByRole("complementary");
    await expect(aside.getByText("Algo deu errado")).toBeVisible(5000);
    await ask(page, "Funciona mesmo assim?");
    await expect(page.getByText("O aluno está")).toBeVisible(5000);
    await expect(page.getByRole("button", { name: "Parar" })).toHaveCount(0); // resposta concluída
    await expect(aside.getByText("Algo deu errado")).toBeVisible(2000);

    stack.api.setScenario("ok");
    await aside.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(aside.getByRole("link").first()).toBeVisible(5000);
  });
});

test("o histórico de uma conversa que falha ao carregar mostra erro com nova tentativa", async () => {
  await withPage({}, async (page) => {
    const link = page.getByRole("complementary").getByRole("link").first();
    await expect(link).toBeVisible(5000);
    const id = (await link.getAttribute("href"))!.split("/c/")[1]!;
    // Só a leitura das mensagens cai; o resto da API segue de pé.
    const blocked = "**/conversations/*/messages";
    await page.route(blocked, (route) => route.abort("connectionrefused"));
    await link.click();
    await expect(page.getByRole("main").getByText("Sem conexão")).toBeVisible(5000);
    assert.ok(page.url().endsWith(`/c/${id}`));
    await page.unroute(blocked);
    await page.getByRole("main").getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByRole("main").getByText("Resposta", { exact: false })).toBeVisible(5000);
  });
});
