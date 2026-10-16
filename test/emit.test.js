import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "../src/resolve.js";
import { emitCss, emitTailwind, emitAngularScss } from "../src/emit.js";

const loadExample = async () =>
  resolve(JSON.parse(await readFile(new URL("../examples/tokens.json", import.meta.url), "utf8")));

test("emitCss writes :root and [data-theme=dark] custom properties", async () => {
  const css = emitCss(await loadExample());
  assert.match(css, /:root \{/);
  assert.match(css, /--color-brand: #1784bd;/);
  assert.match(css, /\[data-theme=dark\] \{/);
  assert.match(css, /--color-brand: #5cb8e8;/);
  assert.match(css, /--space-2: 8px;/);
  assert.match(css, /--radius-md: 8px;/);
  assert.match(css, /--font-arabic: "Noto Sans Arabic", Tahoma, sans-serif;/);
  assert.match(css, /--motion-fast: 120ms;/);
});

test("emitTailwind exports a theme object that points at the CSS variables", async () => {
  const code = emitTailwind(await loadExample());
  assert.match(code, /export const theme = /);
  const mod = await import(`data:text/javascript,${encodeURIComponent(code)}`);
  assert.equal(mod.theme.colors.brand, "var(--color-brand)");
  assert.equal(mod.theme.spacing["2"], "var(--space-2)");
  assert.equal(mod.theme.borderRadius.md, "var(--radius-md)");
  assert.equal(mod.theme.fontFamily.arabic, "var(--font-arabic)");
  assert.equal(mod.theme.transitionDuration.fast, "var(--motion-fast)");
  assert.deepEqual(mod.default, mod.theme);
});

test("emitAngularScss writes SCSS variables and token maps", async () => {
  const scss = emitAngularScss(await loadExample());
  assert.match(scss, /\$color-brand: #1784bd;/);
  assert.match(scss, /\$space-4: 16px;/);
  assert.match(scss, /\$font-arabic: "Noto Sans Arabic", Tahoma, sans-serif;/);
  assert.match(scss, /\$tokens: \(/);
  assert.match(scss, /"color-brand": "#1784bd"/);
  assert.match(scss, /\$tokens-dark: \(/);
  assert.match(scss, /"color-brand": "#5cb8e8"/);
});
