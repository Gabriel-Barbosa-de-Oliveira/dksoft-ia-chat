import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

test("import de .module.css devolve o proxy de nomes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "css-"));
  const file = join(dir, "x.module.css");
  writeFileSync(file, ".foo { color: red }");
  const mod = (await import(pathToFileURL(file).href)) as { default: Record<string, string> };
  assert.equal(mod.default.foo, "foo");
  assert.equal(mod.default.barBaz, "barBaz");
});

test("import de efeito colateral não falha", async () => {
  const dir = mkdtempSync(join(tmpdir(), "css-"));
  const file = join(dir, "y.css");
  writeFileSync(file, "body { margin: 0 }");
  await import(pathToFileURL(file).href);
});
