// Unit tests for the served-reach gate's pure functions (no build here; the
// CI job runs the real gate). Run: node --test scripts/served-reach.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { addedStrings, clientCandidates, decide, exemptReason, inBundle, inRendered, renderedVerdict, servedCandidates } from "./served-reach.mjs";

test("rendered rule: bundled-but-never-shown copy fails, shown copy passes (#2499)", () => {
  const rendered = [
    "You came back. The packet is where you left it.",
    "You left before I finished the route. Keep that in mind next time.",
    "Deliver red tag to the recipient",
  ];
  assert.equal(inRendered("You left before I finished the route.", rendered), true);
  assert.equal(inRendered("You  came back.\n The packet", rendered), true, "whitespace in the literal is squashed");
  assert.equal(inRendered("You skipped my route. Instinct carried you once;", rendered), false);
});

test("rendered verdict: warn mode reports, fail mode blocks, exempt and no-text skip", () => {
  const miss = [{ file: "aftersign/main.js", text: "x y z" }];
  assert.deepEqual(renderedVerdict({ exempt: null, checked: 0, unrendered: [], mode: "fail" }), { result: "skipped:no_new_text", fail: false });
  assert.deepEqual(renderedVerdict({ exempt: "legacy save", checked: 1, unrendered: miss, mode: "fail" }), { result: "skipped:exempt", fail: false });
  assert.deepEqual(renderedVerdict({ exempt: null, checked: 1, unrendered: [], mode: "fail" }), { result: "rendered", fail: false });
  assert.deepEqual(renderedVerdict({ exempt: null, checked: 1, unrendered: miss, mode: "warn" }), { result: "text_not_rendered", fail: false });
  assert.deepEqual(renderedVerdict({ exempt: null, checked: 1, unrendered: miss, mode: "fail" }), { result: "text_not_rendered", fail: true });
});

test("clientCandidates drops the Worker (its strings are not rendered by the client)", () => {
  assert.deepEqual(clientCandidates(["src/server.ts", "aftersign/main.js", "apps/web/src/aftersign/x.test.ts"]), ["aftersign/main.js"]);
});

test("servedCandidates keeps product source, drops tests, harness, tooling and other games", () => {
  const files = [
    "apps/web/src/aftersign/ioFirstSceneDialogue.ts",
    "apps/web/src/aftersign/ioFirstSceneDialogue.test.ts",
    "apps/web/src/aftersign/ioVoiceContract.livePath.test.ts",
    "aftersign/main.js",
    "aftersign/e2e/orra.spec.ts",
    "aftersign/playwright.config.ts",
    "aftersign/pure-runner.ts",
    "aftersign/m-loop-playtest.acceptance.mjs",
    "aftersign/production-save-qa.mjs",
    "apps/web/src/aftersign/harness/bootWindowGame.ts",
    "apps/web/src/aftersign/routeRiskActionLabels.d.ts",
    "packages/aftersign/src/ioReturningSession.ts",
    "src/server.ts",
    "pacman/src/game.ts",
    "docs/flagship/BRIEF.md",
    "aftersign/index.html",
  ];
  assert.deepEqual(servedCandidates(files), [
    "apps/web/src/aftersign/ioFirstSceneDialogue.ts",
    "aftersign/main.js",
    "packages/aftersign/src/ioReturningSession.ts",
    "src/server.ts",
  ]);
});

test("addedStrings picks sentence-like literals from + lines only", () => {
  const diff = [
    "--- a/x.js",
    "+++ b/x.js",
    "-  return 'Io remembers the old line you saw before.';",
    "+  return 'Io remembers the last packet did not come home.';",
    '+  const id = "aftersign-kiosk";',
    "+  // 'a comment that looks like a sentence'",
    "+import { x } from '../apps/web/src/aftersign/some module path.js';",
    "+  const t = `Hello ${name}, welcome to the kiosk`;",
    "+  const s = \"She said \\\"bring it home\\\" twice today\";",
  ].join("\n");
  assert.deepEqual(addedStrings(diff), [
    "Io remembers the last packet did not come home.",
    'She said "bring it home" twice today',
  ]);
});

test("inBundle matches re-quoted and re-escaped spellings", () => {
  assert.equal(inBundle("Don't run before the bell rings", `x="Don't run before the bell rings"`), true);
  assert.equal(inBundle("Don't run before the bell rings", `x='Don\\'t run before the bell rings'`), true);
  assert.equal(inBundle("keep the route lit — always", 'x="keep the route lit \\u2014 always"'), true);
  assert.equal(inBundle("a line that never shipped at all", `x="something else entirely"`), false);
  // A backslash in the text is escaped before the quote in single-quoted output.
  assert.equal(inBundle("Io's path is C:\\games right there", `x='Io\\'s path is C:\\\\games right there'`), true);
});

test("exemptReason reads the PR-body line", () => {
  assert.equal(exemptReason("Body\nserved-exempt: wired in by #2400 next\n"), "wired in by #2400 next");
  assert.equal(exemptReason("f2p-exempt: other gate"), null);
  assert.equal(exemptReason(undefined), null);
});

test("decide: unreachable fails before text; exempt and no-source skip", () => {
  const base = { exempt: null, candidates: ["a.ts"], unreachable: [], missingText: [] };
  assert.deepEqual(decide({ ...base, candidates: [] }), { result: "skipped:no_served_source", fail: false });
  assert.deepEqual(decide({ ...base, exempt: "why", unreachable: ["a.ts"] }), { result: "skipped:exempt", fail: false });
  assert.deepEqual(decide({ ...base, unreachable: ["a.ts"], missingText: [{}] }), { result: "unreachable", fail: true });
  assert.deepEqual(decide({ ...base, missingText: [{ file: "a.ts", text: "t" }] }), { result: "text_not_shipped", fail: true });
  assert.deepEqual(decide(base), { result: "served", fail: false });
});
