#!/usr/bin/env node
// Review-approval gate (#2571).
//
// Protected delivery-control paths (CI workflows + gate scripts) need an
// APPROVED review from someone other than the PR author.
//
// This runs ONLY from .github/workflows/review-approval.yml on
// `pull_request_review` events. It must never run as a failing job on
// `pull_request`: the reviewer tool refuses APPROVE while any CI run is red.
// That would deadlock the PR (see PR #2572 review, F1). Before an approval
// exists the check is simply absent (pending), not failed.

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

async function ghPaged(path, token) {
  const out = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`https://api.github.com/${path}?per_page=100&page=${page}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API ${path} → ${res.status}`);
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 100) return out;
  }
}

async function main() {
  const { GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, PR_AUTHOR } = process.env;
  if (!GH_TOKEN || !GITHUB_REPOSITORY || !PR_NUMBER || !PR_AUTHOR) {
    console.error('review-approval-gate: missing GH_TOKEN/GITHUB_REPOSITORY/PR_NUMBER/PR_AUTHOR');
    process.exit(2);
  }
  const base = `repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}`;
  const files = await ghPaged(`${base}/files`, GH_TOKEN);
  const reviews = await ghPaged(`${base}/reviews`, GH_TOKEN);
  const result = evaluateGate({
    changedFiles: files.map((f) => f.filename),
    reviews,
    author: PR_AUTHOR,
  });
  console.log(JSON.stringify(result));
  if (!result.pass) {
    console.error('Protected changes require an APPROVED review from someone other than the PR author.');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
