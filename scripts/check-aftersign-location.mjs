#!/usr/bin/env node
// Guard: newly ADDED AFTERSIGN source/test files must live under aftersign/.
// Docs (.md/.txt/...) may live elsewhere.
//
// Base resolution (fails CLOSED on any git error — exit 1, never a silent pass):
//   1. AFTERSIGN_GUARD_BASE env (explicit override)
//   2. origin/$GITHUB_BASE_REF (pull_request events)
//   3. origin/main
// The diff is merge-base(base, HEAD)..HEAD, so multi-commit branches are
// covered in full. If the base ref / merge-base is missing (CI's depth-1
// actions/checkout), the script fetches the base branch and unshallows once,
// then retries; if that still fails it exits 1.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.txt', '.mdx', '.rst', '.adoc']);
const CANONICAL_AFTERSIGN_ROOT = 'aftersign/';

export class GuardError extends Error {}

function defaultGit(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function resolveBaseRef(env = process.env) {
  if (env.AFTERSIGN_GUARD_BASE) return env.AFTERSIGN_GUARD_BASE;
  if (env.GITHUB_BASE_REF) return `origin/${env.GITHUB_BASE_REF}`;
  return 'origin/main';
}

function tryMergeBase(git, baseRef) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]);
    return git(['merge-base', baseRef, 'HEAD']).trim();
  } catch {
    return null;
  }
}

// actions/checkout defaults to a depth-1 clone with no origin/<base> ref.
// Fetch the base branch and, if shallow, the full history so merge-base works.
function fetchBase(git, baseRef) {
  if (!baseRef.startsWith('origin/')) return;
  const branch = baseRef.slice('origin/'.length);
  git(['fetch', '--no-tags', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
  const shallow = git(['rev-parse', '--is-shallow-repository']).trim();
  if (shallow === 'true') git(['fetch', '--no-tags', '--unshallow', 'origin']);
}

export function changedFiles({ env = process.env, git = defaultGit } = {}) {
  const baseRef = resolveBaseRef(env);
  let mergeBase = tryMergeBase(git, baseRef);
  if (!mergeBase) {
    try {
      fetchBase(git, baseRef);
    } catch (err) {
      throw new GuardError(`failed to fetch base '${baseRef}': ${err?.message ?? err}`);
    }
    mergeBase = tryMergeBase(git, baseRef);
  }
  if (!mergeBase) {
    throw new GuardError(
      `cannot resolve base '${baseRef}' or its merge-base with HEAD ` +
        `(set AFTERSIGN_GUARD_BASE or fetch the base branch)`,
    );
  }
  if (!mergeBase) {
    throw new GuardError(`empty merge-base between '${baseRef}' and HEAD`);
  }
  let out;
  try {
    out = git(['diff', '--diff-filter=A', '--name-only', `${mergeBase}..HEAD`]);
  } catch (err) {
    throw new GuardError(`git diff failed against ${mergeBase}: ${err?.message ?? err}`);
  }
  return out.trim().split('\n').filter(Boolean);
}

function isDocument(path) {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return false;
  return DOCUMENT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

function isAftersignPath(path) {
  return path.toLowerCase().split('/').includes('aftersign');
}

export function findViolations(paths) {
  return paths.filter(
    (path) =>
      isAftersignPath(path) &&
      !path.startsWith(CANONICAL_AFTERSIGN_ROOT) &&
      !isDocument(path),
  );
}

/** Returns the process exit code. */
export function main({ env = process.env, git = defaultGit, log = console.error } = {}) {
  let paths;
  try {
    paths = changedFiles({ env, git });
  } catch (err) {
    log(`check-aftersign-location: ${err.message}`);
    return 1;
  }
  const violations = findViolations(paths);
  if (violations.length > 0) {
    log('AFTERSIGN source and test files must be added under aftersign/.');
    log('Documentation files may remain outside aftersign/.');
    for (const path of violations) log(`  - ${path}`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main();
}
