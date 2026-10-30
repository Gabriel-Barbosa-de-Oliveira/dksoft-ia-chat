import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { StorageNotice } from "./StorageNotice.tsx";

test("aparece só com persisted=false, com ícone e texto", () => {
  assert.equal(renderToStaticMarkup(<StorageNotice persisted />), "");
  const html = renderToStaticMarkup(<StorageNotice persisted={false} />);
  assert.match(html, /Seu navegador bloqueou o armazenamento; a chave e o tema não serão lembrados\./);
  assert.match(html, /<svg[^>]*aria-hidden="true"/);
});
