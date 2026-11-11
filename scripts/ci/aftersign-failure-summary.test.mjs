// The failure-summary relay contract (was the inline fixtures in ci.yml).
import { test } from "node:test";
import assert from "node:assert/strict";
import { FAILING_SPECS_MAX, findFailingSpecs, findFailure, renderSummary } from "./aftersign-failure-summary.mjs";

const specOf = (n, status, message = `Timeout in spec ${n}\n  at line`) => ({
  title: `reload case ${n}`,
  file: `e2e/spec-${n}.spec.ts`,
  line: 10 + n,
  tests: [{ status, results: [{ errors: [{ message }] }, { errors: status === "flaky" ? [] : [{ message }] }] }],
});

test("every spec that ended failed is listed once; a flaky or skipped one is not", () => {
  const report = { suites: [{ specs: [specOf(9, "flaky"), specOf(1, "unexpected")], suites: [{ specs: [specOf(2, "unexpected"), specOf(3, "skipped")] }] }] };
  assert.deepEqual(findFailingSpecs(report).map((f) => f.where), ["e2e/spec-1.spec.ts:11", "e2e/spec-2.spec.ts:12"]);
  // The first failing spec is one that ended failed, not the flaky one before it.
  assert.equal(findFailure(report).title, "reload case 1");
  const md = renderSummary(report, "log");
  assert.match(md, /### every failing spec: 2 /);
  assert.match(md, /- e2e\/spec-1\.spec\.ts:11 › reload case 1 :: Timeout in spec 1\n- e2e\/spec-2\.spec\.ts:12 › reload case 2 :: Timeout in spec 2\n/);
  assert.doesNotMatch(md, /reload case 9|reload case 3/);
  assert.ok(md.indexOf("### every failing spec") < md.indexOf("### first failing spec"));
});

test("one failing spec adds no list; a long list is capped", () => {
  assert.doesNotMatch(renderSummary({ suites: [{ specs: [specOf(1, "unexpected")] }] }, "log"), /every failing spec/);
  const many = { suites: [{ specs: Array.from({ length: FAILING_SPECS_MAX + 4 }, (_, i) => specOf(i, "unexpected")) }] };
  const md = renderSummary(many, "log");
  assert.match(md, new RegExp(`### every failing spec: ${FAILING_SPECS_MAX + 4} `));
  assert.match(md, /- \(\+4 more\)/);
});

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
