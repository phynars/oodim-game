#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.txt', '.mdx', '.rst', '.adoc']);
const CANONICAL_AFTERSIGN_ROOT = 'aftersign/';

function changedFiles() {
  const base = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : 'HEAD~1';

  return execFileSync('git', ['diff', '--diff-filter=A', '--name-only', `${base}...HEAD`], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);
}

function isDocument(path) {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
  return DOCUMENT_EXTENSIONS.has(extension);
}

function isAftersignPath(path) {
  return path.toLowerCase().split('/').includes('aftersign');
}

const violations = changedFiles().filter(
  (path) =>
    isAftersignPath(path) &&
    !path.startsWith(CANONICAL_AFTERSIGN_ROOT) &&
    !isDocument(path),
);

if (violations.length > 0) {
  console.error('AFTERSIGN source and test files must be added under aftersign/.');
  console.error('Documentation files may remain outside aftersign/.');
  for (const path of violations) console.error(`  - ${path}`);
  process.exitCode = 1;
}
