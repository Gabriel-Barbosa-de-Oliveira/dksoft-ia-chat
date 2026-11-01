import { test } from "node:test";
import assert from "node:assert/strict";
import { menuKeyAction } from "./menu-nav.ts";

test("setas percorrem os itens com volta ao início e ao fim", () => {
  assert.deepEqual(menuKeyAction("ArrowDown", 0, 3), { type: "focus", index: 1 });
  assert.deepEqual(menuKeyAction("ArrowDown", 2, 3), { type: "focus", index: 0 });
  assert.deepEqual(menuKeyAction("ArrowUp", 0, 3), { type: "focus", index: 2 });
  assert.deepEqual(menuKeyAction("ArrowUp", 2, 3), { type: "focus", index: 1 });
  assert.deepEqual(menuKeyAction("ArrowDown", -1, 3), { type: "focus", index: 0 });
  assert.deepEqual(menuKeyAction("ArrowUp", -1, 3), { type: "focus", index: 2 });
});

test("Home, End, Esc (devolve o foco) e Tab (não devolve)", () => {
  assert.deepEqual(menuKeyAction("Home", 2, 3), { type: "focus", index: 0 });
  assert.deepEqual(menuKeyAction("End", 0, 3), { type: "focus", index: 2 });
  assert.deepEqual(menuKeyAction("Escape", 1, 3), { type: "close", refocus: true });
  assert.deepEqual(menuKeyAction("Tab", 1, 3), { type: "close", refocus: false });
});

test("outras teclas e menu vazio não fazem nada", () => {
  assert.deepEqual(menuKeyAction("a", 0, 3), { type: "none" });
  assert.deepEqual(menuKeyAction("ArrowDown", 0, 0), { type: "none" });
});
