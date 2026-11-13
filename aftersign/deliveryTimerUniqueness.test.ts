// Delivery auto-advance timer uniqueness contract (#2788).
//
// `aftersign/e2e/helpers/deliveryTimer.ts` (`dropDeliveryAutoAdvance`)
// suppresses EVERY `setTimeout(..., 1180)` in the page. That is only safe
// while the served client has exactly one 1180 ms timer: the
// packet-delivered → io-return-recognition auto-advance in
// `aftersign/main.js` (`}, 1180);`). If a second timer with that delay
// appears, the helper would silently drop it too and specs would pass
// against a game that no longer behaves like the shipped one.
//
// Constrained source contract (no hand-rolled parenthesis scanner): every
// line of served JS is checked with comments removed, and the bare numeric
// token `1180` must show up exactly once across the scanned sources. That
// single hit must be the `}, 1180);` closing form, which is the shape
// the timer has in main.js. Any other spelling (`setTimeout(fn, 1180)` on one
// line, a `const DELAY = 1180`, etc.) reds this check. A maintainer must
// then decide on purpose whether the e2e helper still holds.
//
// Named `*.test.ts` on purpose: it is harness-only code that is never
// served, and scripts/served-reach.mjs (`NOT_SERVED_RE`) excludes test files
// from its reach and rendered-text rules. It lives at the `aftersign/` level,
// OUTSIDE `aftersign/tsconfig.json`'s `include: ["src"]`, so it can use
// `node:fs` / `node:path`. It resolves `aftersign/` from this module's own
// URL, not `process.cwd()`. It runs in the blocking pure lane through
// `aftersign/pure-runner.ts`. It has no relative imports, so it meets the
// runner's extension-resolution contract.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const AFTERSIGN_ROOT = dirname(fileURLToPath(import.meta.url));
const SKIP_DIRS = new Set(["node_modules", "dist", "e2e", "test-results", "playwright-report"]);
const DELAY_TOKEN = /(?<![\w.])1180(?![\w.])/g;
const TIMER_CLOSE_FORM = /^\s*\}\s*,\s*1180\s*\)\s*;?\s*$/;

function servedJavaScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : servedJavaScriptFiles(path);
    if (!entry.isFile() || !entry.name.endsWith(".js")) return [];
    if (/\.(test|spec)\.js$/.test(entry.name)) return [];
    return [path];
  });
}

// Removes `/* … */` block comments (multi-line ones too) and trailing `//`
// line comments. A `//` that follows a `:` is treated as part of a URL and
// kept. This is not a JS tokenizer. It is enough because the contract only
// asks about the bare numeric token, and every false positive fails closed:
// the check goes red and a human looks at it.
function codeLines(source: string): string[] {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "));
  return withoutBlocks.split("\n").map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"));
}

export function runDeliveryTimerUniquenessChecks(): void {
  const hits: Array<{ where: string; line: string }> = [];
  for (const file of servedJavaScriptFiles(AFTERSIGN_ROOT)) {
    const lines = codeLines(readFileSync(file, "utf8"));
    lines.forEach((line, index) => {
      const count = line.match(DELAY_TOKEN)?.length ?? 0;
      for (let i = 0; i < count; i += 1) {
        hits.push({ where: `${relative(AFTERSIGN_ROOT, file)}:${index + 1}`, line: line.trim() });
      }
    });
  }

  const summary = hits.map((hit) => `  ${hit.where}  ${hit.line}`).join("\n");
  if (hits.length !== 1) {
    throw new Error(
      `dropDeliveryAutoAdvance drops every 1180 ms timer, so served JS must contain exactly one ` +
        `1180 token (the delivery auto-advance in main.js). Found ${hits.length}:\n${summary}`,
    );
  }
  const [only] = hits;
  if (!only.where.startsWith("main.js:")) {
    throw new Error(`The only 1180 token must be in main.js (delivery auto-advance), found at ${only.where}`);
  }
  if (!TIMER_CLOSE_FORM.test(only.line)) {
    throw new Error(
      `The 1180 token at ${only.where} must be the setTimeout close "}, 1180);" ` +
        `(the delivery auto-advance), found: ${only.line}`,
    );
  }
}
