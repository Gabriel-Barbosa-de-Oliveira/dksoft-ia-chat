import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { EmptyState } from "./EmptyState.tsx";
import { SUGGESTIONS } from "../lib/suggestions.ts";

test("5 botões com nome acessível igual ao texto", () => {
  const html = renderToStaticMarkup(<EmptyState onPick={() => {}} />);
  assert.match(html, /O que você quer saber\?/);
  const buttons = html.match(/<button[^>]*>[^<]*<\/button>/g) ?? [];
  assert.equal(buttons.length, 5);
  for (const text of SUGGESTIONS) assert.ok(html.includes(`>${text}</button>`), text);
});
