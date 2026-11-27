#!/usr/bin/env node
// Validates explicit runtime assumptions in AFTERSIGN browser specs.
// Write annotations as: @runtime-premise owner: aftersign/main.js:123 — observed state

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_ROOT = 'aftersign/e2e';
const SPEC_SUFFIX = /\.spec\.(?:[cm]?[jt]s|tsx?)$/i;
const ANNOTATION = /@runtime-premise\s+owner:\s*([^\s]+)\s*[—-]\s*(\S.+)\s*$/i;
const OWNER = /^(aftersign\/(?:src\/)?[\w./-]+\.(?:[cm]?[jt]s|tsx?|html|css)):(\d+)$/i;

function specFiles(root = E2E_ROOT) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && SPEC_SUFFIX.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

export function findRuntimePremiseViolations(source, file = '<source>') {
  return source.split(/\r?\n/).flatMap((line, index) => {
    if (!line.includes('@runtime-premise')) return [];
    const match = line.match(ANNOTATION);
    if (!match || !OWNER.test(match[1])) {
      return [`${file}:${index + 1}: runtime premise needs 'owner: aftersign/<source>:<line> — observed state'`];
    }
    const [, owner, lineNumber] = match[1].match(OWNER);
    if (!existsSync(owner)) {
      return [`${file}:${index + 1}: runtime premise owner does not exist: ${owner}`];
    }
    const ownerSource = readFileSync(owner, 'utf8');
    if (Number(lineNumber) > ownerSource.split(/\r?\n/).length) {
      return [`${file}:${index + 1}: runtime premise owner line ${lineNumber} is outside ${owner}`];
    }
    return [];
  });
}

export function checkRuntimePremises({ root = E2E_ROOT, readFile = readFileSync } = {}) {
  return specFiles(root).flatMap((file) =>
    findRuntimePremiseViolations(readFile(file, 'utf8'), relative('.', file)),
  );
}

export function main({ log = console.error } = {}) {
  const violations = checkRuntimePremises();
  if (violations.length === 0) return 0;
  log('AFTERSIGN e2e runtime-premise citations are invalid:');
  violations.forEach((violation) => log(`  - ${violation}`));
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main();
}
