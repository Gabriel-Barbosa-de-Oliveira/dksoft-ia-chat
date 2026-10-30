import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { DraftProvider, useDraft } from "./DraftContext.tsx";

function Probe() {
  const d = useDraft();
  return (
    <p>
      {[`draft=[${d.draft}]`, ...(["setDraft", "beginSend", "endSend", "restoreInFlight", "clear"] as const).map((k) => `${k}:${typeof d[k]}`)].join(" ")}
    </p>
  );
}

test("expõe o contrato e começa vazio", () => {
  const html = renderToStaticMarkup(
    <DraftProvider>
      <Probe />
    </DraftProvider>,
  );
  assert.match(html, /draft=\[\]/);
  for (const fn of ["setDraft", "beginSend", "endSend", "restoreInFlight", "clear"]) assert.ok(html.includes(`${fn}:function`), fn);
});

test("useDraft fora do provedor falha com mensagem clara", () => {
  assert.throws(() => renderToStaticMarkup(<Probe />), /DraftProvider/);
});

test("o rascunho vive só em memória: o módulo não toca em armazenamento", () => {
  const code = readFileSync(new URL("./DraftContext.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|document\.cookie/);
});
