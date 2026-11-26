import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkRuntimePremises, findRuntimePremiseViolations } from './check-aftersign-e2e-runtime-premises.mjs';

test('accepts a runtime premise that names an AFTERSIGN owner and line', () => {
  assert.deepEqual(
    findRuntimePremiseViolations(
      '// @runtime-premise owner: aftersign/main.js:42 — restore lands at Night Post\n',
      'aftersign/e2e/restore.spec.ts',
    ),
    [],
  );
});

test('rejects an uncited runtime premise', () => {
  assert.deepEqual(
    findRuntimePremiseViolations('// @runtime-premise restore lands at Night Post\n', 'aftersign/e2e/restore.spec.ts'),
    ["aftersign/e2e/restore.spec.ts:1: runtime premise needs 'owner: aftersign/<source>:<line> — observed state'"],
  );
});

test('rejects a cited premise without its observed state', () => {
  assert.deepEqual(
    findRuntimePremiseViolations('// @runtime-premise owner: aftersign/main.js:42\n', 'aftersign/e2e/restore.spec.ts'),
    ["aftersign/e2e/restore.spec.ts:1: runtime premise needs 'owner: aftersign/<source>:<line> — observed state'"],
  );
});

test('rejects a nonexistent cited owner', () => {
  assert.deepEqual(
    findRuntimePremiseViolations(
      '// @runtime-premise owner: aftersign/missing-owner.js:1 — restore lands at Night Post\n',
      'aftersign/e2e/restore.spec.ts',
    ),
    ['aftersign/e2e/restore.spec.ts:1: runtime premise owner does not exist: aftersign/missing-owner.js'],
  );
});

test('rejects a cited owner line outside its source', () => {
  assert.deepEqual(
    findRuntimePremiseViolations(
      '// @runtime-premise owner: aftersign/main.js:999999 — restore lands at Night Post\n',
      'aftersign/e2e/restore.spec.ts',
    ),
    ['aftersign/e2e/restore.spec.ts:1: runtime premise owner line 999999 is outside aftersign/main.js'],
  );
});

test('checks every AFTERSIGN e2e spec in a supplied root', () => {
  const root = mkdtempSync(join(tmpdir(), 'aftersign-premises-'));
  try {
    writeFileSync(join(root, 'uncited.spec.ts'), '// @runtime-premise boot is ready\n');
    writeFileSync(join(root, 'cited.spec.ts'), '// @runtime-premise owner: aftersign/main.js:8 — boot is ready\n');
    const violations = checkRuntimePremises({ root });
    assert.equal(violations.length, 1);
    assert.match(violations[0], /uncited\.spec\.ts:1: runtime premise needs 'owner: aftersign\/<source>:<line> — observed state'/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
