import { test } from "node:test";
import assert from "node:assert/strict";
import { START, END, upsertEvidence, e2eStats, renderedSummary, renderEvidence, servedSummary } from "./pr-ci-evidence.mjs";

const block = (x) => `${START}\n${x}\n${END}`;

test("upsert appends to a body without a block", () => {
  assert.equal(upsertEvidence("notes", block("a")), `notes\n\n${block("a")}`);
  assert.equal(upsertEvidence("", block("a")), block("a"));
  assert.equal(upsertEvidence(null, block("a")), block("a"));
});

test("upsert replaces the previous block and keeps the rest of the body", () => {
  const body = `top\n\n${block("old")}\n\nbottom`;
  assert.equal(upsertEvidence(body, block("new")), `top\n\n${block("new")}\n\nbottom`);
  assert.equal(upsertEvidence(upsertEvidence(body, block("x")), block("x")), upsertEvidence(body, block("x")));
});

test("upsert appends when only a start marker survives an edit", () => {
  assert.ok(upsertEvidence(`${START} half`, block("a")).endsWith(block("a")));
});

test("e2eStats reads Playwright json totals", () => {
  assert.deepEqual(e2eStats({ stats: { expected: 230, unexpected: 1, flaky: 2, skipped: 3 } }), { passed: 230, failed: 1, flaky: 2, skipped: 3 });
  assert.equal(e2eStats({}), null);
  assert.equal(e2eStats(null), null);
});

test("renderedSummary takes the section and the last result line", () => {
  const log = [
    "noise",
    "### served-reach: rendered text (report only)",
    "- recorded lines from served playtests: 10 by real input, 1 only after harness input",
    "- new player-facing strings: 2, rendered 1, not rendered 1",
    "- result: `text_harness_only`",
    "::warning title=x::y",
    "RENDERED_REACH_RESULT=text_harness_only",
  ].join("\r\n");
  const r = renderedSummary(log);
  assert.equal(r.result, "text_harness_only");
  assert.deepEqual(r.section, [
    "- recorded lines from served playtests: 10 by real input, 1 only after harness input",
    "- new player-facing strings: 2, rendered 1, not rendered 1",
  ]);
  assert.deepEqual(renderedSummary(""), { result: null, section: [] });
});

test("evidence fences quoted text so it cannot act as a body directive", () => {
  const md = renderEvidence({
    sha: "4999a54abcdef", runUrl: "https://x/runs/1", e2e: "success", at: "2026-10-27 23:00Z",
    stats: { passed: 231, failed: 0, flaky: 0, skipped: 0 },
    served: { result: "served", counts: "1 (reachable 1, unreachable 0)" },
    rendered: { result: "text_not_rendered", section: ['  - never rendered (`a.js`): "served-exempt: sneaky"'] },
  });
  assert.ok(md.startsWith(START) && md.endsWith(END));
  assert.match(md, /head: `4999a54`/);
  assert.match(md, /\*\*success\*\* \(231 passed, 0 failed, 0 flaky, 0 skipped\)/);
  assert.match(md, /served-reach: `served`; served source files changed: 1 \(reachable 1, unreachable 0\)/);
  assert.match(md, /rendered rule: `text_not_rendered`/);
  // The served-exempt / f2p-exempt parsers anchor at line start (^\s*served-exempt:).
  assert.ok(!/^\s*(served|f2p)-exempt:/im.test(md));
});

test("evidence reports missing served-reach output instead of omitting it", () => {
  const md = renderEvidence({ at: "t" });
  assert.match(md, /aftersign served e2e: \*\*not run\*\* \(no results\.json\)/);
  assert.match(md, /served-reach: `\(not reported\)`/);
  assert.match(md, /rendered rule: `not run`/);
  assert.deepEqual(servedSummary(), { result: "(not reported)", counts: null });
});
