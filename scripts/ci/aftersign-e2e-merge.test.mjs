import assert from "node:assert/strict";
import test from "node:test";
import { mergeReports } from "./aftersign-e2e-merge.mjs";
import { findFailingSpecs } from "./aftersign-failure-summary.mjs";
import { e2eStats } from "../pr-ci-evidence.mjs";

const spec = (title, status, message) => ({
  title, file: `${title}.spec.ts`, line: 1,
  tests: [{ status, results: message ? [{ errors: [{ message }] }] : [{ errors: [] }] }],
});
const shard = (specs, stats) => ({ suites: [{ title: "e2e", specs, suites: [] }], errors: [], stats: { duration: 1000, ...stats } });

test("suites are concatenated and totals summed; the readers see the whole run", () => {
  const merged = mergeReports([
    shard([spec("a", "expected"), spec("b", "unexpected", "boom b")], { expected: 1, unexpected: 1, flaky: 0, skipped: 0, duration: 4000 }),
    shard([spec("c", "unexpected", "boom c"), spec("d", "flaky", "once")], { expected: 0, unexpected: 1, flaky: 1, skipped: 2, duration: 9000 }),
  ]);
  assert.deepEqual(merged.stats, { duration: 9000, expected: 1, unexpected: 2, flaky: 1, skipped: 2 });
  assert.deepEqual(e2eStats(merged), { passed: 1, failed: 2, flaky: 1, skipped: 2 });
  assert.deepEqual(findFailingSpecs(merged).map((f) => f.title), ["b", "c"]);
});

test("an unreadable shard report is left out; none readable merges to nothing", () => {
  const one = mergeReports([null, shard([spec("a", "expected")], { expected: 1, unexpected: 0, flaky: 0, skipped: 0 }), { nope: true }]);
  assert.equal(one.suites.length, 1);
  assert.equal(one.stats.expected, 1);
  assert.equal(mergeReports([null, undefined, {}]), null);
});
