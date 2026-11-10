// The failure-summary relay contract (was the inline fixtures in ci.yml).
import { test } from "node:test";
import assert from "node:assert/strict";
import { findFailure, renderSummary } from "./aftersign-failure-summary.mjs";

test("per-test, collection/global and no-error reports", () => {
  assert.deepEqual(findFailure({ suites: [{ specs: [{ title: "per-test", tests: [{ results: [{ errors: [{ message: "spec failure" }] }] }] }] }] }), { title: "per-test", message: "spec failure" });
  assert.deepEqual(findFailure({ suites: [], errors: [{ message: "collection failure" }] }), { title: "(collection or global failure)", message: "collection failure" });
  assert.equal(findFailure({ suites: [], errors: [] }), null);
});

test("a failing spec is quoted; ANSI colour codes are stripped", () => {
  const md = renderSummary({ suites: [{ specs: [{ title: "beat 3", tests: [{ results: [{ errors: [{ message: "\u001b[2mexpected\u001b[22m 1" }] }] }] }] }] }, "log");
  assert.match(md, /### first failing spec/);
  assert.match(md, /spec: beat 3\nerror:\nexpected 1/);
  assert.doesNotMatch(md, /\u001b/);
  assert.doesNotMatch(md, /raw e2e runner log/);
});

test("no report → the boot-failure note and the raw log tail; no log → says so", () => {
  assert.match(renderSummary(null, "boom"), /results\.json not found[\s\S]*raw e2e runner log \(last 80 lines\)\n```\nboom\n```/);
  assert.match(renderSummary(null, null), /runner log not captured/);
  assert.match(renderSummary({ suites: [] }, "tail"), /no usable error[\s\S]*tail/);
});
