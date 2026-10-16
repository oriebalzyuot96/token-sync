import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const CLI = fileURLToPath(new URL("../src/cli.js", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../examples/tokens.json", import.meta.url));

const exec = (args) =>
  run(process.execPath, [CLI, ...args]).then(
    (r) => ({ code: 0, stdout: r.stdout, stderr: r.stderr }),
    (e) => ({ code: e.code, stdout: e.stdout, stderr: e.stderr }),
  );

test("CLI writes tokens.css, tailwind.tokens.js and _theme.scss", async () => {
  const dir = await mkdtemp(join(tmpdir(), "token-sync-"));
  try {
    const out = join(dir, "generated");
    const result = await exec([EXAMPLE, "--out", out]);
    assert.equal(result.code, 0, result.stderr);

    for (const name of ["tokens.css", "tailwind.tokens.js", "_theme.scss"]) {
      await access(join(out, name));
    }
    const css = await readFile(join(out, "tokens.css"), "utf8");
    assert.match(css, /--color-brand: #1784bd;/);
    const scss = await readFile(join(out, "_theme.scss"), "utf8");
    assert.match(scss, /\$color-brand: #1784bd;/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI exits 1 with a readable message on a circular reference", async () => {
  const dir = await mkdtemp(join(tmpdir(), "token-sync-"));
  try {
    const input = join(dir, "cycle.json");
    await writeFile(input, JSON.stringify({ a: { $value: "{a}" } }));
    const result = await exec([input, "--out", join(dir, "out")]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Circular reference: a -> a/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI exits 2 when --out is missing", async () => {
  const result = await exec([EXAMPLE]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Missing required --out <dir>/);
});
