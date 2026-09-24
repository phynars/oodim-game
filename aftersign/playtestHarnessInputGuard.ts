// Playtest harness-input guard (#1920).
//
// The flagship brief says milestone playtests must be acceptance evidence
// that the PLAYER can drive the game through visible controls — a tap on a
// rendered button, a keyboard press, a real pointer event. The
// `window.__game!.input.*` bridge (see `aftersign/main.js` and
// `flagship-phase2-input-delivery-contract.spec.ts`) is a harness seam
// intentionally exposed for contract coverage; it commits story state
// without going through any player-visible surface. That is correct for
// a contract test, and misleading for a playtest.
//
// Naming carries the boundary: files ending `.playtest.spec.ts` are
// player-facing acceptance evidence. Files ending only `.spec.ts` (no
// `playtest` segment) are contract tests. This guard enforces that
// boundary at the source level:
//
//   • `.playtest.spec.ts` files must NOT contain code-level uses of
//     `window.__game...input.<method>(...)`.  Reads of `window.__game`
//     (e.g. `window.__game?.scene?.ready`) are permitted — the guard
//     only rejects the `.input.<name>(` shape used to commit state.
//
//   • Comments (both `//` line and `/* … */` block) are stripped before
//     the scan, so an explanatory comment saying "this spec never calls
//     window.__game.input.*" does not trip the guard.  Every existing
//     `.playtest.spec.ts` file in `aftersign/e2e/` uses the phrase in a
//     comment; the strip is what keeps them green.
//
//   • Non-playtest files (`*.spec.ts` without the `.playtest.` segment)
//     are ignored entirely.  The existing
//     `flagship-phase2-input-delivery-contract.spec.ts` remains free to
//     drive `input.choose(...)` — that is the contract's whole job.
//
// Wire-in: this bundle is registered on the pure-runner in
// `aftersign/pure-runner.ts`, so `npm run test:aftersign:pure` (blocking
// on every PR) executes the real-repo scan AND three inline fixtures
// (playtest+harness → fails, playtest+DOM → passes, contract+harness →
// permitted) that pin the guard's own semantics.  Lives OUTSIDE
// `aftersign/src/` because it uses `node:fs` / `node:path`, which the
// aftersign tsconfig's `types: ["vite/client"]` deliberately excludes
// from the strict blocking gate over `src/`.
//
// Extension-resolution contract: this file has ZERO relative imports
// (only `node:` built-ins, which bypass the extension resolver), so the
// subgraph trivially satisfies the pure-runner extension-resolution
// contract documented in `aftersign/pure-runner.ts`.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Matches a code-level use of `window.__game<any chaining>.input.<name>(`
// where <name> is a plain identifier (choose, forceSave, forceReload,
// waitForStoryIdle, or anything future).  The chaining segment permits
// `!`, `?.`, `.`, whitespace, and nothing else — deliberately narrow so
// we don't rewrite a broader surface than the issue asks for.  The
// trailing `(` pins CALLS specifically; type-position references like
// `typeof window.__game?.input.choose` (no call parens) are permitted
// because they don't commit state.
//
// Callers strip comments FIRST so this only sees code.
const HARNESS_INPUT_CALL = /window\s*\.\s*__game[!?.\s]*\.\s*input[!?.\s]*\.\s*[A-Za-z_$][\w$]*\s*\(/;

// Strip `//` line comments and `/* … */` block comments from a TS source
// string.  Naive but sufficient for spec files — we're not parsing, we
// just need to keep an explanatory comment (`// this spec never calls
// window.__game.input.*`) from tripping the harness-call regex.
//
// String literals are preserved verbatim (including `//` inside them)
// so that a spec authoring a literal comment as a string would still
// count — but no shipped playtest does that, and a future one that
// did would legitimately be laundering the harness call through a
// string.
export function stripCommentsForGuard(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = i + 1 < n ? source[i + 1] : "";
    // Line comment
    if (ch === "/" && next === "/") {
      // Drop until newline (preserve the newline itself so line counts
      // don't shift for downstream tooling).
      const nl = source.indexOf("\n", i + 2);
      if (nl === -1) return out;
      i = nl;
      continue;
    }
    // Block comment
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) return out;
      i = end + 2;
      continue;
    }
    // String literals (single, double, template) — copy through so the
    // guard still catches `eval("window.__game.input.choose(…)")`-style
    // laundering.  We DO honor backslash escapes so a `\"` inside a
    // string doesn't close it early.
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < n) {
        const c = source[i];
        out += c;
        if (c === "\\" && i + 1 < n) {
          out += source[i + 1];
          i += 2;
          continue;
        }
        i += 1;
        if (c === quote) break;
      }
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

export type GuardViolation = {
  file: string;
  line: number;
  excerpt: string;
};

// Scan a single source string.  Returns violations (one per matching
// line, after comments are stripped).  The `file` field is the caller's
// label — the scanner doesn't know or care about the path.
export function scanPlaytestSourceForHarnessInput(
  file: string,
  source: string,
): GuardViolation[] {
  const stripped = stripCommentsForGuard(source);
  const lines = stripped.split("\n");
  const violations: GuardViolation[] = [];
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (HARNESS_INPUT_CALL.test(line)) {
      violations.push({
        file,
        line: idx + 1,
        excerpt: line.trim().slice(0, 200),
      });
    }
  }
  return violations;
}

// Only `.playtest.spec.ts` files are gated.  A file named
// `foo-playtest.spec.ts` (hyphen, not dot) is treated as a contract
// test — the boundary is the `.playtest.` segment before `.spec.ts`,
// mirroring the naming Soren has been enforcing in review.
export function isPlaytestSpecPath(file: string): boolean {
  return file.endsWith(".playtest.spec.ts");
}

function listPlaytestSpecs(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const specs: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (isPlaytestSpecPath(entry.name)) {
      specs.push(join(dir, entry.name));
    }
  }
  specs.sort();
  return specs;
}

// Real-repo scan: iterate every `.playtest.spec.ts` in `aftersign/e2e/`
// and throw on the first file that carries a harness-input call in
// code.  If the guard reds, the error names the file and line so the
// author can either move the offending line to a `.spec.ts` contract
// test or replace it with a rendered-page tap.
export function checkPlaytestHarnessInputBoundary(): void {
  const dir = join(process.cwd(), "aftersign", "e2e");
  const specs = listPlaytestSpecs(dir);
  const allViolations: GuardViolation[] = [];
  for (const spec of specs) {
    const source = readFileSync(spec, "utf8");
    const violations = scanPlaytestSourceForHarnessInput(spec, source);
    allViolations.push(...violations);
  }
  if (allViolations.length > 0) {
    const summary = allViolations
      .map((v) => `  ${v.file}:${v.line}: ${v.excerpt}`)
      .join("\n");
    throw new Error(
      [
        "Playtest harness-input guard: one or more .playtest.spec.ts files",
        "invoke window.__game...input.<name>(...) directly. Playtests must",
        "drive the game through rendered-page controls (tap, click, keydown).",
        "Move harness-driven coverage to a .spec.ts contract test, or replace",
        "the call with a visible-DOM interaction.",
        "",
        summary,
      ].join("\n"),
    );
  }
}

// Fixture-driven self-check: pins the three acceptance shapes so the
// guard's own semantics can't drift.  If a future edit relaxes the
// regex or forgets to strip comments, these fixtures red BEFORE the
// real-repo scan can silently start missing violations.
export function checkPlaytestHarnessInputGuardFixtures(): void {
  // Fixture (a) — playtest driving `window.__game.input.choose(...)`.
  // MUST be flagged.  Uses the `!` non-null form the shipped contract
  // spec uses, so the guard is proven to catch that exact shape.
  const failingPlaytest = [
    'import { test } from "@playwright/test";',
    "// this comment mentions window.__game.input.* but is not a call",
    'test("bad", async ({ page }) => {',
    '  await page.goto("/aftersign/");',
    '  await page.evaluate(() => window.__game!.input.choose("keep-sealed"));',
    "});",
    "",
  ].join("\n");
  const failingViolations = scanPlaytestSourceForHarnessInput(
    "fixture-a-playtest-with-harness.playtest.spec.ts",
    failingPlaytest,
  );
  if (failingViolations.length !== 1) {
    throw new Error(
      `Fixture (a) — playtest+harness — expected 1 violation, got ${failingViolations.length}`,
    );
  }
  if (failingViolations[0].line !== 5) {
    throw new Error(
      `Fixture (a) — expected violation on line 5 (the .input.choose call), got line ${failingViolations[0].line}`,
    );
  }

  // Fixture (b) — playtest that drives through visible DOM controls.
  // MUST pass.  Reads `window.__game?.scene?.ready` for readiness (not
  // an input call) and commits via `page.tap(...)`.  Also carries the
  // sentinel comment shipped playtests use ("this spec never calls
  // window.__game.input.*") to prove comment-stripping.
  const passingPlaytest = [
    'import { test, expect } from "@playwright/test";',
    "// This spec never calls window.__game.input.*.",
    'test("good", async ({ page }) => {',
    '  await page.goto("/aftersign/");',
    "  await page.waitForFunction(() => window.__game?.scene?.ready === true);",
    '  await page.locator("#packetButton").tap();',
    "});",
    "",
  ].join("\n");
  const passingViolations = scanPlaytestSourceForHarnessInput(
    "fixture-b-playtest-with-dom.playtest.spec.ts",
    passingPlaytest,
  );
  if (passingViolations.length !== 0) {
    throw new Error(
      [
        "Fixture (b) — playtest+DOM — expected 0 violations, got",
        `${passingViolations.length}:`,
        ...passingViolations.map((v) => `  line ${v.line}: ${v.excerpt}`),
      ].join("\n"),
    );
  }

  // Fixture (c) — a CONTRACT spec (no `.playtest.` segment) that uses
  // the harness bridge.  The guard's file-path filter must exclude it,
  // even though its source would trigger the regex.  We prove both:
  // (c1) `isPlaytestSpecPath` returns false, and (c2) the real-repo
  // scanner's listing step would not include this file.
  const contractPath = "flagship-phase2-input-delivery-contract.spec.ts";
  if (isPlaytestSpecPath(contractPath)) {
    throw new Error(
      `Fixture (c) — ${contractPath} must NOT be classified as a playtest spec`,
    );
  }
  // Also confirm the source shape the contract uses would trigger the
  // regex if it WERE a playtest — this is what makes fixture (c)
  // meaningful (otherwise the exemption would be vacuous).
  const contractSource = [
    'await page.evaluate(() => window.__game!.input.choose("keep-sealed"));',
    "",
  ].join("\n");
  const contractHits = scanPlaytestSourceForHarnessInput(
    contractPath,
    contractSource,
  );
  if (contractHits.length !== 1) {
    throw new Error(
      `Fixture (c) — the contract's harness-call shape must be recognized by the regex (proves the naming exemption is what protects it); got ${contractHits.length} hits`,
    );
  }

  // Fixture (d) — a `.playtest.spec.ts` whose ONLY occurrence of the
  // phrase is inside comments (both `//` and `/* */`).  Every shipped
  // playtest in `aftersign/e2e/` fits this shape today; the guard must
  // not red on them.
  const commentOnlyPlaytest = [
    "// Real player activation: touch the visible kiosk prompt. Do not",
    "// use window.__game.input.* or any private runtime seam.",
    "/*",
    " * window.__game.input.choose(...) is intentionally NOT called here.",
    " */",
    'import { test } from "@playwright/test";',
    'test("comments only", async ({ page }) => { await page.goto("/aftersign/"); });',
    "",
  ].join("\n");
  const commentOnlyViolations = scanPlaytestSourceForHarnessInput(
    "fixture-d-comments-only.playtest.spec.ts",
    commentOnlyPlaytest,
  );
  if (commentOnlyViolations.length !== 0) {
    throw new Error(
      [
        "Fixture (d) — comments-only playtest — expected 0 violations, got",
        `${commentOnlyViolations.length}:`,
        ...commentOnlyViolations.map((v) => `  line ${v.line}: ${v.excerpt}`),
      ].join("\n"),
    );
  }
}

// Pure-runner entry point: fixtures first (fast, deterministic, no
// filesystem beyond the caller-supplied strings), then the real-repo
// scan.  Ordering matters — if the fixtures red, the real scan's
// result is unreliable anyway, and the failure message is more
// diagnostic when it points at the fixture that broke.
export function runPlaytestHarnessInputGuardChecks(): void {
  checkPlaytestHarnessInputGuardFixtures();
  checkPlaytestHarnessInputBoundary();
}
