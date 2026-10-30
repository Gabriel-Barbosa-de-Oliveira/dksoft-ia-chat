import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmDialog } from "./ConfirmDialog.tsx";

const html = renderToStaticMarkup(
  <ConfirmDialog
    open
    title="Interromper a resposta?"
    message="Ao trocar de conversa a resposta em andamento será interrompida e não ficará no histórico."
    confirmLabel="Interromper e trocar"
    cancelLabel="Continuar aqui"
    onConfirm={() => {}}
    onCancel={() => {}}
  />,
);

test("é um <dialog> nomeado pelo título", () => {
  const labelled = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
  assert.match(html, /^<dialog/);
  assert.ok(labelled && html.includes(`id="${labelled}"`));
  assert.match(html, />Interromper a resposta\?<\/h2>/);
});

test("o botão seguro vem primeiro e recebe o foco inicial; o destrutivo é o principal", () => {
  const cancel = html.indexOf("Continuar aqui");
  const confirm = html.indexOf("Interromper e trocar");
  assert.ok(cancel > 0 && confirm > cancel);
  assert.match(html, /btn-secondary[^>]*autoFocus|autofocus[^>]*>Continuar aqui|btn-secondary"[^>]*>Continuar aqui/i);
  assert.match(html, /btn-primary[^>]*>Interromper e trocar/);
});
