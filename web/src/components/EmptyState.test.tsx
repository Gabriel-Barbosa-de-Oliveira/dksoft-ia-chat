import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { EmptyState } from "./EmptyState.tsx";
import { SUGGESTIONS } from "../lib/suggestions.ts";

test("4 botões com nome acessível igual ao texto", () => {
  const html = renderToStaticMarkup(<EmptyState onPick={() => {}} />);
  assert.match(html, /Como posso ajudar hoje\?/);
  const buttons = html.match(/<button[^>]*>[^<]*<\/button>/g) ?? [];
  assert.equal(buttons.length, 4);
  for (const text of SUGGESTIONS) assert.ok(html.includes(`>${text}</button>`), text);
});
