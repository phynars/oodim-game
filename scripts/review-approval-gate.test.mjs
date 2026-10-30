import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const workflowUrl = new URL('../.github/workflows/ci.yml', import.meta.url);

test('CI requires a non-author approval before protected workflow changes can pass', async () => {
  const workflow = await readFile(fileURLToPath(workflowUrl), 'utf8');

  assert.match(workflow, /review-approval:/, 'CI must define the review approval gate');
  assert.match(workflow, /pull-requests:\s*read/, 'the gate must be able to read PR reviews');
  assert.match(workflow, /APPROVED/, 'the gate must require an approved review');
  assert.match(workflow, /author_association|user\.login/, 'the gate must exclude the PR author');
  assert.match(workflow, /\.github\/workflows\/|scripts\/.*(?:gate|served-reach|fail-to-pass)/, 'the gate must cover protected CI paths');
});
