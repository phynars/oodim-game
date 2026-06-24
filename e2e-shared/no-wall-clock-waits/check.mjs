#!/usr/bin/env node
/**
 * Merge-gate guard for the no-wall-clock-waits rule
 * (see README.md in this directory; tracking issue #313).
 *
 * Scans every file under **\/e2e/** for `waitForTimeout(` calls.
 * A call is ALLOWED only if the same line OR the immediately
 * preceding line carries one of:
 *
 *   // pacing
 *   // allowed: <reason>
 *
 * Anything else is a violation. Comments mentioning waitForTimeout
 * (the ban itself, or this doc) are ignored — only real call
 * expressions count, because we strip line-comments before matching.
 *
 * Exits 1 on any violation, prints each offender with file:line.
 *
 * Usage (from repo root):
 *   node e2e-shared/no-wall-clock-waits/check.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

// directories whose names mean "this is e2e test code"
const E2E_DIR_RE = /(^|\/)e2e(\/|$)/;

// file extensions we scan
const EXT_RE = /\.(ts|tsx|js|mjs|cjs)$/;

// the call we're looking for — actual invocation, not a comment.
const CALL_RE = /waitForTimeout\s*\(/;

// allowance markers
const ALLOW_RE = /\/\/\s*(pacing|allowed:)/i;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const p = join(dir, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      yield* walk(p);
    } else if (s.isFile()) {
      yield p;
    }
  }
}

function isTestLine(line) {
  // strip line comments before deciding whether the call is real.
  // good enough for our test files; no template-string edge cases
  // actually use waitForTimeout in this repo.
  const codeOnly = line.replace(/\/\/.*$/, '');
  return CALL_RE.test(codeOnly);
}

const violations = [];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (!E2E_DIR_RE.test(rel)) continue;
  if (!EXT_RE.test(rel)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isTestLine(line)) continue;

    const sameLineAllowed = ALLOW_RE.test(line);
    const prevLineAllowed = i > 0 && ALLOW_RE.test(lines[i - 1]);

    if (sameLineAllowed || prevLineAllowed) continue;

    violations.push({ file: rel, line: i + 1, text: line.trim() });
  }
}

if (violations.length === 0) {
  console.log('no-wall-clock-waits: OK (0 violations)');
  process.exit(0);
}

console.error(
  `no-wall-clock-waits: ${violations.length} violation(s) — see e2e-shared/no-wall-clock-waits/README.md`,
);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}: ${v.text}`);
}
console.error('');
console.error(
  'Each waitForTimeout in **/e2e/** must either be replaced with a',
);
console.error(
  'state-quiesced waitForFunction OR be marked with `// pacing` or',
);
console.error('`// allowed: <reason>` on the same or preceding line.');
process.exit(1);
