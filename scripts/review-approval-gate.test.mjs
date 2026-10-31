import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluateGate, isProtectedPath, run, statusFor, STATUS_CONTEXT } from './review-approval-gate.mjs';

const AUTHOR = 'phynars';
const review = (login, state, submitted_at) => ({ user: { login }, state, submitted_at });

test('protected path matcher covers workflows and gate scripts only', () => {
  assert.equal(isProtectedPath('.github/workflows/ci.yml'), true);
  assert.equal(isProtectedPath('scripts/review-approval-gate.mjs'), true);
  assert.equal(isProtectedPath('scripts/check-served-reach.mjs'), true);
  assert.equal(isProtectedPath('scripts/fail-to-pass.mjs'), true);
  assert.equal(isProtectedPath('aftersign/main.js'), false);
  assert.equal(isProtectedPath('docs/.github/workflows/x.yml'), false);
});

test('unprotected changes pass with zero reviews', () => {
  const r = evaluateGate({ changedFiles: ['aftersign/main.js'], reviews: [], author: AUTHOR });
  assert.deepEqual([r.required, r.pass], [false, true]);
});

test('protected changes fail with zero reviews', () => {
  const r = evaluateGate({ changedFiles: ['.github/workflows/ci.yml'], reviews: [], author: AUTHOR });
  assert.deepEqual([r.required, r.pass], [true, false]);
});

test('author self-approval does not count', () => {
  const r = evaluateGate({
    changedFiles: ['.github/workflows/ci.yml'],
    reviews: [review(AUTHOR, 'APPROVED', '2026-10-30T01:00:00Z')],
    author: AUTHOR,
  });
  assert.equal(r.pass, false);
});

test('a non-author approval passes', () => {
  const r = evaluateGate({
    changedFiles: ['.github/workflows/ci.yml', 'aftersign/main.js'],
    reviews: [review('phynars-oodim', 'APPROVED', '2026-10-30T01:00:00Z')],
    author: AUTHOR,
  });
  assert.equal(r.pass, true);
  assert.deepEqual(r.approvers, ['phynars-oodim']);
  assert.deepEqual(r.protectedFiles, ['.github/workflows/ci.yml']);
});

test('changes-requested alone fails; COMMENTED is not an approval', () => {
  for (const state of ['CHANGES_REQUESTED', 'COMMENTED']) {
    const r = evaluateGate({
      changedFiles: ['.github/workflows/ci.yml'],
      reviews: [review('phynars-oodim', state, '2026-10-30T01:00:00Z')],
      author: AUTHOR,
    });
    assert.equal(r.pass, false, state);
  }
});

test("a reviewer's latest decisive review wins, regardless of array order", () => {
  const approvedThenBlocked = [
    review('phynars-oodim', 'CHANGES_REQUESTED', '2026-10-30T02:00:00Z'),
    review('phynars-oodim', 'APPROVED', '2026-10-30T01:00:00Z'),
  ];
  assert.equal(
    evaluateGate({ changedFiles: ['.github/workflows/ci.yml'], reviews: approvedThenBlocked, author: AUTHOR }).pass,
    false,
  );
  const blockedThenApproved = [
    review('phynars-oodim', 'CHANGES_REQUESTED', '2026-10-30T01:00:00Z'),
    review('phynars-oodim', 'APPROVED', '2026-10-30T02:00:00Z'),
    review('phynars-oodim', 'COMMENTED', '2026-10-30T03:00:00Z'),
  ];
  assert.equal(
    evaluateGate({ changedFiles: ['.github/workflows/ci.yml'], reviews: blockedThenApproved, author: AUTHOR }).pass,
    true,
  );
});

test('statusFor never maps a gate decision to failure/error', () => {
  const missing = evaluateGate({ changedFiles: ['.github/workflows/ci.yml'], reviews: [], author: AUTHOR });
  assert.equal(statusFor(missing).state, 'pending');
  assert.ok(statusFor(missing).description.length <= 140);
  const ok = evaluateGate({
    changedFiles: ['.github/workflows/ci.yml'],
    reviews: [review('phynars-oodim', 'APPROVED', '2026-10-30T01:00:00Z')],
    author: AUTHOR,
  });
  assert.equal(statusFor(ok).state, 'success');
});

// ---- run(): behaviour against a fake GitHub API (exercises the real code
// path that the workflow executes, not the YAML text) ----

function fakeGitHub({ files, reviews, author = AUTHOR, headSha = 'abc123' }) {
  const statuses = [];
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const path = new URL(url).pathname.replace(/^\//, '');
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (method === 'POST' && /\/statuses\//.test(path)) {
      statuses.push({ sha: path.split('/').pop(), ...JSON.parse(init.body) });
      return json({});
    }
    if (path.endsWith('/files')) return json(files.map((filename) => ({ filename })));
    if (path.endsWith('/reviews')) return json([...reviews]);
    if (/\/pulls\/\d+$/.test(path)) return json({ user: { login: author }, head: { sha: headSha } });
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchImpl, statuses };
}

const ENV = { GH_TOKEN: 't', GITHUB_REPOSITORY: 'phynars/oodim-game', PR_NUMBER: '2572' };
const quiet = { log: () => {}, error: () => {} };

test('status mode: missing approval publishes PENDING and the job does not fail', async () => {
  const gh = fakeGitHub({ files: ['.github/workflows/ci.yml'], reviews: [] });
  const code = await run({ env: { ...ENV, REVIEW_GATE_MODE: 'status' }, fetchImpl: gh.fetchImpl, ...quiet });
  assert.equal(code, 0, 'job must not fail while awaiting approval');
  assert.deepEqual(
    gh.statuses.map((s) => [s.sha, s.context, s.state]),
    [['abc123', STATUS_CONTEXT, 'pending']],
  );
});

// Deadlock regression (PR #2572 F1), simulated as a sequence: the reviewer may
// only APPROVE when nothing is red; after the approval the gate re-evaluates
// and goes green. Under the original design step 1 was red, so step 2 could
// never happen.
test('no deadlock: not red before any review, green after a non-author approval', async () => {
  const reviews = [];
  const gh = fakeGitHub({ files: ['scripts/review-approval-gate.mjs'], reviews });
  const env = { ...ENV, REVIEW_GATE_MODE: 'status' };
  const isRed = (s) => s.state === 'failure' || s.state === 'error';

  // 1. PR opened / pushed: gate runs before any review exists.
  assert.equal(await run({ env, fetchImpl: gh.fetchImpl, ...quiet }), 0);
  assert.equal(gh.statuses.some(isRed), false, 'reviewer tool would refuse APPROVE on a red head');

  // 2. Reviewer approves (allowed: nothing red); the review event re-runs the gate.
  reviews.push(review('phynars-oodim', 'APPROVED', '2026-10-30T02:00:00Z'));
  assert.equal(await run({ env, fetchImpl: gh.fetchImpl, ...quiet }), 0);
  assert.equal(gh.statuses.at(-1).state, 'success');
});

test('status mode: unprotected PR is success with zero reviews', async () => {
  const gh = fakeGitHub({ files: ['aftersign/main.js'], reviews: [] });
  await run({ env: { ...ENV, REVIEW_GATE_MODE: 'status' }, fetchImpl: gh.fetchImpl, ...quiet });
  assert.equal(gh.statuses[0].state, 'success');
});

test('exit mode (review events only): 1 without approval, 0 with one, no status posted', async () => {
  const blocked = fakeGitHub({
    files: ['.github/workflows/ci.yml'],
    reviews: [review('phynars-oodim', 'CHANGES_REQUESTED', '2026-10-30T01:00:00Z')],
  });
  assert.equal(await run({ env: ENV, fetchImpl: blocked.fetchImpl, ...quiet }), 1);
  assert.equal(blocked.statuses.length, 0);

  const approved = fakeGitHub({
    files: ['.github/workflows/ci.yml'],
    reviews: [review('phynars-oodim', 'APPROVED', '2026-10-30T01:00:00Z')],
  });
  assert.equal(await run({ env: ENV, fetchImpl: approved.fetchImpl, ...quiet }), 0);
});

// review mode (pull_request_review events): must POST the status first — so an
// approval overwrites the pending status a CI-completion run left on the head —
// and then fail the job on a missing approval. On main, 'review' fell through
// to exit mode and posted nothing, so the statuses assertions fail there.
test('review mode: posts status, then 1 without approval and 0 with one', async () => {
  const blocked = fakeGitHub({
    files: ['.github/workflows/ci.yml'],
    reviews: [review('phynars-oodim', 'CHANGES_REQUESTED', '2026-10-30T01:00:00Z')],
  });
  const env = { ...ENV, REVIEW_GATE_MODE: 'review' };
  assert.equal(await run({ env, fetchImpl: blocked.fetchImpl, ...quiet }), 1);
  assert.deepEqual(
    blocked.statuses.map((s) => [s.sha, s.context, s.state]),
    [['abc123', STATUS_CONTEXT, 'pending']],
  );

  // Sequence: CI-completion run (status mode) leaves pending, then the
  // approval review event (review mode) must flip the same context to success.
  const reviews = [];
  const gh = fakeGitHub({ files: ['.github/workflows/ci.yml'], reviews });
  assert.equal(await run({ env: { ...ENV, REVIEW_GATE_MODE: 'status' }, fetchImpl: gh.fetchImpl, ...quiet }), 0);
  assert.equal(gh.statuses.at(-1).state, 'pending');
  reviews.push(review('phynars-oodim', 'APPROVED', '2026-10-30T02:00:00Z'));
  assert.equal(await run({ env, fetchImpl: gh.fetchImpl, ...quiet }), 0);
  assert.deepEqual(
    gh.statuses.map((s) => [s.sha, s.context, s.state]),
    [
      ['abc123', STATUS_CONTEXT, 'pending'],
      ['abc123', STATUS_CONTEXT, 'success'],
    ],
  );
});

test('author comes from the PR API: a wrong PR_AUTHOR env cannot unlock self-approval', async () => {
  const gh = fakeGitHub({
    files: ['.github/workflows/ci.yml'],
    reviews: [review(AUTHOR, 'APPROVED', '2026-10-30T01:00:00Z')],
  });
  assert.equal(await run({ env: { ...ENV, PR_AUTHOR: 'someone-else' }, fetchImpl: gh.fetchImpl, ...quiet }), 1);
});

test('real errors reject (exit 2), distinct from a missing approval', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(run({ env: ENV, fetchImpl, ...quiet }), /500/);
  await assert.rejects(run({ env: {}, fetchImpl, ...quiet }), /missing/);
});

// Workflow contract: the failing (exit-mode) gate must only run on review
// events, and a review must re-trigger it.
test('enforcement runs on pull_request_review, never as a failing pull_request job', async () => {
  const gateWf = await readFile(fileURLToPath(new URL('../.github/workflows/review-approval.yml', import.meta.url)), 'utf8');
  const onBlock = gateWf.slice(gateWf.indexOf('\non:'), gateWf.indexOf('\npermissions:'));
  assert.match(onBlock, /pull_request_review:/);
  assert.match(onBlock, /workflow_run:/);
  assert.match(gateWf, /statuses:\s*write/, 'status/review modes POST commit statuses');
  // Both event types must publish the status: workflow_run -> 'status',
  // pull_request_review -> 'review'. No branch may fall through to 'exit'.
  const modeLine = gateWf.split('\n').find((l) => /^\s*REVIEW_GATE_MODE:/.test(l)) ?? '';
  const modes = [...modeLine.matchAll(/'(\w+)'/g)].map((m) => m[1]).filter((m) => m !== 'workflow_run');
  assert.deepEqual(modes, ['status', 'review'], `unexpected REVIEW_GATE_MODE: ${modeLine.trim()}`);
  assert.doesNotMatch(onBlock, /^\s{2}pull_request:/m, 'the failing gate must not run on pull_request');
  assert.match(gateWf, /node scripts\/review-approval-gate\.mjs/);

  const ci = await readFile(fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url)), 'utf8');
  assert.doesNotMatch(ci, /node scripts\/review-approval-gate\.mjs/, 'ci.yml must not enforce approval');
  assert.match(ci, /node --test scripts\/review-approval-gate\.test\.mjs/, 'ci.yml must run the gate logic tests');
});
