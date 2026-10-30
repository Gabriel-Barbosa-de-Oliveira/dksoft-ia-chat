import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { TEST_KEY, startStack, type Stack } from "./helpers.ts";

let stack: Stack;
before(async () => void (stack = await startStack("ok")));
after(async () => stack.close());

test("sem chave, só a tela de acesso aparece", async () => {
  const page = await stack.open();
  try {
    await page.getByRole("heading", { level: 1, name: "Acesso ao chat" }).waitFor();
    assert.equal(await page.getByLabel("Pergunta", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("heading", { name: "Sessões" }).count(), 0);
  } finally {
    await page.context().close();
  }
});

test("chave errada mostra erro junto ao campo; chave certa entra", async () => {
  const page = await stack.open();
  try {
    const field = page.getByLabel("Chave de acesso");
    await field.fill("chave-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByText("Chave incorreta").waitFor();
    const describedBy = await field.getAttribute("aria-describedby");
    assert.ok(describedBy);
    assert.match((await page.locator(`#${describedBy}`).textContent()) ?? "", /Chave incorreta/);
    assert.equal(await field.inputValue(), "chave-errada", "campo preservado");
    assert.equal(await field.isEnabled(), true);

    await field.fill(TEST_KEY);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.locator("#conversa").waitFor();
  } finally {
    await page.context().close();
  }
});

test("a chave não aparece no DOM, na URL nem no localStorage; só dksoft.accessKey no sessionStorage (SC-006)", async () => {
  const page = await stack.open();
  try {
    await page.getByLabel("Chave de acesso").fill(TEST_KEY);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.locator("#conversa").waitFor();

    assert.ok(!(await page.content()).includes(TEST_KEY), "chave no HTML");
    assert.ok(!page.url().includes(TEST_KEY), "chave na URL");
    const stored = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      localValues: Object.values(localStorage).join("|"),
    }));
    assert.deepEqual(stored.session, ["dksoft.accessKey"]);
    assert.ok(!stored.localValues.includes(TEST_KEY));
    assert.ok(stored.local.every((k) => k === "dksoft.theme"));
  } finally {
    await page.context().close();
  }
});

test("Sair volta à tela de acesso e esquece a chave", async () => {
  const page = await stack.open({ signedIn: true });
  try {
    await page.getByRole("button", { name: "Sair" }).click();
    await page.getByRole("heading", { level: 1, name: "Acesso ao chat" }).waitFor();
    assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage)), []);
  } finally {
    await page.context().close();
  }
});
