// Unit tests for the served replay's pure functions. Run:
// node --test scripts/served-replay.test.mjs
// The report shape mirrors a real deploy artifact (aftersign-m-loop-<sha>,
// 11-04): suite.file is relative to the config's testDir (aftersign/e2e).
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRunBody, fileFailures, fileStatuses, replayPlan, specStatuses } from "./served-replay.mjs";

const suite = (file, statuses, nested = []) => ({
  file,
  title: file,
  specs: [],
  suites: [{ file, title: "describe", specs: statuses.map((st, i) => ({ file, title: `t${i}`, tests: [{ status: st }] })), suites: nested }],
});

test("replayPlan: served specs only, deduped, sorted, capped", () => {
  const files = ["aftersign/e2e/b.spec.ts", "aftersign/e2e/a.playtest.spec.ts", "aftersign/e2e/pure.spec.ts", "aftersign/main.js", "agar/e2e/x.spec.ts", "aftersign/e2e/b.spec.ts"];
  assert.deepEqual(replayPlan(files, ["pure.spec.ts"]), ["aftersign/e2e/a.playtest.spec.ts", "aftersign/e2e/b.spec.ts"]);
  assert.deepEqual(replayPlan(files, [], 1), ["aftersign/e2e/a.playtest.spec.ts"]);
  assert.deepEqual(replayPlan([], []), []);
});

test("fileStatuses: one status per spec file", () => {
  const report = {
    suites: [
      suite("ok.spec.ts", ["expected", "expected"]),
      suite("bad.spec.ts", ["expected", "unexpected"]),
      suite("flaky.spec.ts", ["expected", "flaky"]),
      suite("skip.spec.ts", ["skipped", "skipped"]),
      suite("nested/deep.spec.ts", ["expected"]),
    ],
  };
  const s = fileStatuses(report);
  assert.equal(s.get("ok.spec.ts"), "passed");
  assert.equal(s.get("bad.spec.ts"), "failed");
  assert.equal(s.get("flaky.spec.ts"), "flaky");
  assert.equal(s.get("skip.spec.ts"), "skipped");
  assert.equal(s.get("nested/deep.spec.ts"), "passed");
  assert.equal(fileStatuses(null).size, 0);
});

test("specStatuses: exact testDir-relative match; missing = not_run", () => {
  const s = new Map([["x.spec.ts", "passed"], ["nested/x.spec.ts", "failed"]]);
  assert.deepEqual(specStatuses(["aftersign/e2e/x.spec.ts", "aftersign/e2e/nested/x.spec.ts", "aftersign/e2e/gone.spec.ts"], s), [
    { spec: "aftersign/e2e/x.spec.ts", status: "passed" },
    { spec: "aftersign/e2e/nested/x.spec.ts", status: "failed" },
    { spec: "aftersign/e2e/gone.spec.ts", status: "not_run" },
  ]);
});

test("checkRunBody: the v1 text contract and the conclusion", () => {
  const ok = checkRunBody({ sha: "abc", base: "def", rows: [{ spec: "aftersign/e2e/a.spec.ts", status: "passed" }, { spec: "aftersign/e2e/b.spec.ts", status: "flaky" }] });
  assert.equal(ok.name, "served-replay");
  assert.equal(ok.head_sha, "abc");
  assert.equal(ok.conclusion, "success");
  assert.equal(ok.output.text, "served-replay v1\nbase def\npassed aftersign/e2e/a.spec.ts\nflaky aftersign/e2e/b.spec.ts");
  assert.equal(checkRunBody({ sha: "a", base: "b", rows: [{ spec: "s", status: "failed" }] }).conclusion, "failure");
  assert.equal(checkRunBody({ sha: "a", base: "b", rows: [{ spec: "s", status: "not_run" }] }).conclusion, "failure");
  const none = checkRunBody({ sha: "a", base: "b", rows: [] });
  assert.equal(none.conclusion, "neutral");
  assert.equal(none.output.text, "served-replay v1\nbase b");
});

test("fileFailures + checkRunBody: a failed test's title and error reach the report", () => {
  const esc = String.fromCharCode(27);
  const report = {
    suites: [{
      file: "bad.spec.ts", title: "bad.spec.ts", specs: [],
      suites: [{
        file: "bad.spec.ts", title: "describe",
        specs: [
          { file: "bad.spec.ts", title: "keeps the line", tests: [{ status: "unexpected", results: [{ error: { message: "first try" } }, { error: { message: `${esc}[31mError: expect(received).toHaveLength(expected)${esc}[39m\n\nExpected length: 0\nReceived length: 1\nReceived array: [x]\n    at spec.ts:129` } }] }] },
          { file: "bad.spec.ts", title: "passes", tests: [{ status: "expected", results: [{}] }] },
          { file: "bad.spec.ts", title: "a :: b", tests: [{ status: "unexpected", results: [] }] },
        ],
      }],
    }, suite("ok.spec.ts", ["expected"])],
  };
  const f = fileFailures(report);
  assert.deepEqual(f, [
    { file: "bad.spec.ts", test: "keeps the line", message: "Error: expect(received).toHaveLength(expected) | Expected length: 0 | Received length: 1 | Received array: [x]" },
    { file: "bad.spec.ts", test: "a : b", message: "failed with no error message in the report" },
  ]);
  assert.equal(fileFailures(report, 1).length, 1);
  assert.deepEqual(fileFailures(null), []);
  const rows = [{ spec: "aftersign/e2e/bad.spec.ts", status: "failed" }, { spec: "aftersign/e2e/ok.spec.ts", status: "passed" }];
  const body = checkRunBody({ sha: "a", base: "b", rows, failures: [...f, { file: "ok.spec.ts", test: "t", message: "m" }, { file: "unplanned.spec.ts", test: "t", message: "m" }] });
  assert.equal(body.output.text, [
    "served-replay v1", "base b", "failed aftersign/e2e/bad.spec.ts", "passed aftersign/e2e/ok.spec.ts",
    "failure aftersign/e2e/bad.spec.ts :: keeps the line :: Error: expect(received).toHaveLength(expected) | Expected length: 0 | Received length: 1 | Received array: [x]",
    "failure aftersign/e2e/bad.spec.ts :: a : b :: failed with no error message in the report",
  ].join("\n"));
  assert.match(body.output.summary, /Failed tests:/);
  assert.equal(body.conclusion, "failure");
});
