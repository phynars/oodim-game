// Self-test for scripts/fail-to-pass.mjs (pure parts). Runs in the
// fail-to-pass CI job before the gate itself: `node --test scripts/fail-to-pass.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, decide, exemptReason, linkedIssues, verdict } from "./fail-to-pass.mjs";

test("linkedIssues: closing keywords only, deduped", () => {
  assert.deepEqual(linkedIssues("Closes #2116\nfixes #12, Resolves: #7. Refs #99"), [2116, 12, 7]);
  assert.deepEqual(linkedIssues("Refs #2124, Refs #2127 (not Closes)"), []);
  assert.deepEqual(linkedIssues(null), []);
});

test("exemptReason: needs a reason on its own line", () => {
  assert.equal(exemptReason("Fix.\nf2p-exempt: CSS-only z-index, no assertable surface"), "CSS-only z-index, no assertable surface");
  assert.equal(exemptReason("f2p-exempt:   "), null);
  assert.equal(exemptReason("no exemption here"), null);
});

test("classify: tests vs source; docs and workflows are neither", () => {
  const { tests, source } = classify([
    "aftersign/e2e/save.spec.ts",
    "apps/web/src/aftersign/offer.test.ts",
    "aftersign/src/main.js",
    "docs/plan/product-plan.md",
    "README.md",
    ".github/workflows/ci.yml",
    "apps/web/src/aftersign/vitest.config.ts",
    "aftersign/playwright.pure.config.ts",
    "aftersign/pure-runner.ts",
  ]);
  assert.deepEqual(tests, ["aftersign/e2e/save.spec.ts", "apps/web/src/aftersign/offer.test.ts"]);
  assert.deepEqual(source, ["aftersign/src/main.js"]);
});

test("decide: scope, exemption, no-test failure, test-only skip", () => {
  const t = ["a.test.ts"], s = ["a.ts"];
  assert.deepEqual(decide({ isBug: false, exempt: null, tests: [], source: s }), { result: "skipped:not_bug_fix", fail: false });
  assert.deepEqual(decide({ isBug: true, exempt: "css", tests: [], source: s }), { result: "skipped:exempt", fail: false });
  assert.deepEqual(decide({ isBug: true, exempt: null, tests: [], source: s }), { result: "no_test", fail: true });
  assert.deepEqual(decide({ isBug: true, exempt: null, tests: t, source: [] }), { result: "skipped:test_only", fail: false });
  assert.deepEqual(decide({ isBug: true, exempt: null, tests: [], source: [] }), { result: "skipped:test_only", fail: false });
  assert.deepEqual(decide({ isBug: true, exempt: null, tests: t, source: s }), { result: "run", fail: false });
});

test("verdict: reproduced / no_repro / load-error inconclusive / undiscovered", () => {
  assert.deepEqual(verdict([{ runner: "vitest", exit: 1, output: "AssertionError: expected 2 to be 3" }]), { result: "reproduced", fail: false });
  assert.deepEqual(verdict([{ runner: "vitest", exit: 0, output: "" }]), { result: "no_repro", fail: true });
  assert.deepEqual(verdict([{ runner: "vitest", exit: 1, output: "Error: Failed to load url ../src/newModule.ts" }]), { result: "inconclusive:load_error", fail: false });
  assert.deepEqual(
    verdict([{ runner: "vitest", exit: 1, output: "Cannot find module" }, { runner: "playwright:x", exit: 1, output: "expect(locator).toHaveText" }]),
    { result: "reproduced", fail: false },
  );
  assert.deepEqual(verdict([{ runner: "vitest", exit: 1, output: "No test files found, exiting with code 1" }]), { result: "inconclusive:load_error", fail: false });
  assert.deepEqual(verdict([{ runner: null, exit: null, output: "" }, { runner: "vitest", exit: 1, output: "assert" }]), { result: "undiscovered", fail: true });
});
