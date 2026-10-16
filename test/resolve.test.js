import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "../src/resolve.js";

test("flattens nested groups to dotted paths and inherits $type", () => {
  const r = resolve({
    color: { $type: "color", brand: { neutral: { $value: "#000000" } } },
  });
  assert.deepEqual(r.tokens["color.brand.neutral"], {
    path: "color.brand.neutral",
    type: "color",
    value: "#000000",
  });
});

test("resolves direct references", () => {
  const r = resolve({
    color: {
      brand: { $value: "#1784bd", $type: "color" },
      link: { $value: "{color.brand}", $type: "color" },
    },
  });
  assert.equal(r.tokens["color.link"].value, "#1784bd");
});

test("resolves chained references", () => {
  const r = resolve({
    a: { $value: "#123456" },
    b: { $value: "{a}" },
    c: { $value: "{b}" },
  });
  assert.equal(r.tokens.c.value, "#123456");
});

test("resolves references embedded inside a larger string", () => {
  const r = resolve({
    color: { brand: { $value: "#1784bd" } },
    shadow: { $value: "0 0 0 2px {color.brand}" },
  });
  assert.equal(r.tokens.shadow.value, "0 0 0 2px #1784bd");
});

test("resolves dark overrides, including references inside dark values", () => {
  const r = resolve({
    color: {
      neutral: { 50: { $value: "#f5f7f9" } },
      text: {
        $value: "#1a1f24",
        $extensions: { modes: { dark: "{color.neutral.50}" } },
      },
    },
  });
  assert.equal(r.tokens["color.text"].value, "#1a1f24");
  assert.equal(r.dark["color.text"], "#f5f7f9");
  assert.equal(r.dark["color.neutral.50"], undefined);
});

test("detects a self reference as a cycle", () => {
  assert.throws(
    () => resolve({ a: { $value: "{a}" } }),
    /Circular reference: a -> a/,
  );
});

test("detects a longer cycle and reports the loop", () => {
  assert.throws(
    () =>
      resolve({
        a: { $value: "{b}" },
        b: { $value: "{c}" },
        c: { $value: "{a}" },
      }),
    /Circular reference: a -> b -> c -> a/,
  );
});

test("throws a clear error for a missing reference", () => {
  assert.throws(
    () => resolve({ a: { $value: "{nope.missing}" } }),
    /Missing reference "\{nope\.missing\}" in token "a": no token has the path "nope\.missing"/,
  );
});

test("throws when a dark override references a missing token", () => {
  assert.throws(
    () =>
      resolve({
        a: { $value: "#fff", $extensions: { modes: { dark: "{ghost}" } } },
      }),
    /Missing reference "\{ghost\}" in token "a"/,
  );
});

test("resolves the bundled example file", async () => {
  const source = JSON.parse(
    await readFile(new URL("../examples/tokens.json", import.meta.url), "utf8"),
  );
  const r = resolve(source);
  assert.equal(r.tokens["color.text"].value, "#1a1f24");
  assert.equal(r.dark["color.text"], "#f5f7f9");
  assert.equal(r.tokens["radius.md"].value, "8px");
  assert.equal(r.tokens["font.arabic"].value[0], "Noto Sans Arabic");
  assert.deepEqual(r.tokens["motion.fast"].value, { value: 120, unit: "ms" });
});
