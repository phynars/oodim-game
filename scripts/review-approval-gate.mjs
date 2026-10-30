#!/usr/bin/env node
// Review-approval gate (#2571).
//
// Protected delivery-control paths (CI workflows + gate scripts) need an
// APPROVED review from someone other than the PR author.
//
// Deadlock constraint (PR #2572 review, F1): the reviewer tool refuses
// APPROVE while any check on the head is red. A gate that FAILS for a missing
// approval therefore must never run before a review exists. That is why
// .github/workflows/review-approval.yml triggers only on pull_request_review.
//
// Two output modes:
//   exit   (default) — exit 1 when a protected PR has no non-author approval.
//                      Only safe on pull_request_review events.
//   status (REVIEW_GATE_MODE=status) — never fail for a missing approval.
//                      Publish a `review-approval` commit status on the PR
//                      head: `pending` until approved, then `success`. Pending
//                      is not red, so it can't deadlock the reviewer, and it is
//                      safe on pull_request too. Needs `statuses: write`.
// Both modes exit 2 on real errors (missing env, GitHub API failure).

export const STATUS_CONTEXT = 'review-approval';

export const PROTECTED_PATH = /^(\.github\/workflows\/|scripts\/.*(gate|served-reach|fail-to-pass))/;

export function isProtectedPath(file) {
  return PROTECTED_PATH.test(file);
}

/**
 * Pure gate decision.
 * @param {{ changedFiles: string[], reviews: Array<{ user?: { login?: string }, state: string, submitted_at?: string }>, author: string }} input
 * @returns {{ required: boolean, pass: boolean, approvers: string[], protectedFiles: string[] }}
 */
export function evaluateGate({ changedFiles, reviews, author }) {
  const protectedFiles = changedFiles.filter(isProtectedPath);
  if (protectedFiles.length === 0) {
    return { required: false, pass: true, approvers: [], protectedFiles };
  }
  // A reviewer's latest decisive review wins. APPROVED then CHANGES_REQUESTED
  // is not an approval. COMMENTED reviews don't change the decision.
  const latest = new Map();
  const ordered = [...reviews].sort((a, b) =>
    String(a.submitted_at ?? '').localeCompare(String(b.submitted_at ?? '')),
  );
  for (const r of ordered) {
    const login = r.user?.login;
    if (!login || login === author) continue;
    if (r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED' || r.state === 'DISMISSED') {
      latest.set(login, r.state);
    }
  }
  const approvers = [...latest.entries()]
    .filter(([, state]) => state === 'APPROVED')
    .map(([login]) => login)
    .sort();
  return { required: true, pass: approvers.length > 0, approvers, protectedFiles };
}

/**
 * Map a gate decision to a commit status. A missing approval is `pending`,
 * never `failure` — a red status is what deadlocked PR #2572.
 * @param {ReturnType<typeof evaluateGate>} result
 * @returns {{ state: 'success' | 'pending', description: string }}
 */
export function statusFor(result) {
  if (!result.required) return { state: 'success', description: 'No protected paths changed' };
  if (result.pass) {
    return { state: 'success', description: `Approved by ${result.approvers.join(', ')}`.slice(0, 140) };
  }
  return { state: 'pending', description: 'Protected paths changed: awaiting a non-author APPROVED review' };
}

async function gh(fetchImpl, token, method, path, body) {
  const res = await fetchImpl(`https://api.github.com/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`GitHub API ${method} ${path} → ${res.status}`);
  return res.json();
}

async function ghPaged(fetchImpl, token, path) {
  const out = [];
  for (let page = 1; ; page++) {
    const batch = await gh(fetchImpl, token, 'GET', `${path}?per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) return out;
  }
}

/**
 * Evaluate the gate for a PR against the live GitHub API.
 * Returns the process exit code: 0 pass (or status published), 1 missing
 * approval in exit mode. Throws on real errors.
 * @param {{ env: Record<string, string | undefined>, fetchImpl?: typeof fetch, log?: (msg: string) => void, error?: (msg: string) => void }} opts
 */
export async function run({ env, fetchImpl = fetch, log = console.log, error = console.error }) {
  const { GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER } = env;
  if (!GH_TOKEN || !GITHUB_REPOSITORY || !PR_NUMBER) {
    throw new Error('review-approval-gate: missing GH_TOKEN/GITHUB_REPOSITORY/PR_NUMBER');
  }
  const mode = env.REVIEW_GATE_MODE === 'status' ? 'status' : 'exit';
  const base = `repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}`;
  // Author + head come from the API, not the event payload: a push after the
  // review moves the head, and the payload would be stale.
  const pr = await gh(fetchImpl, GH_TOKEN, 'GET', base);
  const author = pr.user?.login ?? env.PR_AUTHOR ?? '';
  const files = await ghPaged(fetchImpl, GH_TOKEN, `${base}/files`);
  const reviews = await ghPaged(fetchImpl, GH_TOKEN, `${base}/reviews`);
  const result = evaluateGate({ changedFiles: files.map((f) => f.filename), reviews, author });

  if (mode === 'status') {
    const headSha = pr.head?.sha;
    if (!headSha) throw new Error('review-approval-gate: PR has no head sha');
    const status = statusFor(result);
    await gh(fetchImpl, GH_TOKEN, 'POST', `repos/${GITHUB_REPOSITORY}/statuses/${headSha}`, {
      state: status.state,
      context: STATUS_CONTEXT,
      description: status.description,
    });
    log(JSON.stringify({ mode, ...result, headSha, status }));
    return 0;
  }

  log(JSON.stringify({ mode, ...result }));
  if (!result.pass) {
    error('Protected changes require an APPROVED review from someone other than the PR author.');
    return 1;
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run({ env: process.env }).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(2);
    },
  );
}
