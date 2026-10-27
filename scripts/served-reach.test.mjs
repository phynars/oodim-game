// Unit tests for the served-reach gate's pure functions (no build here; the
// CI job runs the real gate). Run: node --test scripts/served-reach.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { addedStrings, clientCandidates, decide, exemptReason, inBundle, inRendered, parseRendered, renderedVerdict, servedCandidates } from "./served-reach.mjs";

test("parseRendered: plain lines are real input, { t, via } lines are harness-only (#2529)", () => {
  const jsonl = [
    JSON.stringify("You came back.  The packet is where you left it."),
    JSON.stringify({ t: "Saint Orra: You said you'd come back. You did.", via: "input.choose" }),
    "not json",
    JSON.stringify({ t: "   " , via: "input.advance" }),
    "",
  ].join("\n");
  const { ui, harness } = parseRendered(jsonl);
  assert.deepEqual(ui, ["You came back. The packet is where you left it."]);
  assert.deepEqual(harness, [{ text: "Saint Orra: You said you'd come back. You did.", via: "input.choose" }]);
  // #2520's greeting: shown, but only through the harness, so it does not count.
  assert.equal(inRendered("You said you'd come back. You did.", ui), false);
});

test("rendered verdict: harness-only text is its own result and blocks in fail mode (#2529)", () => {
  const viaHarness = [{ file: "aftersign/main.js", text: "x y z", via: "input.choose" }];
  assert.deepEqual(renderedVerdict({ exempt: null, checked: 1, unrendered: viaHarness, mode: "warn" }), { result: "text_harness_only", fail: false });
  assert.deepEqual(renderedVerdict({ exempt: null, checked: 1, unrendered: viaHarness, mode: "fail" }), { result: "text_harness_only", fail: true });
  const mixed = [...viaHarness, { file: "aftersign/main.js", text: "a b c" }];
  assert.equal(renderedVerdict({ exempt: null, checked: 2, unrendered: mixed, mode: "warn" }).result, "text_not_rendered");
});

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

test("addedStrings skips CSS function values but keeps copy with parentheses", () => {
  const diff = [
    `+  el.style.transform = "translateY(0) scale(1)";`,
    `+  el.style.filter = 'drop-shadow(0 0 4px) blur(2px)';`,
    `+  const line = "Io waits (again) for the packet you promised.";`,
  ].join("\n");
  assert.deepEqual(addedStrings(diff), ["Io waits (again) for the packet you promised."]);
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

// Runs the real recorder (scripts/rendered-text-recorder.js) in a VM with a
// stub DOM, so the harness taint is tested without a browser (#2529).
function recorderPage(storage = new Map()) {
  const els = [];
  const posted = [];
  const on = {};
  let observer = null;
  const el = (text) => ({ nodeType: 1, isConnected: true, tagName: "DIV", textContent: text, childNodes: [{ nodeType: 3, nodeValue: text }], getAttribute: () => null, checkVisibility: () => true });
  const body = { tagName: "BODY", textContent: "", childNodes: [], getAttribute: () => null, checkVisibility: () => true };
  // A walker over the whole page from body, or over just one changed element.
  const walk = (root) => { const list = root === body ? [body, ...els] : [root]; let i = 0; return { currentNode: list[0], nextNode: () => list[++i] ?? null }; };
  const ctx = vm.createContext({
    document: { body, createTreeWalker: walk },
    location: { origin: "http://x" }, NodeFilter: { SHOW_ELEMENT: 1 },
    sessionStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) },
    fetch: (_u, o) => { posted.push(...JSON.parse(o.body)); return Promise.resolve(); },
    MutationObserver: class { constructor(cb) { observer = cb; } observe() {} }, setInterval: () => 0, setTimeout: () => 0,
    addEventListener: (type, fn) => { on[type] = fn; },
  });
  // `window` and the global are one object in a browser.
  vm.runInContext("var window = globalThis;", ctx);
  vm.runInContext(readFileSync(new URL("./rendered-text-recorder.js", import.meta.url), "utf8"), ctx);
  return {
    ctx, posted, show: (text) => els.push(el(text)), pagehide: () => on.pagehide(),
    // The game sets an element's text: the observer sees the added text node.
    setText: (text) => { const e = el(text); els.push(e); observer([{ type: "childList", addedNodes: [{ nodeType: 3, parentElement: e }] }]); },
  };
}

test("recorder: a text change is posted at once, so a spec that ends on the line still records it (#2530's greeting)", () => {
  const p = recorderPage();
  p.setText("Saint Orra: You lit the vigil. I remember the hand that kept it alive.");
  // No timer, no pagehide: the page may close right after the assertion.
  assert.deepEqual(p.posted, ["Saint Orra: You lit the vigil. I remember the hand that kept it alive."]);
});

test("recorder: lines after a story-moving harness call are tagged; read-only calls never taint; reset clears it (#2529)", () => {
  const p = recorderPage();
  const calls = [];
  p.ctx.__game = { getSnapshot: () => ({}), reset: () => calls.push("reset"), input: { choose: (id) => { calls.push(id); return true; }, waitForStoryIdle: () => {} } };
  const g = p.ctx.__game;
  p.show("Io: Take the blue packet to the kiosk.");
  g.getSnapshot();
  g.input.waitForStoryIdle();
  assert.equal(g.input.choose("return-to-orra"), true, "the wrapped call still runs and returns");
  p.show("Saint Orra: You said you'd come back. You did.");
  p.pagehide();
  g.reset(); // fresh player
  p.show("A real-input line after reset, shown by a click.");
  p.pagehide();
  assert.deepEqual(calls, ["return-to-orra", "reset"]);
  assert.deepEqual(p.posted, [
    "Io: Take the blue packet to the kiosk.",
    { t: "Io: Take the blue packet to the kiosk.", via: "input.choose" },
    { t: "Saint Orra: You said you'd come back. You did.", via: "input.choose" },
    // Orra's line is still on screen after reset; it stays harness-only.
    "A real-input line after reset, shown by a click.",
  ]);
});

test("recorder: the taint survives a reload in the same tab (harness, forceSave, reload)", () => {
  const storage = new Map();
  const a = recorderPage(storage);
  a.ctx.__game = { input: { choose: () => {}, forceSave: () => {} } };
  a.ctx.__game.input.choose("meet-orra");
  a.ctx.__game.input.forceSave();
  const b = recorderPage(storage); // page.reload(): new document, same sessionStorage
  b.show("Saint Orra: The kiosk remembers you.");
  b.pagehide();
  assert.deepEqual(b.posted, [{ t: "Saint Orra: The kiosk remembers you.", via: "input.choose" }]);
});
