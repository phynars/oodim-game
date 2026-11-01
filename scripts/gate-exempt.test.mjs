// node --test scripts/gate-exempt.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { approvedBy, approverList, exemptLine, exemptTag, parseExempt, resolveExempt, shouldRerun } from "./gate-exempt.mjs";

const HEAD = "a".repeat(40);
const rev = (login, state, commit_id = HEAD, submitted_at = "2026-11-01T10:00:00Z") => ({ user: { login }, state, commit_id, submitted_at });
const base = { gate: "served", headSha: HEAD, approvers: ["kyoungshin"], author: "phynars" };

test("exemptLine reads only its own gate's line", () => {
  assert.equal(exemptLine("x\nserved-exempt: followup #2700 wired next\n", "served"), "followup #2700 wired next");
  assert.equal(exemptLine("f2p-exempt: flake retries", "served"), null);
  assert.equal(exemptLine("served-exempt:   ", "served"), null);
  assert.equal(exemptLine(undefined, "f2p"), null);
});

test("parseExempt: fixed kinds only; followup must name an issue", () => {
  assert.deepEqual(parseExempt("followup #2700 wired by the router PR"), { kind: "followup", detail: "#2700 wired by the router PR" });
  assert.deepEqual(parseExempt("No-Surface CSS-only z-index"), { kind: "no-surface", detail: "CSS-only z-index" });
  assert.equal(parseExempt("followup later"), null);
  assert.equal(parseExempt("wired in by #2400 next"), null, "free text is not a kind");
  assert.equal(parseExempt("docs only (BRIEF)."), null);
});

test("approvedBy: approver on the head SHA, never the author, latest decision wins", () => {
  assert.equal(approvedBy({ ...base, reviews: [rev("kyoungshin", "APPROVED")] }), "kyoungshin");
  assert.equal(approvedBy({ ...base, reviews: [rev("kyoungshin", "APPROVED", "b".repeat(40))] }), null, "stale head");
  assert.equal(approvedBy({ ...base, reviews: [rev("phynars-oodim", "APPROVED")] }), null, "not an approver");
  assert.equal(approvedBy({ ...base, author: "kyoungshin", reviews: [rev("kyoungshin", "APPROVED")] }), null, "self-approval");
  const later = [rev("kyoungshin", "CHANGES_REQUESTED", HEAD, "2026-11-01T11:00:00Z"), rev("kyoungshin", "APPROVED", HEAD, "2026-11-01T10:00:00Z")];
  assert.equal(approvedBy({ ...base, reviews: later }), null, "approval then changes-requested");
  assert.equal(approvedBy({ ...base, reviews: [rev("kyoungshin", "APPROVED"), rev("kyoungshin", "COMMENTED", HEAD, "2026-11-01T12:00:00Z")] }), "kyoungshin", "a comment does not revoke");
  assert.equal(approvedBy({ ...base, reviews: [rev("KyoungShin", "APPROVED")] }), "kyoungshin", "login case");
});

test("resolveExempt: only an approved, well-formed request exempts", () => {
  const body = "served-exempt: followup #2700 wired next";
  assert.equal(resolveExempt({ ...base, body: "nothing", reviews: [] }).state, "none");
  assert.equal(resolveExempt({ ...base, body: "served-exempt: trust me", reviews: [rev("kyoungshin", "APPROVED")] }).state, "invalid");
  assert.equal(resolveExempt({ ...base, body, reviews: [] }).state, "unapproved");
  const ok = resolveExempt({ ...base, body, reviews: [rev("kyoungshin", "APPROVED")] });
  assert.deepEqual(ok, { state: "approved", reason: "followup #2700 wired next", kind: "followup", by: "kyoungshin" });
  assert.equal(exemptTag("served", ok), "served:approved:followup:kyoungshin");
  assert.equal(exemptTag("f2p", { state: "invalid" }), "f2p:invalid");
});

test("approverList: repo variable, default kyoungshin", () => {
  assert.deepEqual(approverList({}), ["kyoungshin"]);
  assert.deepEqual(approverList({ GATE_EXEMPT_APPROVERS: "" }), ["kyoungshin"]);
  assert.deepEqual(approverList({ GATE_EXEMPT_APPROVERS: " A , b" }), ["a", "b"]);
});

test("shouldRerun: an approver's approval of the head of a PR asking for an exemption", () => {
  const pr = { user: { login: "phynars" }, head: { sha: HEAD }, body: "f2p-exempt: flake retries pass 20/20" };
  const ok = { state: "approved", user: { login: "kyoungshin" }, commit_id: HEAD };
  assert.equal(shouldRerun({ review: ok, pr, approvers: ["kyoungshin"] }), true);
  assert.equal(shouldRerun({ review: { ...ok, state: "commented" }, pr, approvers: ["kyoungshin"] }), false);
  assert.equal(shouldRerun({ review: { ...ok, user: { login: "phynars-oodim" } }, pr, approvers: ["kyoungshin"] }), false);
  assert.equal(shouldRerun({ review: { ...ok, commit_id: "c".repeat(40) }, pr, approvers: ["kyoungshin"] }), false);
  assert.equal(shouldRerun({ review: ok, pr: { ...pr, body: "no line" }, approvers: ["kyoungshin"] }), false);
});
