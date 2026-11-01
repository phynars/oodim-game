#!/usr/bin/env node
// Gate exemptions need a second party (oodim engine watch, 2026-11-01).
//
// served-reach and fail-to-pass each honour a PR-body line
// `<gate>-exempt: <reason>`. The implementing session writes that body, so a
// bare line let the beneficiary switch a blocking gate off for itself — an
// unrecorded bypass of the #1904–#1924 class. An exemption now counts only when
//
//   kind     — the reason starts with a fixed kind (EXEMPT_KINDS); `followup`
//              must name the issue that finishes the work (`followup #2700`).
//              Free text is `invalid`.
//   approval — an approver (GATE_EXEMPT_APPROVERS, default `kyoungshin`) who is
//              not the PR author has a current APPROVED review on the PR's head
//              SHA. A push after approval needs a fresh approval.
//
// Otherwise the gate runs as if no line were there. Every run prints
// `GATE_EXEMPT=<gate>:<state>[:<kind>[:<approver>]]` so the trail records
// requested, refused and granted exemptions alike.
// Re-run on approval: .github/workflows/exempt-approved.yml.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXEMPT_KINDS = {
  followup: "the work lands in a later PR; name its issue: `followup #N`",
  flake: "a flaky-test stabilization that cannot fail deterministically on base",
  "no-surface": "no player-visible or assertable surface (e.g. CSS-only)",
  tooling: "CI, scripts or docs wiring that ships nothing to players",
};

export const DEFAULT_APPROVERS = ["kyoungshin"];

/** The raw `<gate>-exempt:` reason, or null. */
export function exemptLine(body, gate) {
  const m = (body ?? "").match(new RegExp(`^\\s*${gate}-exempt:\\s*(\\S.*)$`, "im"));
  return m ? m[1].trim() : null;
}

/** `{ kind, detail }` for a well-formed reason, or null. */
export function parseExempt(reason) {
  const m = (reason ?? "").match(/^([a-z-]+)\b\s*(.*)$/i);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  if (!Object.hasOwn(EXEMPT_KINDS, kind)) return null;
  if (kind === "followup" && !/^#\d+\b/.test(m[2])) return null;
  return { kind, detail: m[2].trim() };
}

export function approverList(env = process.env) {
  const v = (env.GATE_EXEMPT_APPROVERS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return v.length ? v : DEFAULT_APPROVERS;
}

/** Login of an approver whose latest decisive review approves `headSha`, or null.
 *  The PR author never counts: approving your own exemption is the hole. */
export function approvedBy({ reviews, headSha, approvers, author }) {
  // Latest decisive review per reviewer wins (as review-approval-gate.mjs):
  // APPROVED then CHANGES_REQUESTED is not an approval; COMMENTED is ignored.
  const latest = new Map();
  const ordered = [...(reviews ?? [])].sort((a, b) => String(a.submitted_at ?? "").localeCompare(String(b.submitted_at ?? "")));
  for (const r of ordered) {
    const login = r.user?.login?.toLowerCase();
    if (!login || !["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state)) continue;
    latest.set(login, r);
  }
  for (const [login, r] of latest) {
    if (r.state !== "APPROVED" || r.commit_id !== headSha) continue;
    if (!approvers.includes(login) || login === author?.toLowerCase()) continue;
    return login;
  }
  return null;
}

/** Pure: what the gate may do with this PR's exemption line.
 *  state none | invalid | unapproved | approved; only `approved` exempts. */
export function resolveExempt({ body, gate, reviews, headSha, approvers, author }) {
  const reason = exemptLine(body, gate);
  if (!reason) return { state: "none", reason: null };
  const parsed = parseExempt(reason);
  if (!parsed) return { state: "invalid", reason };
  const by = approvedBy({ reviews, headSha, approvers, author });
  return by ? { state: "approved", reason, kind: parsed.kind, by } : { state: "unapproved", reason, kind: parsed.kind };
}

export function exemptTag(gate, ex) {
  return [gate, ex.state, ex.kind, ex.by].filter(Boolean).join(":");
}

/** One line for the step summary and the ::error hint. */
export function exemptNote(ex) {
  if (ex.state === "approved") return `**exempt** (${ex.kind}, approved by @${ex.by} on this head): ${ex.reason}`;
  if (ex.state === "invalid") return `exemption ignored, unknown kind: "${ex.reason}". Start the reason with one of ${Object.keys(EXEMPT_KINDS).join(", ")} (\`followup #N\`).`;
  if (ex.state === "unapproved") return `exemption requested (${ex.kind}) but not approved: it counts only after an approver (${approverList().join(", ")}, not the PR author) approves this head commit.`;
  return "";
}

async function gh(path, { token, method = "GET" }) {
  const r = await fetch(`https://api.github.com/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "oodim-gate-exempt", Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error(`GitHub API ${method} ${path} → ${r.status}`);
  return r.status === 204 || r.status === 201 ? null : r.json();
}

/** Every review on the PR (live, so a re-run sees a new approval). */
export async function fetchReviews({ repo, pr, token }) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh(`repos/${repo}/pulls/${pr}/reviews?per_page=100&page=${page}`, { token });
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

/** Resolve from a pull_request event payload; the gates' single entry point.
 *  Body and reviews are read live (a re-run after approval sees both); the
 *  head SHA is the event's, i.e. the commit this run actually tested. Any API
 *  failure fails closed: the exemption is not applied. */
export async function exemptFromEvent(pr, gate, env = process.env) {
  if (!pr) return { state: "none", reason: null };
  const repo = env.GITHUB_REPOSITORY, token = env.GITHUB_TOKEN;
  let body = pr.body ?? "", reviews = [];
  if (repo && token) {
    try {
      body = (await gh(`repos/${repo}/pulls/${pr.number}`, { token })).body ?? "";
      if (exemptLine(body, gate)) reviews = await fetchReviews({ repo, pr: pr.number, token });
    } catch (err) {
      console.log(`gate-exempt: ${err.message}; exemption not applied`);
      reviews = [];
    }
  }
  return resolveExempt({ body, gate, reviews, headSha: pr.head?.sha, approvers: approverList(env), author: pr.user?.login });
}

export const GATES = ["served", "f2p"];

/** Pure: should an approval event re-run the head's failed CI jobs? */
export function shouldRerun({ review, pr, approvers }) {
  if (review?.state?.toLowerCase() !== "approved") return false;
  const login = review.user?.login?.toLowerCase();
  if (!approvers.includes(login) || login === pr?.user?.login?.toLowerCase()) return false;
  if (review.commit_id !== pr?.head?.sha) return false;
  return GATES.some((g) => parseExempt(exemptLine(pr.body, g)));
}

// `node scripts/gate-exempt.mjs rerun` (.github/workflows/exempt-approved.yml):
// on an approver's APPROVE of a PR that asks for an exemption, re-run the
// failed jobs of the head's CI run so the gates read the new approval.
async function rerun() {
  const env = process.env;
  const e = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  if (!shouldRerun({ review: e.review, pr: e.pull_request, approvers: approverList(env) })) {
    console.log("gate-exempt: not an approver's approval of an exemption request; nothing to re-run.");
    return;
  }
  const sha = e.pull_request.head.sha, repo = env.GITHUB_REPOSITORY, token = env.GITHUB_TOKEN;
  const { workflow_runs: runs } = await gh(`repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=pull_request&per_page=5`, { token });
  const run = runs?.[0];
  if (!run) { console.log(`gate-exempt: no CI run for ${sha.slice(0, 7)}.`); return; }
  if (run.status !== "completed" || run.conclusion !== "failure") {
    console.log(`gate-exempt: CI run ${run.id} is ${run.status}/${run.conclusion ?? "-"}; it reads the approval itself, no re-run.`);
    return;
  }
  await gh(`repos/${repo}/actions/runs/${run.id}/rerun-failed-jobs`, { token, method: "POST" });
  console.log(`gate-exempt: re-running failed jobs of CI run ${run.id} for ${sha.slice(0, 7)}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "rerun") rerun().catch((err) => { console.error(err); process.exitCode = 2; });
}
