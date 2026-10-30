import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluateGate, isProtectedPath } from './review-approval-gate.mjs';

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

// Deadlock regression (PR #2572 F1): enforcement must not be a failing job on
// pull_request, and it must re-run when a review is submitted.
test('enforcement runs on pull_request_review, never as a pull_request CI job', async () => {
  const gateWf = await readFile(fileURLToPath(new URL('../.github/workflows/review-approval.yml', import.meta.url)), 'utf8');
  const onBlock = gateWf.slice(gateWf.indexOf('\non:'), gateWf.indexOf('\npermissions:'));
  assert.match(onBlock, /pull_request_review:/);
  assert.doesNotMatch(onBlock, /^\s{2}pull_request:/m, 'gate must not run (and fail) on pull_request');
  assert.match(gateWf, /node scripts\/review-approval-gate\.mjs/);

  const ci = await readFile(fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url)), 'utf8');
  assert.doesNotMatch(ci, /review-approval-gate\.mjs/, 'ci.yml must not enforce approval');
  assert.match(ci, /node --test scripts\/review-approval-gate\.test\.mjs/, 'ci.yml must run the gate logic tests');
});
