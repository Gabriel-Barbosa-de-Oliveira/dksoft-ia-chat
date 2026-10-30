import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Composer, type ComposerProps } from "./Composer.tsx";

const base: ComposerProps = { value: "", onChange() {}, onSubmit() {}, onStop() {}, busy: false };
const render = (props: Partial<ComposerProps> = {}) => renderToStaticMarkup(<Composer {...base} {...props} />);

test("rótulo associado ao campo e dica ligada por aria-describedby", () => {
  const html = render();
  const forId = /<label for="([^"]+)">Pergunta<\/label>/.exec(html)?.[1];
  assert.ok(forId);
  assert.ok(html.includes(`id="${forId}"`));
  const hintId = /id="([^"]+-hint)"/.exec(html)?.[1];
  assert.ok(hintId);
  assert.match(html, new RegExp(`aria-describedby="[^"]*${hintId}`));
  assert.match(html, /Enter envia · Shift\+Enter quebra a linha/);
});

test("Parar só aparece durante a resposta", () => {
  assert.doesNotMatch(render(), /Parar/);
  const busy = render({ busy: true });
  assert.match(busy, /Parar/);
  assert.match(busy, /aria-disabled="true"/);
});

test("contador só a partir de 3600", () => {
  assert.doesNotMatch(render({ value: "a".repeat(3599) }), /\/4000/);
  assert.match(render({ value: "a".repeat(3600) }), /3600\/4000/);
});

test("excesso aparece em texto, com ícone, e marca o campo como inválido", () => {
  const html = render({ value: "a".repeat(4003) });
  assert.match(html, /A pergunta passou de 4000 caracteres em 3\./);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /<svg[^>]*aria-hidden="true"/);
});

test("motivo de bloqueio fica visível junto ao campo", () => {
  const html = render({ blocked: true, blockedReason: "Aguarde 30 s." });
  assert.match(html, /Aguarde 30 s\./);
  assert.match(html, /aria-disabled="true"/);
});

test("botões trazem rótulo visível e ícone decorativo", () => {
  const html = render({ busy: true });
  assert.match(html, /Enviar<svg[^>]*aria-hidden="true"/);
  assert.match(html, /Parar<svg[^>]*aria-hidden="true"/);
});
