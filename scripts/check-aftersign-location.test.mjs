import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  changedFiles,
  findViolations,
  main,
  resolveBaseRef,
} from './check-aftersign-location.mjs';

const UNKNOWN_REV = "fatal: ambiguous argument 'origin/main...HEAD': unknown revision";

// Fake git. `baseMissingUntilFetch`: rev-parse fails until a fetch happens
// (models CI's depth-1 checkout). `failOn`: subcommand that always throws.
function fakeGit(added, { failOn, baseMissingUntilFetch = false, shallow = 'false' } = {}) {
  const calls = [];
  let fetched = false;
  const git = (args) => {
    calls.push(args);
    const cmd = args[0];
    if (failOn === cmd) throw new Error(UNKNOWN_REV);
    if (cmd === 'fetch') {
      fetched = true;
      return '';
    }
    if (cmd === 'rev-parse' && args[1] === '--is-shallow-repository') return `${shallow}\n`;
    if (cmd === 'rev-parse') {
      if (baseMissingUntilFetch && !fetched) throw new Error(UNKNOWN_REV);
      return 'abc123\n';
    }
    if (cmd === 'merge-base') return 'base000\n';
    if (cmd === 'diff') return added.join('\n') + '\n';
    throw new Error(`unexpected git ${args.join(' ')}`);
  };
  return { git, calls };
}

test('added legacy AFTERSIGN source/test paths are violations', () => {
  assert.deepEqual(
    findViolations([
      'apps/web/src/aftersign/new-module.ts',
      'packages/aftersign/foo.spec.ts',
      'aftersign/src/ok.ts',
      'docs/aftersign/notes.md',
      'apps/web/src/other/thing.ts',
    ]),
    ['apps/web/src/aftersign/new-module.ts', 'packages/aftersign/foo.spec.ts'],
  );
});

test('docs outside aftersign/ and canonical files pass', () => {
  assert.deepEqual(
    findViolations(['docs/aftersign/plan.md', 'aftersign/main.js', 'aftersign/e2e/x.spec.ts']),
    [],
  );
});

test('base ref resolution: override > GITHUB_BASE_REF > origin/main (never HEAD~1)', () => {
  assert.equal(resolveBaseRef({ AFTERSIGN_GUARD_BASE: 'abc', GITHUB_BASE_REF: 'dev' }), 'abc');
  assert.equal(resolveBaseRef({ GITHUB_BASE_REF: 'dev' }), 'origin/dev');
  assert.equal(resolveBaseRef({}), 'origin/main');
});

test('diffs merge-base..HEAD so every branch commit is covered', () => {
  const { git, calls } = fakeGit(['aftersign/a.ts']);
  assert.deepEqual(changedFiles({ env: {}, git }), ['aftersign/a.ts']);
  assert.deepEqual(calls.at(-1), ['diff', '--diff-filter=A', '--name-only', 'base000..HEAD']);
  assert.ok(!calls.some((c) => c[0] === 'fetch'), 'no fetch when base already present');
});

test('shallow CI checkout: fetches base + unshallows, then evaluates paths', () => {
  const { git, calls } = fakeGit(['apps/web/src/aftersign/x.ts'], {
    baseMissingUntilFetch: true,
    shallow: 'true',
  });
  assert.equal(main({ env: { GITHUB_BASE_REF: 'main' }, git, log: () => {} }), 1);
  assert.deepEqual(
    calls.find((c) => c[0] === 'fetch'),
    ['fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main'],
  );
  assert.ok(calls.some((c) => c[0] === 'fetch' && c.includes('--unshallow')));
});

test('fails closed (exit 1) when the base ref cannot be resolved even after fetch', () => {
  const logs = [];
  const { git } = fakeGit([], { failOn: 'merge-base' });
  assert.equal(main({ env: { GITHUB_BASE_REF: 'main' }, git, log: (m) => logs.push(m) }), 1);
  assert.match(logs.join('\n'), /cannot resolve base 'origin\/main'/);
});

test('fails closed (exit 1) when fetch errors', () => {
  const logs = [];
  const { git } = fakeGit([], { failOn: 'fetch', baseMissingUntilFetch: true });
  assert.equal(main({ env: {}, git, log: (m) => logs.push(m) }), 1);
  assert.match(logs.join('\n'), /failed to fetch base/);
});

test('fails closed (exit 1) when git diff errors', () => {
  const { git } = fakeGit([], { failOn: 'diff' });
  assert.equal(main({ env: {}, git, log: () => {} }), 1);
});

test('exit 1 with violations, exit 0 when clean', () => {
  assert.equal(main({ env: {}, git: fakeGit(['apps/web/src/aftersign/x.ts']).git, log: () => {} }), 1);
  assert.equal(main({ env: {}, git: fakeGit(['aftersign/x.ts', 'README.md']).git, log: () => {} }), 0);
});
