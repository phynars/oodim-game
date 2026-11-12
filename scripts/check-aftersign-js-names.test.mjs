import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultFiles, findUndefinedNames } from './check-aftersign-js-names.mjs';

// Writes the given files into a fresh temp folder and returns their paths.
function fixture(t, files) {
  const dir = mkdtempSync(join(tmpdir(), 'aftersign-js-names-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const paths = {};
  for (const [name, text] of Object.entries(files)) {
    paths[name] = join(dir, name);
    writeFileSync(paths[name], text);
  }
  return paths;
}

test('a call to a name whose import was removed is reported with its line', (t) => {
  // The shape of PR #2775: the import line is gone, the call stays.
  const paths = fixture(t, {
    'helpers.js': 'export function buildSnippets() { return []; }\n',
    'main.js': [
      "import './helpers.js';",
      'export function publish() {',
      '  return buildSnippets();',
      '}',
      '',
    ].join('\n'),
  });
  const findings = findUndefinedNames([paths['main.js']]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].name, 'buildSnippets');
  assert.equal(findings[0].line, 3);
  assert.equal(findings[0].column, 10);
});

test('a misspelled name is reported (the "did you mean" diagnostic)', (t) => {
  const paths = fixture(t, {
    'main.js': 'const snippetCount = 1;\nexport const total = snipetCount + 1;\n',
  });
  const findings = findUndefinedNames([paths['main.js']]);
  assert.deepEqual(
    findings.map((finding) => finding.name),
    ['snipetCount'],
  );
});

test('imported, declared and browser-global names are not reported', (t) => {
  const paths = fixture(t, {
    'helpers.js': 'export function buildSnippets() { return []; }\n',
    'main.js': [
      "import { buildSnippets } from './helpers.js';",
      'const local = buildSnippets();',
      'function hoisted() { return local.length; }',
      "window.__game = { count: hoisted(), mode: import.meta.env.MODE };",
      "document.body.dataset.ready = String(localStorage.getItem('k'));",
      'requestAnimationFrame(() => fetch(new URL(location.href)));',
      '',
    ].join('\n'),
  });
  assert.deepEqual(findUndefinedNames([paths['main.js']]), []);
});

test('type errors and unresolved modules are not this guard\'s business', (t) => {
  const paths = fixture(t, {
    'main.js': [
      "import { nothing } from './does-not-exist.js';",
      'const n = 1;',
      'n.toUpperCase();',
      'window.neverDeclared.call(nothing);',
      '',
    ].join('\n'),
  });
  assert.deepEqual(findUndefinedNames([paths['main.js']]), []);
});

test('the default file list is the non-test .js files directly under aftersign/', () => {
  const files = defaultFiles().map((file) => file.replace(/\\/g, '/'));
  assert.ok(files.some((file) => file.endsWith('/aftersign/main.js')));
  assert.ok(files.every((file) => file.endsWith('.js') && !file.endsWith('.test.js')));
});
