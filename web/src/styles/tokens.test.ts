// Guarda de tokens (SC-012, FR-022, FR-024).
// O oxlint não suporta `no-restricted-syntax`, então a varredura de cores/px/fontes literais mora aqui
// (decisão da T003): CSS próprio e literais de string em TS/TSX não podem ter hex, px ou fonte fora do DS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { compose, contrastRatio, parseColor, type Rgb } from "../lib/contrast.ts";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const STYLES = join(SRC, "styles");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const stripCssComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

// ---------- varredura de literais ----------

const DS_FILES = new Set(["modernist.css", "app-tokens.css"]);

test("CSS próprio só usa tokens (sem hex, rgb, hsl, px, fonte ou raio literais)", () => {
  const files = walk(SRC).filter((f) => f.endsWith(".css") && !DS_FILES.has(f.split("/").at(-1)!));
  assert.ok(files.length > 0);
  for (const file of files) {
    const css = stripCssComments(readFileSync(file, "utf8"));
    const name = relative(SRC, file);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, `${name}: hex literal`);
    assert.doesNotMatch(css, /\b(rgb|rgba|hsl|hsla)\(/, `${name}: cor funcional literal`);
    assert.doesNotMatch(css, /\d+(\.\d+)?px\b/, `${name}: px literal (use token ou rem)`);
    for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
      assert.match(m[1]!, /var\(--font-/, `${name}: font-family fora do DS`);
    }
    for (const m of css.matchAll(/border-radius\s*:\s*([^;}]+)/g)) {
      assert.match(m[1]!.trim(), /^(0|var\(--radius-[a-z]+\))$/, `${name}: border-radius literal`);
    }
  }
});

const TS_IGNORED = /(\.test\.tsx?$|__fixtures__|\/testing\/|lib\/contrast\.ts$|\/e2e\/)/;

test("literais de string em TS/TSX não têm hex nem px", () => {
  const files = walk(SRC).filter((f) => /\.tsx?$/.test(f) && !TS_IGNORED.test(f));
  for (const file of files) {
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const m of code.matchAll(/(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g)) {
      const literal = m[0];
      assert.doesNotMatch(literal, /#[0-9a-fA-F]{3,8}\b/, `${relative(SRC, file)}: hex em ${literal}`);
      assert.doesNotMatch(literal, /\b\d+px\b/, `${relative(SRC, file)}: px em ${literal}`);
    }
  }
});

// ---------- contraste ----------

type Vars = Map<string, string>;

interface Rule {
  selector: string;
  media: string | null;
  body: string;
}

function parseRules(css: string): Rule[] {
  const text = stripCssComments(css);
  const rules: Rule[] = [];
  const readBlock = (from: number): { body: string; end: number } => {
    let depth = 0;
    for (let i = from; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}" && --depth === 0) return { body: text.slice(from + 1, i), end: i + 1 };
    }
    throw new Error("chaves desbalanceadas");
  };
  const scan = (chunk: string, media: string | null) => {
    let i = 0;
    while (i < chunk.length) {
      const open = chunk.indexOf("{", i);
      if (open === -1) break;
      const head = chunk.slice(i, open).trim();
      const { body, end } = readBlockIn(chunk, open);
      if (head.startsWith("@media")) scan(body, head);
      else if (!head.startsWith("@")) rules.push({ selector: head, media, body });
      i = end;
    }
  };
  const readBlockIn = (chunk: string, from: number) => {
    let depth = 0;
    for (let i = from; i < chunk.length; i++) {
      if (chunk[i] === "{") depth++;
      if (chunk[i] === "}" && --depth === 0) return { body: chunk.slice(from + 1, i), end: i + 1 };
    }
    throw new Error("chaves desbalanceadas");
  };
  void readBlock;
  scan(text, null);
  return rules;
}

function declarations(body: string): Vars {
  const out: Vars = new Map();
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out.set(m[1]!, m[2]!.trim());
  return out;
}

const modernist = parseRules(readFileSync(join(STYLES, "modernist.css"), "utf8"));
const overlay = parseRules(readFileSync(join(STYLES, "app-tokens.css"), "utf8"));

const rootOf = (rules: Rule[]) => rules.find((r) => r.selector === ":root" && r.media === null)!;
const darkMedia = overlay.find((r) => r.media !== null && r.selector.includes(':not([data-theme="light"])'))!;
const darkAttr = overlay.find((r) => r.selector === ':root[data-theme="dark"]')!;

const lightVars: Vars = new Map([...declarations(rootOf(modernist).body), ...declarations(rootOf(overlay).body)]);
const darkVars: Vars = new Map([...lightVars, ...declarations(darkMedia.body)]);

function resolve(value: string, vars: Vars): string {
  let out = value;
  for (let guard = 0; guard < 20 && /var\(/.test(out); guard++) {
    out = out.replace(/var\((--[a-z0-9-]+)\)/g, (_m, name: string) => {
      const v = vars.get(name);
      if (v === undefined) throw new Error(`token indefinido: ${name}`);
      return v;
    });
  }
  return out;
}

/** Cor efetiva sobre `bg`: hex ou `color-mix(in srgb, <cor> N%, transparent)`. */
function effective(name: string, vars: Vars, bg: Rgb): Rgb {
  const raw = vars.get(name);
  if (raw === undefined) throw new Error(`token indefinido: ${name}`);
  const value = resolve(raw, vars);
  const mix = /^color-mix\(in srgb,\s*(#[0-9a-f]{3,6})\s+(\d+(?:\.\d+)?)%,\s*transparent\)$/i.exec(value);
  if (mix) return compose(parseColor(mix[1]!), Number(mix[2]) / 100, bg);
  return parseColor(value);
}

const PAIRS: ReadonlyArray<readonly [fg: string, bg: string, min: number]> = [
  ["--color-text", "--color-bg", 4.5],
  ["--color-text", "--color-surface", 4.5],
  ["--color-on-action", "--color-action", 4.5],
  ["--color-on-action", "--color-action-hover", 4.5],
  ["--color-on-action", "--color-action-pressed", 4.5],
  ["--color-link", "--color-bg", 4.5],
  ["--color-link", "--color-surface", 4.5],
  ["--color-action", "--color-bg", 3],
  ["--color-text-muted", "--color-bg", 4.5],
  ["--color-text-muted", "--color-surface", 4.5],
  ["--color-border-control", "--color-bg", 3],
  ["--color-border-control", "--color-surface", 3],
  ["--color-focus", "--color-bg", 3],
  ["--color-icon-alert", "--color-bg", 3],
  ["--color-icon-alert", "--color-surface", 3],
];

for (const [theme, vars] of [["claro", lightVars], ["escuro", darkVars]] as const) {
  test(`contraste mínimo no tema ${theme}`, () => {
    for (const [fg, bg, min] of PAIRS) {
      const bgRgb = effective(bg, vars, effective("--color-bg", vars, { r: 255, g: 255, b: 255 }));
      const ratio = contrastRatio(effective(fg, vars, bgRgb), bgRgb);
      assert.ok(ratio >= min, `${theme}: ${fg} sobre ${bg} = ${ratio.toFixed(2)} (mínimo ${min})`);
    }
  });
}

test("os dois blocos escuros têm declarações idênticas", () => {
  assert.deepEqual([...declarations(darkMedia.body)], [...declarations(darkAttr.body)]);
});

test("o tema escuro redefine todos os tokens de cor do tema claro que mudam de valor", () => {
  const mustBeRedefined = ["--color-bg", "--color-surface", "--color-text", "--color-divider", "--color-action", "--color-text-muted", "--color-border-control", "--color-focus", "--color-icon-alert"];
  const dark = declarations(darkMedia.body);
  for (const name of mustBeRedefined) assert.ok(dark.has(name), `faltou ${name} no tema escuro`);
});

test("a escala de espaçamento ampliada existe", () => {
  assert.equal(lightVars.get("--space-12"), "48px");
  assert.equal(lightVars.get("--space-16"), "64px");
});
