#!/usr/bin/env node
// token-sync <tokens.json> --out <dir>
// Writes tokens.css, tailwind.tokens.js and _theme.scss into <dir>.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "./resolve.js";
import { emitCss, emitTailwind, emitAngularScss } from "./emit.js";

export const USAGE = `Usage: token-sync <tokens.json> --out <dir>

Reads a W3C-style design token file and writes:
  tokens.css            :root and [data-theme=dark] custom properties
  tailwind.tokens.js    Tailwind theme object
  _theme.scss           Angular/SCSS variables and maps

Options:
  -o, --out <dir>       Output directory (created if missing)
  -h, --help            Show this help`;

export class UsageError extends Error {}

export function parseArgs(argv) {
  const positional = [];
  let out;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") return { help: true };
    if (arg === "-o" || arg === "--out") {
      out = argv[++i];
      if (out === undefined) throw new UsageError("--out requires a directory");
    } else if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length);
    } else if (arg.startsWith("-")) {
      throw new UsageError(`Unknown option "${arg}"`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 1) throw new UsageError("Expected exactly one tokens.json path");
  if (!out) throw new UsageError("Missing required --out <dir>");
  return { input: positional[0], out };
}

// Runs the tool and returns the paths of the files written.
export async function run(argv) {
  const { input, out } = parseArgs(argv);

  let source;
  try {
    source = JSON.parse(await readFile(input, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`Token file not found: ${input}`);
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON in ${input}: ${error.message}`);
    throw error;
  }

  const resolved = resolve(source);
  const files = {
    "tokens.css": emitCss(resolved),
    "tailwind.tokens.js": emitTailwind(resolved),
    "_theme.scss": emitAngularScss(resolved),
  };

  await mkdir(out, { recursive: true });
  const written = [];
  for (const [name, content] of Object.entries(files)) {
    const target = join(out, name);
    await writeFile(target, content, "utf8");
    written.push(target);
  }
  return written;
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const parsed = parseArgs(argv);
    if (parsed.help) {
      console.log(USAGE);
      return 0;
    }
    const written = await run(argv);
    for (const file of written) console.log(`wrote ${file}`);
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`token-sync: ${error.message}\n\n${USAGE}`);
      return 2;
    }
    console.error(`token-sync: ${error.message}`);
    return 1;
  }
}

const isEntry =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (isEntry) {
  process.exitCode = await main();
}
